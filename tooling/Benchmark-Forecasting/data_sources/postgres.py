from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Any

from data_sources.base import HistoricalSeriesSource
from forecasting.contracts import BenchmarkDefinition, Observation, TimeSeries


QUERY = """
SELECT
  rr.payload_json->>'Indeks' AS series_id,
  COALESCE(rr.payload_json->>'Nazwa składnika', '') AS component_name,
  COALESCE(rr.payload_json->>'DESCRIPTION_ENG', '') AS description_eng,
  ((rr.payload_json->>'DATE')::timestamptz)::date AS source_date,
  NULLIF(rr.payload_json->>'VALUE', '')::double precision AS metric_value
FROM public.dr_raw_records rr
JOIN public.dr_datasets ds ON ds.id = rr.dataset_id
JOIN public.dr_sources src ON src.id = ds.source_id
JOIN public.dr_runs run ON run.id = rr.run_id
JOIN public.dr_pipelines p ON p.id = run.pipeline_id
WHERE rr.run_id = %(run_id)s
  AND src.code = 'market-indexes'
  AND ds.code = 'index-data'
  AND p.code = 'dashboard'
  AND rr.payload_json->>'VALUE_TYPE' = 'Historical'
  AND rr.payload_json->>'Indeks' = %(series_id)s
ORDER BY source_date ASC
"""


def rows_to_time_series(benchmark: BenchmarkDefinition, rows: list[dict[str, Any]]) -> TimeSeries:
    if not rows:
        raise ValueError(f"No historical rows returned for benchmark {benchmark.series_id}.")

    grouped_values: dict[date, list[float]] = defaultdict(list)
    component_names: set[str] = set()
    descriptions: set[str] = set()

    for row in rows:
        source_date = row.get("source_date")
        metric_value = row.get("metric_value")
        if source_date is None:
            raise ValueError(f"Missing DATE for benchmark {benchmark.series_id}.")
        if metric_value is None:
            raise ValueError(f"Missing VALUE for benchmark {benchmark.series_id} on {source_date}.")
        component_name = (row.get("component_name") or "").strip()
        description = (row.get("description_eng") or "").strip()
        if component_name:
            component_names.add(component_name)
        if description:
            descriptions.add(description)
        grouped_values[source_date].append(float(metric_value))

    observations: list[Observation] = []
    for source_date in sorted(grouped_values):
        values = grouped_values[source_date]
        unique_values = {round(value, 12) for value in values}
        if len(unique_values) > 1:
            raise ValueError(
                f"Conflicting duplicate observations for {benchmark.series_id} on {source_date}: {sorted(unique_values)}"
            )
        observations.append(Observation(date=source_date, value=values[0]))

    if len(observations) != benchmark.expected_observations:
        raise ValueError(
            f"Benchmark {benchmark.series_id} expected {benchmark.expected_observations} observations, got {len(observations)}."
        )

    description = benchmark.description
    if descriptions and benchmark.description not in descriptions:
        description = sorted(descriptions)[0]

    return TimeSeries(
        series_id=benchmark.series_id,
        benchmark_name=benchmark.component,
        description=description,
        frequency=benchmark.frequency,
        observations=tuple(observations),
    )


class PostgresHistoricalSource(HistoricalSeriesSource):
    def __init__(self, database_url: str) -> None:
        self._database_url = database_url

    def load_series(self, benchmark: BenchmarkDefinition, run_id: str) -> TimeSeries:
        import psycopg
        from psycopg.rows import dict_row

        with psycopg.connect(self._database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(QUERY, {"run_id": run_id, "series_id": benchmark.series_id})
                rows = list(cursor.fetchall())
        return rows_to_time_series(benchmark, rows)