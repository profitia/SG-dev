# SG2 — przyjęcie zgodności polityki lokalnego modułu CI, 17.10.2026

**Task:** SG2-E1-LOCAL-SUPPLIER-CI-COMPATIBILITY-20261017; SpendGuru 2.0 / SG-dev / development / local. Begin cmvcpdmxl0000acyg07duljuc; conversationId pmos-task-v2:e20d216c08bf5cbdb661714835d8343579f442e84bf06f77d3d0a642f6ce7584. Własna baza PMOS SG2, wymagane MEMOROS i PHR. Begin nie jest closeout.

**Producent:** ARCHITECTURE-E1-LOCAL-SUPPLIER-MODULE-CI-20261017, profitia/SG-dev, [PR444](https://github.com/profitia/SG-dev/pull/444), source4562cafd577f9160b08d35fab9d04a0c8eb8a485. [Dowód producenta](2026-10-17-architecture-local-supplier-module-ci.md) opisuje skończoną mapę dwóch istniejących lokalnych źródeł i zachowaną granicę credential phase; nie nadaje aplikacji praw dostępu.

Jedyną własną mutacją SG2 w tej jednostce jest niniejszy dowód. Nie zmieniono package.json/lockfile aplikacji, operation-integration.json, własnych kontraktów, UI, uprawnień, konfiguracji ani usług. Aggregate branch zawiera przyjęte źródło odrębnego producenta; nie przedstawia się tego jako jego autorstwa SG2.

Nowe reguły kontrolera są testowane bez poświadczeń. Niezmienione zależności aplikacji mogą przejść istniejący trusted-current-main controller przed merge tej polityki; publiczny PR verifier również pobiera current main. Wymagane przed zakończeniem: exact-head kontrolowany workflow z rzeczywistym test:operation-context, typecheck/build SG2, niezależny dashboard source proof, publiczny SRM i lab oraz governance. Brak proof lub niepoprawny digest pozostaje odmową. Nie wprowadzono opcji skip, wyjątku digestu ani kopiowania prywatnych zależności.

Nie deklaruje się jeszcze rzeczywistego biznesowego użycia srm-xray przez SG2, nowego UI lub zgodności wszystkich komponentów React19 z React18. To osobny kolejny task E1; ten odbiór obejmuje regresję obecnej aplikacji i gotowość zaufanej polityki do późniejszego lokalnego przyjęcia. Source publication nie jest deploymentem Development/Staging.

Własne pełne bramki before/begin/require-begin PASS, aktualny manifest i adapter oraz czyste izolowane źródło potwierdzone. Wyniki exact CI i merge zostaną powiązane z tą wersją w canonical PMOS/PHR po faktycznym wykonaniu; tekst nie zastępuje dowodu tych wyników.
