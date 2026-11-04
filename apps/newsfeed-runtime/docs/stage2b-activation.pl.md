# Newsfeed — instrukcja aktywacji Development

Wiążąca wspólna instrukcja: [Stage 2B — ręczna aktywacja właściciela](../../platform-source-hub/docs/stage2b-activation.pl.md). Zawiera oba projekty/branche Neon, dokładne role i komendy migracji, konfigurację dwóch usług Render, pełny katalog env, wymagane przyjęcie E1/Source, testy i rollback.

Newsfeed nie otrzymuje kluczy NewsAPI, Brave ani TE. Jego jedyny kanał pobrania danych to wersjonowane API Source Hub, ze sprawdzeniem bieżącej sesji i E1 po obu stronach. Stage 2A nie aktywuje żadnej usługi ani schedulera.
