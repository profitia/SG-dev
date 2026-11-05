# Oil Market Outlook — OpenAI Execution Profile (Pilot) v0.1

**Status:** `PROPOSED_NOT_APPROVED` · 2026-11-02  
**Odniesienie:** `Procurement Oil Insight — Report Canon v0.2` §7.1.  
**Rola:** wymienne parametry **pilotażu**, a nie część stabilnego kanonu redakcyjnego i nie uprawnienie do zmian infrastruktury.

## 1. Dane z audytu (stan na 2026-11-02)

- Badany projekt OpenAI Profitia ma politykę `Allow all models` i wymienione w Handoff modele `gpt-6.1-sol`, `gpt-6-luna`, `gpt-5.6-luna`, `gpt-6-astra`; to **polityka dostępu**, a nie dowód wywołania przez klucz SG2.
- **Nie potwierdzono**, do którego projektu należy klucz używany przez SG2 Development.
- SG2 nie ma ustawionego `OPENAI_MODEL`, dlatego przyjęło istniejący domyślny `gpt-5.6-luna`. Wywołanie zostało oznaczone `UNVERIFIED` przy 20-sekundowym limicie Source; usage, koszt i wynik nieustalone.
- Web Search jest włączony na koncie, ale brak przyjętej operacji wyszukiwania dla raportów w Source; Background Responses nie ma dopuszczonej ścieżki odpytywania/anulowania.
- Organizacyjny próg 100 USD/mies. opisany w audycie nie stanowi twardej ochrony przed wydatkami; wartości salda, cen i limitów są **migawką**, nie wiążącym założeniem produktowym.

## 2. Kandydaci do testów (nie freeze)

| Rola | Kandydat | Uzasadnienie / ograniczenie |
| --- | --- | --- |
| Autor pierwszego raportu | `gpt-6.1-sol` | Priorytet jakości analizy; do potwierdzenia prawa wywołania aktywnym kluczem SG2 i zmierzenia latencji. |
| Ekonomiczny wariant porównawczy | `gpt-6-luna` | Niski deklarowany koszt; poziom analizy trzeba zweryfikować na identycznym evidence. |
| Punkt odniesienia | `gpt-5.6-luna` | Obecny model SG2; pierwsza próba nie dostarczyła porównywalnego raportu. |
| Recenzja trudnych przypadków | `gpt-6-astra` | Opcjonalnie, po zgodzie kosztowej; nie zastępuje niezależnych danych, walidatorów ani recenzenta człowieka. |

Model powinien być wybierany **per operacja Insights**, bez globalnego przestawiania innych modułów SG2.

## 3. Proponowana konfiguracja pierwszej pełnej próby

- `Responses API`, `store:false`, `text.format={type:'json_schema',strict:true}`, wersjonowany schemat dziewięciu sekcji; potwierdzić dokładne wsparcie parametrów dla użytego modelu.
- Dla `gpt-6.1-sol` początkowo `reasoning.effort: medium`, tier Standard, **wyłącznie jeśli konfiguracja i transport akceptują te wartości**.
- Planistyczny budżet wejścia: do 15 000 tokenów; początkowy limit wyjścia: do 8000 tokenów **wraz z tokenami rozumowania**. Limit tokenów nie gwarantuje kompletności; status `incomplete` nie jest gotowym raportem.
- **Kandydat** na dedykowane okno synchronicznego Source: 120 s, plus właściwie dłuższy zewnętrzny deadline operacji. Wymaga sprawdzenia rzeczywistej bieżącej polityki, timeoutów transportu, przyjęcia konfiguracji i wydania w odpowiednim procesie. Nie zmieniać globalnych deadline'ów Findera.
- Roboczy budżet całego pilota: 5 USD **do odrębnego zatwierdzenia**; odrębna rezerwacja dla autora i recenzenta; liczby cennikowe i szacunek ~0,11 USD za tekst przy wskazanym profilu należy ponownie obliczyć przed testem, a narzędzia (np. web search) rozliczać osobno.
- Na pierwszą próbę: istniejący zweryfikowany `ReportEvidenceBundle`, **bez bezpośredniego Web Search**, jedna świadomie autoryzowana próba dopiero po uzgodnieniu poprzedniego `UNVERIFIED`. Bez automatycznych retry.
- Po wykonaniu: zachować rzeczywistą odpowiedź, `responseId`, `x-request-id` i klientowy ID korelacji, gdy dostępne, `usage`, rezerwację i koszt, latencję, fingerprint wejścia, wersję modelu/promptu oraz odrębne wyniki walidacji. Nie przesyłać sekretów ani pełnych prywatnych promptów do Sentry.

## 4. Etapy i blokady

1. **CONFIRM_API_KEY_PROJECT**: udowodnić przynależność/zakres praw aktywnego klucza SG2 bez ujawniania wartości klucza.
2. **RECONCILE_UNVERIFIED**: utrwalić status poprzedniej próby i koszt `UNKNOWN`, nie domniemywać nieponiesienia opłaty.
3. **ACCEPT_SOURCE_REPORT_OPERATION**: dedykowane okno i bezpieczne logowanie identyfikatorów; odrębne governance dla zmian shared Source.
4. **FIRST_COMPLETE_API_RESULT**: uzyskać pełny raport; walidować źródła, liczby, 4000 znaków oraz niezależną recenzję człowieka.
5. **QUALITY_BENCHMARK**: dopiero potem porównać Sol/Luna na tym samym `ReportEvidenceBundle` oraz rozważyć dopuszczony retrieval/web search. Nie porównywać jakości z poprzednim wynikiem `UNVERIFIED`, bo nie było tekstu.

**Żadna z powyższych rekomendacji nie autoryzuje merge, deploymentu, budżetu, zmiany klucza ani globalnej zmiany `OPENAI_MODEL`.**
