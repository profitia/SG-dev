# ARIMA Dashboard Demo Deferred Backlog

## Deferred Forecast Roadmap
- Stage 8 - deferred after demo
- Stage 9 - deferred after demo
- Stage 10 - deferred after demo
- Stage 11 - deferred after demo
- Stage 12 - deferred after demo
- Stage 13 - deferred after demo

## Demo Technical Shortcuts
- Forecast Portfolio v3 is demo-controlled on `wocaes0074` with ARIMA set as the default selected model instead of introducing a broader model rollout plan.
- Existing point-in-time upper/lower forecast lines are reused as the demo prediction-band presentation instead of building a new shaded-band renderer.

## Presentation Hardening
- Confirm whether the legend and tooltip copy should explicitly label the central line as `ARIMA Forecast` instead of relying on the existing Forecast-model control state.
- Decide whether prediction-band presentation should remain dual upper/lower lines or become a shaded business-safe range treatment.

## Runtime / Deployment Hardening
- Reconfirm Render environment parity and cold-start behavior for the point-in-time ARIMA path after demo publication.
- Add a focused deployed smoke check for `wocaes0074` ARIMA current forecast and verification payloads.

## Benchmark Finder Cleanup Audit
- deferred

## Testing Deferred
- Broader regression coverage for all four Forecast Portfolio models in the user-visible Dashboard v3 controls.
- Deployed-browser regression coverage for Forecast Portfolio v3 interactions and legend/tooltip semantics.