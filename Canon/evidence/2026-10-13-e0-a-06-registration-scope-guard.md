# E0-A-06 — spójność scope przy rejestracji PMOS

13 października 2026 wykryto rzeczywistą lukę: pmos:begin dopuściło nowe zakresy platform i integration, natomiast schema kanonicznego handoff/closeout przyjmuje tylko governance, architecture, implementation, audit, product i documentation. Generator zadania użył niewłaściwych nazw; przygotowanie handoff producenta odmówiło utworzenia bootstrapu, przed pmos:save i przed zajęciem pending slot. Zapis historii nie został utracony lub zmieniony.

Poprawka wykorzystuje istniejący CANONICAL_SCOPE_CLASSIFICATIONS z packages/governance. assertNewRegistrationInput odrzuca niekanoniczną wartość przed nowym INSERT promptExecution. Nie dodano nowego enumu, aliasu lub wyjątku dla ARCHITECTURE. Odczyt/replay już istniejących inputów zachowuje surową historyczną wartość; nie przepisuje się niezmiennej rejestracji.

Trzy rejestracje tego przebiegu zachowują pierwotne scope: ARCHITECTURE-E0-A-06-CONTRACT-PRODUCER-20261013 platform, SG2-E0-A-06-CONTRACT-INTEGRATION-20261013 integration oraz SRM-E0-A-06-CONTRACT-INTEGRATION-20261013 integration. Ich kanoniczne końcowe klasyfikacje to odpowiednio architecture oraz implementation/implementation. Raporty closeout zawierają tę rozbieżność i jej przyczynę; project, taskId, conversationId, środowisko i pierwotny request pozostają zgodne. Mechanizm końcowego zapisu dopuszcza klasyfikację finalnej pracy niezależnie od surowej kategorii rejestracji i nie aktualizuje jej historycznego inputu.

Regresja sprawdza wszystkie sześć dozwolonych zakresów oraz odrzucenie platform/integration/arch/unknown dla nowych rejestracji. Weryfikacja obejmuje dotychczasowe profile, lifecycle/PHR, typecheck oraz build. Nowe zadania dalszych etapów używają wyłącznie zakresów kanonicznych.
