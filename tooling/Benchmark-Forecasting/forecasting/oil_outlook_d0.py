"""Experimental 7-calendar-day extraction; never a production Forecast write.

Model fitting and projected weekdays reuse the existing rolling-daily Core.
The 7D evaluation, calendar approximation and latest-vintage limitations remain
explicit pending Forecast-owner acceptance. Existing horizons are untouched.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
from bisect import bisect_right
from dataclasses import asdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Callable

import numpy
import pandas
import statsmodels

from forecasting.backtest import compute_mase_scale
from forecasting.contracts import BacktestRecord, Frequency, Observation
from forecasting.date_grid import add_calendar_months_clamped
from forecasting.metrics import summarize_metrics
from forecasting.rolling_daily_point_in_time import fit_path_model, infer_supported_weekdays
from forecasting.runtime_catalog import build_model

VERSION = 'oil-d0-7calendar-day-experiment-v1'
MODEL_IDS = ('naive', 'damped_holt', 'ets', 'arima')
SERIES_IDS = ('cl_c1_cl', 'b_c1_cl')
TRAINING_POLICY = 'CURRENT_FAST_MINIMAL_LAWFUL_SUFFIX@current-fast-minimal-lawful-suffix-v1'
CALENDAR_POLICY = 'OBSERVED_WEEKDAY_SET_V1'
ROOT = Path(__file__).resolve().parents[1]
BANDS = {'status': 'NOT_AVAILABLE', 'lower': None, 'upper': None,
         'reason': 'NO_ACCEPTED_7D_CALIBRATION;_NO_PRE_1M_INTERPOLATED_BANDS'}


def canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()


def fingerprint(value: object) -> str:
    return hashlib.sha256(canonical(value)).hexdigest()


def engine_fingerprint() -> str:
    files = [Path(__file__), *sorted((ROOT / 'forecasting/models').glob('*.py')),
             ROOT / 'forecasting/rolling_daily_point_in_time.py', ROOT / 'forecasting/date_grid.py',
             ROOT / 'forecasting/runtime_catalog.py', ROOT / 'forecasting/metrics.py',
             ROOT / 'forecasting/backtest.py', ROOT / 'forecasting/training_policy.py',
             *sorted((ROOT / 'metadata').glob('*.json'))]
    return fingerprint({'files': {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
                                 for p in files if p.exists()},
                        'numpy': numpy.__version__, 'pandas': pandas.__version__, 'statsmodels': statsmodels.__version__})


class ExperimentalCache:
    """Local immutable, content-addressed evidence. No database or shared API.

    Concurrent misses fail busy rather than fit twice. Corruption fails closed.
    Forecasts and subsequently matured verification have separate namespaces.
    """
    def __init__(self, root: Path):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.hits = 0
        self.writes = 0

    def get_or_compute(self, kind: str, identity: dict, compute: Callable[[], dict]) -> dict:
        if kind not in ('forecast', 'verification'):
            raise ValueError('Unknown experimental artifact kind')
        key = fingerprint({'kind': kind, 'identity': identity})
        folder = self.root / kind
        folder.mkdir(exist_ok=True, mode=0o700)
        target = folder / f'{key}.json'

        def read() -> dict:
            stored = json.loads(target.read_text())
            if stored['identity'] != identity or stored['namespace'] != 'EXPERIMENTAL_ONLY' or stored['key'] != key \
                    or stored['payloadHash'] != fingerprint(stored['payload']):
                raise ValueError('Experimental artifact integrity mismatch')
            self.hits += 1
            return stored['payload']

        if target.exists():
            return read()
        lock = target.with_suffix('.lock')
        try:
            fd = os.open(lock, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError as error:
            raise RuntimeError('Experimental artifact busy; no duplicate fitting') from error
        try:
            os.close(fd)
            if target.exists():
                return read()
            payload = compute()
            envelope = {'namespace': 'EXPERIMENTAL_ONLY', 'kind': kind, 'key': key,
                        'identity': identity, 'payload': payload, 'payloadHash': fingerprint(payload)}
            # A reader only sees a complete target after the atomic hard link.
            temporary = target.with_suffix(f'.{os.getpid()}.tmp')
            try:
                with temporary.open('x') as stream:
                    os.chmod(temporary, 0o600)
                    stream.write(json.dumps(envelope, indent=2, allow_nan=False) + '\n')
                    stream.flush()
                    os.fsync(stream.fileno())
                os.link(temporary, target)
            finally:
                temporary.unlink(missing_ok=True)
            self.writes += 1
            return payload
        finally:
            lock.unlink()


def load_source(payload: dict, as_of: date) -> tuple[tuple[Observation, ...], dict]:
    series_id = payload['seriesId']
    history = payload['history']
    if series_id not in SERIES_IDS or history['providerSeries']['providerSeriesId'] != series_id \
            or history['providerSeries']['provider']['providerCode'] != 'MACROBOND' \
            or str(history['frequency']).upper() != 'DAILY' or history['currency'] != 'USD':
        raise ValueError('Exact Macrobond D0 source identity required')
    raw = history['historical']
    observations = []
    previous = None
    nulls = 0
    future = 0
    for point in raw:
        day = date.fromisoformat(point['date'][:10])
        if previous is not None and day <= previous:
            raise ValueError('Source dates must be strictly increasing, without duplicates')
        previous = day
        value = point['value']
        if day > as_of:
            future += 1
            continue
        if value is None:
            nulls += 1
            continue
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ValueError('Non-finite or non-numeric source value')
        observations.append(Observation(day, float(value)))
    if not observations:
        raise ValueError('No lawful observations available at evaluation cutoff')
    age = (as_of - observations[-1].date).days
    return tuple(observations), {'nullsExcluded': nulls, 'futurePointsExcluded': future,
        'lastLawfulObservation': observations[-1].date.isoformat(), 'lastLawfulValue': observations[-1].value,
        'calendarAgeDays': age, 'freshness': 'STALE_FOR_D0' if age > 7 else 'RECENT_NOT_EXCHANGE_CALENDAR_VERIFIED',
        'freshnessPolicy': 'D0_DISCLOSURE_AFTER_7_CALENDAR_DAYS_NOT_A_PROVIDER_SLA',
        'publicationTimestampStatus': 'NOT_AVAILABLE', 'historicalVintageStatus': payload.get('vintageStatus', 'NOT_AVAILABLE')}


def select_training(history: tuple[Observation, ...]) -> tuple[Observation, ...]:
    """Same trailing-12-calendar-month/minimum-60 rule as SG Runtime current-fast.

    This is recent verification with current policy, never FULL expanding history.
    """
    boundary = add_calendar_months_clamped(history[-1].date, -12)
    inside = tuple(point for point in history if point.date > boundary)
    return inside if len(inside) >= 60 else history[-60:]


def predict(series_id: str, model_id: str, history: tuple[Observation, ...], engine: str,
            cache: ExperimentalCache | None = None) -> dict:
    if series_id not in SERIES_IDS or model_id not in MODEL_IDS:
        raise ValueError('D0 series/model not allowed')
    if len(history) < 60:
        raise ValueError('INSUFFICIENT_TECHNICAL_TRAINING_HISTORY')
    if any(a.date >= b.date for a, b in zip(history, history[1:])):
        raise ValueError('Training history must be strictly increasing')
    training = select_training(history)
    origin = history[-1].date
    target = origin + timedelta(days=7)
    weekdays = infer_supported_weekdays(training)
    projected_days = [origin + timedelta(days=n) for n in range(1, 8)
                      if (origin + timedelta(days=n)).weekday() in weekdays]
    source_cutoff_hash = fingerprint([(p.date.isoformat(), p.value) for p in history])
    identity = {'seriesId': series_id, 'modelId': model_id, 'methodVersion': VERSION,
                'coreMethodVersion': 'rolling-daily-point-in-time-v1', 'engineFingerprint': engine,
                'originDate': origin.isoformat(), 'targetDate': target.isoformat(), 'horizon': '7D_CALENDAR',
                'sourceCutoffFingerprint': source_cutoff_hash, 'trainingPolicy': TRAINING_POLICY,
                'trainingFingerprint': fingerprint([(p.date.isoformat(), p.value) for p in training]),
                'calendarPolicy': CALENDAR_POLICY, 'frequency': 'DAILY', 'targetBasis': 'POINT_IN_TIME'}

    def compute() -> dict:
        fit = fit_path_model(build_model(model_id, Frequency.DAILY), training)
        values = fit.forecast_path(len(projected_days))
        value = float(values[-1]) if projected_days else training[-1].value
        if not math.isfinite(value):
            raise ValueError('Non-finite model result')
        return {'identity': identity, 'status': 'AVAILABLE_EXPERIMENTAL', 'approval': 'PENDING_FORECAST_OWNER_7D_ACCEPTANCE',
                'forecastValue': value, 'originValue': history[-1].value, 'unit': 'USD/Barrel',
                'projectedStepCount': len(projected_days), 'supportedWeekdays': list(weekdays),
                'nonTradingTargetRule': 'LATEST_PROJECTED_SUPPORTED_WEEKDAY_ON_OR_BEFORE_EXACT_TARGET',
                'lastProjectedStepDate': projected_days[-1].isoformat() if projected_days else origin.isoformat(),
                'exchangeHolidayCalendar': 'UNVERIFIED;_OBSERVED_WEEKDAYS_ARE_AN_APPROXIMATION',
                'trainingStart': training[0].date.isoformat(), 'trainingEnd': training[-1].date.isoformat(),
                'trainingCount': len(training), 'modelMetadata': asdict(fit.metadata), 'bands': dict(BANDS)}

    return compute() if cache is None else cache.get_or_compute('forecast', identity, compute)


def verify(forecast: dict, observations: tuple[Observation, ...], as_of: date,
           cache: ExperimentalCache | None = None) -> dict:
    identity = forecast['identity']
    origin = date.fromisoformat(identity['originDate'])
    target = date.fromisoformat(identity['targetDate'])
    dates = [p.date for p in observations]
    if as_of < target or observations[-1].date < target:
        return {'status': 'NOT_YET_MATURED', 'targetDate': target.isoformat(), 'actualValue': None}
    index = bisect_right(dates, target) - 1
    actual = observations[index] if index >= 0 else None
    if actual is None or actual.date <= origin:
        return {'status': 'NO_LAWFUL_POST_ORIGIN_OBSERVATION', 'actualValue': None}
    key = {'forecastKey': fingerprint(identity), 'actualDate': actual.date.isoformat(),
           'actualValue': actual.value, 'verificationVersion': VERSION,
           'publicationEvidence': 'OBSERVED_IN_SOURCE_SNAPSHOT_AT_EXPORT;_HISTORICAL_RELEASE_TIME_UNAVAILABLE'}

    def compute() -> dict:
        predicted = forecast['forecastValue']
        error = predicted - actual.value
        return {'status': 'MATURED_EXPERIMENTAL_LATEST_VINTAGE', 'actualValue': actual.value,
                'verificationObservationDate': actual.date.isoformat(), 'targetDate': target.isoformat(),
                'observationLagDays': (target - actual.date).days, 'error': error,
                'absoluteError': abs(error), 'publicationTimeVerified': False,
                'historicalRevisionLookAheadExcluded': False,
                'rolloverClassification': 'UNVERIFIED',
                'largeMoveWithinHorizon': any(abs(b.value - a.value) / max(abs(a.value), 1e-12) >= .10
                    for a, b in zip(observations, observations[1:]) if origin < b.date <= target)}
    return compute() if cache is None else cache.get_or_compute('verification', key, compute)


def choose_origins(observations: tuple[Observation, ...], maximum: int) -> list[int]:
    if not 1 <= maximum <= 52:
        raise ValueError('Bounded D0 origins must be between 1 and 52')
    selected = []
    last = None
    for index in range(len(observations) - 1, 58, -1):
        day = observations[index].date
        if day + timedelta(days=7) > observations[-1].date:
            continue
        if last is None or (last - day).days >= 7:
            selected.append(index)
            last = day
        if len(selected) >= maximum:
            break
    return list(reversed(selected))


def evaluate_series(source: dict, as_of: date, cache: ExperimentalCache, origins: int = 40) -> dict:
    observations, quality = load_source(source, as_of)
    series_id = source['seriesId']
    engine = engine_fingerprint()
    origin_indexes = choose_origins(observations, origins)
    models = {}
    for model in MODEL_IDS:
        current = None
        failures = []
        try:
            current = predict(series_id, model, observations, engine, cache)
        except Exception as error:
            failures.append({'originDate': observations[-1].date.isoformat(), 'reason': str(error)})
        records = []
        metric_records = []
        for index in origin_indexes:
            history = observations[:index + 1]
            try:
                forecast = predict(series_id, model, history, engine, cache)
                actual = verify(forecast, observations, as_of, cache)
                records.append({'forecast': forecast, 'verification': actual})
                if actual['status'] != 'MATURED_EXPERIMENTAL_LATEST_VINTAGE':
                    continue
                value = actual['actualValue']
                error = actual['error']
                metric_records.append(BacktestRecord(series_id, model, history[-1].date, '7D_CALENDAR',
                    forecast['projectedStepCount'], date.fromisoformat(forecast['identity']['targetDate']),
                    history[-1].value, forecast['forecastValue'], value, error, abs(error), error,
                    None if value == 0 else error/value, compute_mase_scale(list(select_training(history))),
                    None))
            except Exception as error:
                failures.append({'originDate': history[-1].date.isoformat(), 'reason': str(error)})
        metrics = asdict(summarize_metrics(metric_records)) if metric_records else None
        if metrics:
            metrics = {k: v if math.isfinite(v) else None for k, v in metrics.items()}
        models[model] = {'current': current, 'verification': {'status': 'EXPERIMENTAL_RECENT_7D_LATEST_VINTAGE',
            'originSelection': 'LATEST_MATURE_ORIGINS_SPACED_AT_LEAST_7_CALENDAR_DAYS',
            'requestedOrigins': origins, 'attemptedOrigins': len(origin_indexes), 'maturedSampleCount': len(metric_records),
            'failedSampleCount': len(failures) - (1 if current is None else 0),
            'metrics': metrics, 'metricUnits': {'mae': 'USD/Barrel', 'rmse': 'USD/Barrel', 'bias': 'USD/Barrel',
                'smape': 'PERCENT', 'directional_accuracy': 'FRACTION_0_1'},
            'statisticalSufficiency': 'DESCRIPTIVE_SAMPLE_ONLY_NOT_FORMAL_7D_ACCEPTANCE',
            'pointInTime': 'OBSERVATION_CUTOFF_ENFORCED;_HISTORICAL_VINTAGES_AND_PUBLICATION_TIMES_UNAVAILABLE',
            'rolloverVerifiedSampleCount': 0, 'largeMoveSampleCount': sum(r['verification'].get('largeMoveWithinHorizon', False) for r in records),
            'records': records}, 'failures': failures}
    return {'seriesId': series_id, 'requestedDescription': source['requestedDescription'],
        'storedDescription': source['history']['displayName'], 'provider': 'MACROBOND',
        'sourceLabel': source['history']['source'], 'currency': source['history']['currency'], 'unit': source['history']['unit'],
        'sourceFingerprint': fingerprint(source['history']), 'sourceMode': source['sourceMode'],
        'quality': quality, 'rollover': {'status': 'ROLLOVER_RULE_UNVERIFIED', 'automaticRolloverByMacrobond': 'UNVERIFIED',
            'adjustmentMethod': 'UNVERIFIED', 'historicalContractSwitchDates': 'NOT_AVAILABLE',
            'metadata': source.get('metadata', {}), 'jumpIsNotProofOfRollover': True},
        'modelResults': models, 'productionAccepted': False,
        'status': 'PARTIAL_READY' if any(row['current'] is not None for row in models.values()) else 'BLOCKED',
        'limitations': ['Forecast-owner 7D acceptance pending', 'No accepted 7D bands',
            'Exchange holiday calendar not verified', 'Rollover/adjustment rule and contract-switch dates not verified',
            'Historical release-time/revision vintages unavailable; results are pseudo point-in-time latest-vintage experiments',
            'Local content-addressed experimental artifacts do not implement production Forecast Library persistence']}
