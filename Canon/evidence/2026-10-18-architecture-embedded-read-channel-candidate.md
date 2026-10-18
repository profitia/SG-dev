# Embedded read presentation channel candidate — 18 October 2026

Status: local producer candidate. Separate SG2/SRM receiver tasks and combined source/main CI remain required. No product deployment or browser/session adoption is asserted.

Task `ARCHITECTURE-E1-EMBEDDED-READ-CHANNEL-20261018`; ARCHITECTURE; workspace SG-dev Architecture; target Development; execution local. Seven aligned producer paths, full before/begin/require-begin preflight; registration `cmvdh16gt00002whu7am11pbu` in architecture_pmos. MEMOROS is disabled by profile. The completed one-time PHR authority exception is not reused.

## Purpose and boundary

The accepted E1 programme requires a real embedded UI flow across existing framework boundaries. A protected backend API alone does not make the iframe a working authenticated consumer. Package1.9.0 adds one pure Web MessagePort presentation transport, independently versioned `profitia.embedded-read@1.0.0`, without changing existing executor, identity, authority loading, SQL or audit code.

The caller admits the exact window/source/origin before transferring the port, binds its own current session/organisation/subject and uses a closed application parser. Every read must use the actual protected backend and only its admitted projected result. The channel neither mints nor transfers an actor/session, grants access, classifies data, nor replaces backend authorisation or projection. It contains no React, Clerk, Node, provider, database, storage or network implementation. Browser credentials remain in the host; exact producer JSON validation is not a secret-detection guarantee for arbitrary caller callbacks.

Protocol/version/instance, exact envelopes, monotonic correlation, strict JSON shape,16KiB selection/8MiB result,4 in-flight requests,15s deadlines, cancellation and close prevent cross-request mixing or late delivery. Limits may only narrow. A failed/foreign/replayed message closes rather than falling back. Safe errors suppress callback diagnostics. Invalid Unicode byte size, JSON types/cycles/accessors/sparse arrays and depth beyond24 are refused. No hidden small node/object-count limit rejects a valid bounded large chart.

AbortSignal must be honoured by the reader. A timed-out noncooperative callback retains its concurrency slot until settlement; arbitrary JavaScript computation cannot be forcibly rolled back or stopped by this transport. Application unmount, exact origin/window checks, backend access decisions and actual chart behavior remain receiver responsibilities.

## Local evidence

332 whole-package tests pass, including56 new MessageChannel/JSON-publication cases;118 full laboratory tests with actual guarded loopback PostgreSQL pass. Zero failed/cancelled/skipped. Package syntax build and strict public declaration tests using both real Node MessagePorts and browser MessagePort types pass. The type proof rejects an absent application parser and function-bearing selections.

New cases cover correlation/out-of-order results, fresh callback invocation, refused identity/operation/destination selectors before read, cross-instance/version/envelope failures, replay, raw-child and client concurrency, cancellation, both close directions, host/client timeout, noncooperative slot retention, bounded large data with zero/null, UTF8/shape limits, safe callback failures, invalid responses and actual port publication failure. Idle close observation, observer failure and invalid observers are separately tested on real ports so presentation can be invalidated without another read. These are transport tests, not real Clerk, browser iframe origin, organisation or database authorisation proofs.

One shared `readPresentationJson` decoder is available to the later parent/server adapters. Real ReadableStreams cover split UTF8 and zero/null preservation, invalid MIME/JSON/UTF8/shape, byte overflow, failed streams, an already locked body and invalid limits. Failure cancels/releases owned readers and exposes only a safe error. This helper performs no fetch, HTTP status, destination, credential or publication-context admission; the caller must verify all of those before decoding. Sharing it does not move backend authority into the browser.

Existing operation/identity/private-host/access-store source and declarations remain byte-identical; all existing laboratory authority and ordinary-role tests pass. No product source, lockfile, cloud source/schema/role/grant, resource, secret, configuration, flag or deployment changed in this producer task. The package's minor version requires the separate consumers' explicit lock and compatibility acceptance before combined source publication; it does not trigger a package registry release.

Full E0/E1 remains in progress, including actual embedded UI/current-session integration, remaining operations/delegation/cache/files and controlled Development then Staging releases with verified recovery and their own evidence.
