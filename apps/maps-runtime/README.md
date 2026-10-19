# Maps Runtime

Independent Development connector; no SRM feature is mounted by this slice. Canon authority: `Canon/v1.2-srm-maps-runtime-amendment.md`. Logical owner: Maps Capability. No customer database, supplier identity authority or separate user login.

## Run

From repository root:

```sh
npm --prefix apps/maps-runtime ci --install-links
npm --prefix apps/maps-runtime run build
TARGET_ENVIRONMENT=development npm --prefix apps/maps-runtime start
```

Configure the runtime with `MAPS_BROWSER_API_KEY`, `MAPS_MAP_ID`, `MAPS_ALLOWED_HOST_ORIGINS` (comma-separated exact HTTPS origins, localhost HTTP only), and optionally `PORT` (default3410). Use a website-restricted Maps JavaScript API key from `profitia-maps-development`; never substitute a server key. Load ignored local configuration with Node's `--env-file=.env.local` when running the server directly. Server credentials are never public configuration. No Google request occurs until the user launches the map.

`/` is the independent connection test: two synthetic points and an unresolved list entry. Success means the actual Google `tilesloaded` event occurred. `/api/health` reports service/source/configuration, not Google reachability. `/harness.html` uses the public `@profitia/maps-embed` adapter; it is independent of SRM. `/embed.html` rejects hosts outside the configured exact allowlist.

## Integration contract

```js
import {mountMaps} from '@profitia/maps-embed'
const mounted = mountMaps({
  container: document.querySelector('#map'),
  runtimeOrigin: 'https://your-development-maps-runtime.example',
  readLocations: ({signal}) => authorizedHostApi.readLocations({signal}),
  onSelect: locationId => selectLocation(locationId),
  onStatus: status => displayStatus(status),
})
// On host unmount:
mounted.close()
```

The generic location projection is allowlisted and bounded: id, label, optional address/kind/source, optional finite lat/lng. Missing coordinates remain explicit. Supplier IDs, organization IDs, credentials and raw payloads are excluded from the presentation projection. Labels are text nodes, never HTML. Browser capabilities are presentation only.

The adapter uses the existing E1 public embedded-read channel. It transfers the MessagePort only after exact window/origin/version/instance verification. `readLocations` must enforce current access through the host's authorized backend for every private read. Synthetic harness tests do not establish actual E1 membership, RLS or user acceptance. Command/CRUD operations remain unsupported. No parallel authentication, organization store, backend identity token or foreign database is introduced.

Runtime startup has a separate90s default deadline (`startupTimeoutMs`, maximum120s), accommodating Development service wake-up. E1 reads retain their independent15s maximum (`timeoutMs`); startup time never increases channel limits. Render Free sleeps after15 idle minutes and can take about a minute to wake: https://render.com/docs/free . This deployment is for technical Development tests, not a production availability commitment.

For an independent-origin browser check, serve the built harness from a second local origin and set its runtime-origin field to the running Maps application. The runtime's allowed-host list must include that exact second origin. Its host CSP must allow the runtime frame. Browser Google key restrictions apply to the Maps runtime origin.

## Server geocoding boundary

`src/server/google/geocoding.mjs` is a tested adapter, not a public endpoint. It uses a separate server key, a fixed Google endpoint, bounded responses and timeout, and never automatically retries uncertain calls. It projects coordinates/place ID only; ambiguous results stay unresolved. This slice does not provision server credentials or claim a live Geocoding test. Expose business geocoding only after coordinated E1 operation/usage admission and environmental server credentials. There is no private persistence or Google response cache.

## Validation and rollback

`npm test` checks projections, bounds, fixed provider destinations, quota/ambiguity/transport failures, actual E1 channel transport, denied host projections, wrong-origin/version/window messages, teardown and HTTP boundaries. `npm run build` checks JS syntax, packages only the needed public channel implementation, and emits a per-file SHA256 manifest. Runtime source/configuration and live Google rendering need separate verification.

Before any deployment retain the current working artifact/configuration/source and migrations state. First bootstrap has no prior Maps service: document the absent-resource baseline, retain the tested source/build manifest and verify removal/containment of only the new service. No product DB exists to migrate or restore. After first success, retain that exact deploy and artifact evidence for subsequent releases; source rebuilds do not substitute for retained artifact rollback. Manual deployment only. Preserve SRM, SG2, E1 and Staging/Production services.

Official implementation/security references: https://developers.google.com/maps/documentation/javascript/load-maps-js-api ; https://developers.google.com/maps/api-security-best-practices ; https://developers.google.com/maps/documentation/javascript/policies .
