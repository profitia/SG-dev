# Platform Knowledge — etap 1, rejestracja czterech powierzchni

Data: 2026-11-11, Europe/Warsaw. Projekt: ARCHITECTURE / Development. Stan: rejestracja źródeł skuteczna po kontrolowanym przyjęciu do authority main; etap pierwszy pozostaje W_TOKU.

## Podstawa właścicielska i zakres

Właściciel zaakceptował finalny trzyetapowy plan i polecił jego publikację; [dowód akceptacji planu](2026-11-11-platform-knowledge-delivery-plan-owner-approval.md). Następnie wydał polecenie:

> Dziękuję. Zacznij wdrażanie etapu pierwszego - zgodnie z kanonem, harmonogramem i obowiązującymi wraperami.

Wskazał rezultat: gotowe warunki do ciągłej realizacji, z wcześnie rozstrzygniętymi podstawowymi zależnościami integracji i ograniczeniem oczekiwania na pojedyncze czynności właścicielskie.

Źródło potwierdzone odczytem hosta: hostConversationId `01a1c98f-af9f-7252-b4b8-d1e1d14b309a`, turnId `01a1ca3a-73ec-7490-9295-f2b06d43e839`, wiadomość `01a1ca3a-743b-7560-b9f3-7875e3b69856`. Task: `ARCH-PLATFORM-KNOWLEDGE-STAGE1-G1-20261111`. Authority przed zmianą: `d88adf594dfa51cd2011c2567dfc5f6506f6ffc1`.

§4 zaakceptowanego harmonogramu jawnie obejmuje rejestrację czterech dokładnie wskazanych powierzchni pod Architecture Platform przed kodowaniem. Polecenie wykonania tego etapu stanowi podstawę zmaterializowania G1 dla tych powierzchni. Nie jest to przeniesienie zgody z innego produktu ani domniemanie wynikające z samego kanonu.

| ID | Powierzchnia | Owner i profil |
|---|---|---|
| PK-BASE-001 | `apps/platform-knowledge-runtime/**` | Architecture Platform / ARCHITECTURE |
| PK-BASE-002 | `packages/platform-knowledge-contracts/**` | Architecture Platform / ARCHITECTURE |
| PK-BASE-003 | `packages/platform-knowledge-core/**` | Architecture Platform / ARCHITECTURE |
| PK-BASE-004 | `.github/workflows/platform-knowledge-ci.yml` | Architecture Platform / ARCHITECTURE |

Dodano wyłącznie cztery wiersze do routingu i jeden wpis capability do onboardingu. Wcześniejsze wiersze, metadane klasyfikacji i epoki, granice profili oraz istniejące zasoby pozostają niezmienione. Testy sprawdzają brak dopuszczenia profili konsumentów, sąsiednich ścieżek i konfliktów.

## Granice i dalszy ciąg

G1 rejestruje źródła, nie ustanawia grantu runtime. Obecne przyjęcie nie tworzy plików aplikacji lub pakietów; etapowy kontrakt i przygotowanie techniczne będą wykonane dopiero po skutecznym przyjęciu routingu na main i własnych bramkach kolejnego zadania.

Użytkownik zachowuje przygotowanie wymaganych środowisk/projektów Render, GitHub i Neon. Nie utworzono zasobów, nie zainstalowano schematów produktu, nie zmieniono grantów E1, sekretów ani deploymentów. Staging i Production nie są dopuszczone. Nie oznacza się etapu pierwszego jako zakończonego przed wykonaniem pakietu właścicielskiego i potwierdzeniem jego kryteriów.

[Przygotowanie integracji, luki i pakiet właścicielski](../runbooks/platform-knowledge-development-foundation-v1.md). Kolejne zadania integracyjne zachowają właścicieli ARCHITECTURE, SG2 i CIC; nie jest to zgoda na zapis cudzych powierzchni.
