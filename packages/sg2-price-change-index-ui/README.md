# Price Change Index UI

React 18 presentation module for SG2. Import the named PriceChangeIndex export and supply view, typed data, theme and optional onAction/onThemeChange callbacks. The demo owns synthetic datasets and in-memory action history. The module has no product transport, session, router, database or external theme connection. Shadow DOM contains its original styles and portals; no host-wide CSS reset is installed. Consumers supply local Inter/Roboto font assets.

Changing resetKey remounts the view and clears its transient demo projection. Unmount through the host React root. Each instance has its own presentation scope and listeners. onAction emits view, interaction/save/theme kind and the source action label; it is a presentation intent, never proof of persisted business work. Callback adapters for real APIs and authorization are Stage 2. No arbitrary-host compatibility, iframe, postMessage or automatic MagicPath synchronization is claimed.

All three pinned revisions and the approved shared library are in src/provenance.ts. Version 1/2 dark modes and canonical theme controls are explicitly approved additions. Inspector: hover an element and press Control+I, Escape closes it. Missing source IDs are reported as missing, never invented.
