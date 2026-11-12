from __future__ import annotations
import json
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace
from forecasting.contracts import Observation, BacktestRecord, ForecastMetadata, Frequency
from forecasting.metrics import summarize_metrics
from forecasting.oil_outlook_d0 import ExperimentalCache, MODEL_IDS, choose_origins, fingerprint, load_source, predict, select_training, verify, evaluate_series
from forecasting.rolling_daily_point_in_time import DEFAULT_ANCHOR_HORIZONS, fit_path_model
from forecasting.runtime_catalog import build_model


def points(end=date(2026, 10, 23), count=100):
    days=[]
    while len(days)<count:
        if end.weekday()<5: days.append(end)
        end-=timedelta(days=1)
    return tuple(Observation(d,60+i/10) for i,d in enumerate(reversed(days)))


def source(history):
    return {'seriesId':'cl_c1_cl','history':{'providerSeries':{'providerSeriesId':'cl_c1_cl','provider':{'providerCode':'MACROBOND'}},
        'frequency':'Daily','currency':'USD','historical':[{'date':p.date.isoformat(),'value':p.value} for p in history]}}


class D0Tests(unittest.TestCase):
    def test_calendar_seven_days_across_leap_day_is_five_projected_steps(self):
        r=predict('cl_c1_cl','naive',points(date(2024,2,23)),'engine')
        self.assertEqual(r['identity']['targetDate'],'2024-03-01');self.assertEqual(r['projectedStepCount'],5)
        self.assertEqual(r['bands']['status'],'NOT_AVAILABLE');self.assertIsNone(r['bands']['lower'])
        self.assertEqual(MODEL_IDS,('naive','damped_holt','ets','arima'))
        self.assertEqual(DEFAULT_ANCHOR_HORIZONS,{'1M':1,'3M':3,'6M':6,'12M':12})

    def test_source_cutoff_null_disclosure_staleness_and_negative_wti(self):
        p=source(points());p['history']['historical'][0]['value']=-37.63;p['history']['historical'][1]['value']=None
        p['history']['historical'].append({'date':'2026-11-02','value':10**9})
        actual,q=load_source(p,date(2026,11,1))
        self.assertEqual(actual[0].value,-37.63);self.assertEqual(q['nullsExcluded'],1);self.assertEqual(q['futurePointsExcluded'],1)
        self.assertEqual(q['freshness'],'STALE_FOR_D0');self.assertEqual(q['calendarAgeDays'],9)

    def test_duplicates_nonfinite_nonnumeric_and_series_substitution_rejected(self):
        for value in [float('inf'),float('nan'),True,'61.3']:
            p=source(points());p['history']['historical'][0]['value']=value
            with self.assertRaises(ValueError):load_source(p,date(2026,11,1))
        p=source(points());p['history']['historical'][1]['date']=p['history']['historical'][0]['date']
        with self.assertRaises(ValueError):load_source(p,date(2026,11,1))
        p=source(points());p['history']['providerSeries']['providerSeriesId']='wocaes0074'
        with self.assertRaises(ValueError):load_source(p,date(2026,11,1))

    def test_current_fast_training_uses_calendar_year_extending_only_to_sixty(self):
        h=points(count=500);r=select_training(h)
        self.assertTrue(all(p.date>date(2025,10,23) for p in r));self.assertEqual(r[-1],h[-1])
        h=tuple(Observation(date(2020,1,1)+timedelta(days=i*15),50+i) for i in range(80))
        self.assertEqual(select_training(h),h[-60:])
        with self.assertRaisesRegex(ValueError,'INSUFFICIENT'):predict('b_c1_cl','naive',points(count=59),'engine')

    def test_prefix_only_fit_and_future_mutation_do_not_change_past_forecast(self):
        h=points();original=predict('cl_c1_cl','naive',h[:70],'engine')
        altered=h[:70]+tuple(Observation(p.date,10**9) for p in h[70:])
        self.assertEqual(original,predict('cl_c1_cl','naive',altered[:70],'engine'))
        self.assertEqual(original['trainingEnd'],h[69].date.isoformat());self.assertEqual(original['forecastValue'],h[69].value)

    def test_target_holiday_uses_last_real_value_not_synthetic_target_observation(self):
        h=points(date(2026,10,19));f=predict('cl_c1_cl','naive',h,'engine')
        future=h+(Observation(date(2026,10,23),80),Observation(date(2026,10,27),90))
        r=verify(f,future,date(2026,10,27))
        self.assertEqual(r['targetDate'],'2026-10-26');self.assertEqual(r['verificationObservationDate'],'2026-10-23')
        self.assertTrue(r['largeMoveWithinHorizon']);self.assertEqual(r['rolloverClassification'],'UNVERIFIED')
        self.assertEqual(r['observationLagDays'],3);self.assertFalse(r['publicationTimeVerified']);self.assertFalse(r['historicalRevisionLookAheadExcluded'])

    def test_target_maturity_requires_elapsed_calendar_date_and_source_coverage(self):
        h=points();f=predict('cl_c1_cl','naive',h,'engine')
        self.assertEqual(verify(f,h,date(2026,11,1))['status'],'NOT_YET_MATURED')
        after=h+(Observation(date(2026,10,30),80),)
        self.assertEqual(verify(f,after,date(2026,10,29))['status'],'NOT_YET_MATURED')
        self.assertEqual(verify(f,after,date(2026,10,30))['actualValue'],80)

    def test_recent_origin_selection_is_bounded_weekly_and_mature(self):
        h=points(count=400);indexes=choose_origins(h,40)
        self.assertEqual(len(indexes),40)
        self.assertTrue(all(h[i].date+timedelta(days=7)<=h[-1].date for i in indexes))
        self.assertTrue(all((h[b].date-h[a].date).days>=7 for a,b in zip(indexes,indexes[1:])))
        with self.assertRaises(ValueError):choose_origins(h,1000)

    def test_immutable_persistence_reopen_reuses_fit_and_exact_source(self):
        with tempfile.TemporaryDirectory() as directory:
            cache=ExperimentalCache(Path(directory));r=predict('cl_c1_cl','naive',points(),'engine',cache)
            file=next((Path(directory)/'forecast').glob('*.json'));before=file.read_bytes();again=ExperimentalCache(Path(directory))
            with patch('forecasting.oil_outlook_d0.fit_path_model',side_effect=AssertionError('Must not fit')):
                self.assertEqual(predict('cl_c1_cl','naive',points(),'engine',again),r)
            self.assertEqual(again.hits,1);self.assertEqual(file.read_bytes(),before);self.assertEqual(file.stat().st_mode&0o777,0o600)

    def test_changed_input_or_engine_does_not_reuse_wrong_forecast(self):
        with tempfile.TemporaryDirectory() as directory:
            c=ExperimentalCache(Path(directory));h=points();a=predict('cl_c1_cl','naive',h,'a',c);b=predict('cl_c1_cl','naive',h,'b',c)
            changed=h[:-1]+(Observation(h[-1].date,99),);r=predict('cl_c1_cl','naive',changed,'b',c)
            self.assertNotEqual(a['identity'],b['identity']);self.assertNotEqual(b['identity'],r['identity']);self.assertEqual(c.writes,3)

    def test_corruption_and_concurrent_misses_fail_without_duplicate_compute(self):
        with tempfile.TemporaryDirectory() as directory:
            c=ExperimentalCache(Path(directory));predict('cl_c1_cl','naive',points(),'engine',c)
            file=next((Path(directory)/'forecast').glob('*.json'));p=json.loads(file.read_text());p['payload']['forecastValue']+=1;file.write_text(json.dumps(p))
            with self.assertRaisesRegex(ValueError,'integrity'):predict('cl_c1_cl','naive',points(),'engine',c)
            identity={'test':'concurrent'};key=fingerprint({'kind':'forecast','identity':identity});(Path(directory)/'forecast'/f'{key}.lock').touch()
            with self.assertRaisesRegex(RuntimeError,'busy'):c.get_or_compute('forecast',identity,lambda:self.fail('Must not fit'))

    def test_mature_verification_is_separate_and_cannot_modify_forecast(self):
        with tempfile.TemporaryDirectory() as directory:
            c=ExperimentalCache(Path(directory));h=points();f=predict('cl_c1_cl','naive',h,'engine',c)
            file=next((Path(directory)/'forecast').glob('*.json'));before=file.read_bytes()
            verify(f,h,date(2026,11,1),c);self.assertFalse((Path(directory)/'verification').exists())
            h=h+(Observation(date(2026,10,30),80),);a=verify(f,h,date(2026,11,1),c)
            self.assertEqual(a,verify(f,h,date(2026,11,1),c));self.assertEqual(file.read_bytes(),before)
            self.assertEqual(len(list((Path(directory)/'verification').glob('*.json'))),1)

    def test_metrics_sign_units_and_direction_are_computed_from_7d_records(self):
        def r(predicted,actual,origin):
            e=predicted-actual
            return BacktestRecord('cl_c1_cl','naive',date(2026,1,1),'7D_CALENDAR',5,date(2026,1,8),origin,predicted,actual,e,abs(e),e,e/actual,1,None)
        m=summarize_metrics([r(12,10,8),r(8,10,12)])
        self.assertEqual((m.mae,m.rmse,m.bias,m.directional_accuracy),(2,2,0,1));self.assertAlmostEqual(m.smape,(400/22+400/18)/2)

    def test_all_four_existing_fits_match_their_unchanged_long_daily_path(self):
        history=points(count=80)
        for model in MODEL_IDS:
            fitted=fit_path_model(build_model(model,Frequency.DAILY),history)
            expected=fitted.forecast_path(260)[4]
            with patch('forecasting.oil_outlook_d0.fit_path_model',return_value=fitted):
                result=predict('cl_c1_cl',model,history,'engine')
            self.assertAlmostEqual(result['forecastValue'],expected,places=8)

    def test_full_evaluation_enforces_input_cutoff_and_blocks_absent_forecasts(self):
        history=points();payload=source(history);payload.update(requestedDescription='WTI test',sourceMode='SYNTHETIC_UNIT_TEST_ONLY')
        payload['history'].update(displayName='WTI test',source='TEST',unit='USD/Barrel')
        cutoff=history[74].date;captured=[]
        def fit(model,training):
            captured.extend(training)
            return SimpleNamespace(metadata=ForecastMetadata(model_family=model.model_id,selected_variant='TEST',selected_parameters={},fit_status='SUCCEEDED'),
                forecast_path=lambda n:(training[-1].value,)*n)
        with tempfile.TemporaryDirectory() as directory:
            with patch('forecasting.oil_outlook_d0.fit_path_model',side_effect=fit):
                r=evaluate_series(payload,cutoff,ExperimentalCache(Path(directory)),2)
            self.assertTrue(captured);self.assertLessEqual(max(p.date for p in captured),cutoff)
            self.assertEqual(r['quality']['futurePointsExcluded'],25)
            self.assertTrue(all(m['verification']['maturedSampleCount']==2 for m in r['modelResults'].values()))
        short=source(history[:20]);short.update(requestedDescription='TEST',sourceMode='SYNTHETIC_UNIT_TEST_ONLY');short['history'].update(displayName='TEST',source='TEST',unit='USD/Barrel')
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(evaluate_series(short,cutoff,ExperimentalCache(Path(directory)),2)['status'],'BLOCKED')

if __name__=='__main__':unittest.main()
