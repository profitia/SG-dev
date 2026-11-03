"""Run the bounded D0 experiment against two explicitly exported real sources."""
from __future__ import annotations
import argparse
import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from forecasting.oil_outlook_d0 import ExperimentalCache, SERIES_IDS, VERSION, evaluate_series, fingerprint


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', action='append', required=True)
    parser.add_argument('--as-of', required=True)
    parser.add_argument('--cache', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--origins', type=int, default=40)
    args = parser.parse_args()
    sources = [json.loads(Path(p).read_text()) for p in args.source]
    if len(sources) != 2 or sorted(s['seriesId'] for s in sources) != sorted(SERIES_IDS):
        parser.error('Exactly one real WTI and one real Brent source artifact required')
    as_of = date.fromisoformat(args.as_of)
    if as_of > datetime.now(timezone.utc).date():
        parser.error('A future evaluation cutoff would imply unavailable source knowledge')
    cache = ExperimentalCache(Path(args.cache))
    results = []
    for source in sources:
        print(f"Evaluating {source['seriesId']} with {args.origins} recent 7D origins per model", flush=True)
        results.append(evaluate_series(source, as_of, cache, args.origins))
    status = 'BLOCKED' if any(series['status'] == 'BLOCKED' for series in results) else 'PARTIAL_READY'
    payload = {'schemaVersion': VERSION, 'status': status, 'usage': 'EXPERIMENTAL_NOT_PRODUCTION_ACCEPTED',
        'asOf': as_of.isoformat(), 'horizon': '7_CALENDAR_DAYS_FROM_LAST_LAWFUL_OBSERVATION',
        'series': results, 'cache': {'hits': cache.hits, 'writes': cache.writes, 'kind': 'LOCAL_EXPERIMENTAL_ONLY'},
        'sourceFiles': [{'path': str(Path(p).resolve()), 'sha256': __import__('hashlib').sha256(Path(p).read_bytes()).hexdigest()}
                        for p in args.source], 'publicBenchmarkFinderHorizonChanged': False,
        'productionDatabaseWrites': 0, 'providerCalls': 0, 'modelOwnerAcceptance': 'PENDING'}
    target = Path(args.output)
    target.mkdir(parents=True, exist_ok=True, mode=0o700)
    body = json.dumps(payload, indent=2, allow_nan=False) + '\n'
    key = fingerprint(payload)
    destination = target / f'oil-market-outlook-d0-{key}.json'
    with destination.open('x') as file:
        __import__('os').chmod(destination, 0o600)
        file.write(body)
    print(json.dumps({'package': str(destination.resolve()), 'status': payload['status'], 'cache': payload['cache']}))
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
