# Odbiór specyfikacji kontekstu operacji i macierzy dostępu — 16.10.2026

**Status:** SPECIFICATION_ACCEPTED — odebrano specyfikację producenta, bez przyjęcia i wdrożenia w produktach.

**Task ID:** ARCHITECTURE-OPERATION-CONTEXT-CONTRACT-V1-20261016. Profil ARCHITECTURE, workspace SG-dev Architecture, wykonanie local, TARGET_ENVIRONMENT=development.

**Upoważnienie:** odrębne polecenie właściciela „Dziekuje - wykonaj full autopilot z zapisem do PMOS”, dotyczące bezpośrednio uzgodnionego kontraktu, klasyfikacji danych i macierzy. Nie jest to uruchomienie implementacji całego programu E0–E4 ani przyjęcie kontraktu przez aplikacje.

**Punkt wejściowy authority:** profitia/SG-dev/main, 761c123a99cb85448933726d742b55f0b66179fb, po publikacji [baseline PR378](https://github.com/profitia/SG-dev/pull/378). Zastany checkout czysty; osobna gałąź architecture/operation-context-contract-v1-20261016. Zachowano trzy niezwiązane otwarte PR-y: 156, 154 i 97.

**Tożsamość PMOS:** rejestracja cmvbh84400000713s8ulcwyrm w architecture_pmos, projekt billowing-credit-07394675; conversationId zwrócone przez PMOS: pmos-task-v2:a7ba3256b3974781c72cdaeab14ff12fb6d345478579d763987409b08466678e. Rzeczywisty hostConversationId 01a133c2-c245-77a0-bb6b-33165e2ad80c potwierdzony przez narzędzie gospodarza przed begin. Nie zmieniano host identity wcześniejszego zadania baseline, które zarejestrowano z jawną niedostępnością tego ID.

## Zakres i artefakty

- [Kontrakt 1.0.0](../v1.0-operation-context-and-access-contract.md): pochodzenie i wiązanie kontekstu, tryby, klasyfikacja, decyzja, role, produkty, procesy, granice i odbiór.
- [Macierz 1.0.0](../registries/operation-access-matrix-v1.json): 30 dokładnych operacji, 14 wspólnych reguł, 6 klas danych, 10 szablonów ról, 4 profile docelowe i 77 scenariuszy.
- [Manifest](../registries/governance-manifest-v2.json) 3.25.0: dwa aktywne wpisy dla ARCHITECTURE/SG2/SRM, loadOrder 185–186; łącznie 45 aktywnych dokumentów. Wpisy zapewniają odczyt specyfikacji, nie aktywację runtime ani nowej bramki.
- Niniejszy datowany dowód odbioru. Wszystkie cztery ścieżki rozstrzygnięte jako Governance Source Layer / ALIGNED i zadeklarowane przed mutacją.

Nie zmieniono pakietu platform-contracts, przyjęć Development w SG2/SRM, adapterów produktu, konfiguracji usług, sekretów, baz, danych ani środowisk. Nie utworzono nowego repozytorium/projektu/usługi, nie zmieniono planu lub kosztu stałego. Nie wykorzystano NPM_TOKEN z Render.

## Decyzje specyfikacji

| Obszar | Przyjęta reguła | Granica |
| --- | --- | --- |
| Tożsamość | Backend potwierdza aktora, członkostwo/grant i wybraną organizację | Nagłówek, body, App ID i położenie komponentu nie nadają praw |
| Produkt | Prawo organizacji do funkcji jest oddzielone od uprawnienia aktora | Zakup ani rola admin nie oznaczają pełnego dostępu; PORR może korzystać z umowy bez Stripe |
| Właścicielstwo | Organizacja, osoba w organizacji, konto i wspólna wiedza mają różne reguły | createdBy nie zastępuje właściciela; historia pobrania/koszt nie staje się wiedzą globalną |
| Onboarding | Jawny BOOTSTRAP bez fikcyjnego Organisation ID, z ograniczonym tworzeniem/przyjęciem zaproszenia | Nie daje dostępu do prywatnych danych przed aktywną podstawą dostępu |
| Administracja | Jawne pułapy grantów; oddzielny owner, billing i audyt; ochrona ostatniego ownera | Brak ról platformy i praw do cudzych danych osobistych przez grant biznesowy |
| Procesy | Globalny ingest ma własną ograniczoną usługę; delegacja stanowi przecięcie aktualnych praw | Job nie zachowuje cofniętych praw; zapis userId w kolejce nie jest dowodem delegacji |
| Raport | Oddzielny odczyt, zapis projekcji i nowe pobranie dostawcy | Dotychczasowe readReportData nie jest uznane automatycznie za zgodny czysty odczyt |
| Support | Czasowy, odwoływalny grant na zasób/projekcję z udokumentowaną zgodą organizacji | Rola platformy sama nie daje dostępu; brak osobistych danych i sekretów |
| Audyt i limit | Chroniony ślad decyzji/skutku; aktualna polityka, rezerwacja i idempotencja | Nieznana polityka nie oznacza dostępu bez limitu; sam SHA/CI nie jest dowodem izolacji |

## Wykonane kontrole i granice dowodu

Pełny preflight przed begin oraz po begin z require-begin przeszedł PASS. Załadowano 30 aktualnych dokumentów CORE/ARCHITECTURE w kolejności, potwierdzając zgodność ich hashy z poprzednim pełnym odczytem. Przed rozpoczęciem manifest miał 43 aktywne wpisy; po dodaniu dwóch specyfikacji ma 45. Końcowy preflight na czystym commicie i wyniki PR/main CI są w końcowym rekordzie PMOS tego zadania, po ich wykonaniu.

Lokalnie wykonano 34 istniejące testy: 30 governance/bridge/workspace/kontraktu Development/laboratorium oraz po 2 testy rzeczywistego przyjęcia starego kontraktu Development w SG2 i SRM. Wszystkie PASS, 0 skip. Te cztery testy odbiorców nie testują nowej autoryzacji produktu; potwierdzają, że niniejszy dokument jej nie podmienił.

Kontrole spójności specyfikacji: PASS, 34 kontrole integralności. Sprawdzają unikalność, referencje, pokrycie przypadkami, ograniczenia ról i deklaracje, nie wykonują decyzji ALLOW/DENY w silniku produktu. 77 scenariuszy ma status SPECIFIED_NOT_RUNTIME_TESTED. Każda z 30 operacji ma przypadek pozytywny i negatywny. Nie raportuje się „77 testów bezpieczeństwa PASS”.

Nie wykonano nowych biznesowych E2E, testów penetracyjnych, migracji, płatnych wywołań, rolloutów lub rollbacków produktów. Nie poprawiono luk z baseline i nie uznano ich za zamknięte. To odbiór kontraktu producenta, nie odbiór bezpiecznego wdrożenia SaaS.

## Odtworzenie kontroli specyfikacji

Ze źródłowego checkoutu właściwego repozytorium można wykonać istniejące polecenia:

```text
node scripts/governance/validate-governance-manifest.mjs
node --test scripts/governance/governance.test.mjs scripts/governance/development-bridge.test.mjs scripts/governance/development-workspace.test.mjs packages/platform-contracts/test/*.test.mjs apps/architecture-lab/test/*.test.mjs
npm --prefix apps/sg-runtime run test:platform-contract
npm --prefix apps/srm run test:platform-contract
```

Poniższa odczytowa kontrola Python używa tylko biblioteki standardowej, z katalogu głównego repozytorium. Jest narzędziem sprawdzenia struktury dokumentów, nie implementacją polityki runtime. Zapisuje wynik na standardowe wyjście, bez dostępu do dostawców lub danych biznesowych.

```python
import json,pathlib,re,subprocess
root=pathlib.Path.cwd()
registry=root/'Canon/registries/operation-access-matrix-v1.json'
x=json.loads(registry.read_text());doc=(root/x['contractDocument']).read_text();checks=[]
def check(name,condition):
 if not condition: raise AssertionError(name)
 checks.append(name)
def unique(items,key):return len({v[key] for v in items})==len(items)
rules=x['rules'];operations={r['operation'] for r in rules};ruleids={r['id'] for r in rules};classes={d['id'] for d in x['dataClasses']};guards=set(x['globalGuards']);conditions=set(x['conditions']);reasons=set(x['denialReasons']);roleids={r['id'] for r in x['roleTemplates']}
check('target_only_not_runtime',x['executionSemantics']=='SPECIFICATION_ONLY_NOT_A_RUNTIME_POLICY_ENGINE' and all(v in ('NOT_ADOPTED','NOT_ONBOARDED') for v in x['implementationStatus'].values()))
check('deny_by_default_no_first_match',x['defaultDecision']=='DENY' and x['matchSemantics']=='ONE_EXACT_OPERATION_RULE_ALL_GUARDS_AND_CONDITIONS_REQUIRED_DENY_OVERRIDES')
check('contract_identity_consistent',x['contractId']=='profitia.operation-context' and x['contractVersion']=='1.0.0' and '1.0.0' in doc)
check('unique_rule_ids_and_operations',unique(rules,'id') and unique(rules,'operation'))
check('unique_case_ids',unique(x['acceptanceCases'],'id'))
check('all_four_context_modes',set(x['contextModes'])=={'ORGANISATION','ACCOUNT','BOOTSTRAP','PLATFORM'})
check('all_six_data_classes',len(classes)==6)
check('all_global_guards_apply',set(x['requiredGlobalGuards'])==guards and len(guards)==14)
check('no_business_wildcard_grants',all('*' not in r['requiredPermission'] and '*' not in r['operation'] for r in rules))
check('all_rule_references_resolve',all(set(r['conditionIds'])<=conditions and set(r['dataClasses'])<=classes and r['contextMode'] in x['contextModes'] and set(r['actorKinds'])<=set(x['actorKinds']) for r in rules))
check('every_protected_rule_has_audit',all(r['audit']=='SECURITY_REQUIRED' for r in rules))
check('no_demo_or_anonymous_domain_allow',all(not {'DEMO','ANONYMOUS'}&set(r['actorKinds']) for r in rules))
check('personal_resources_preserve_owner',all(r['contextMode']=='ORGANISATION' and 'PERSONAL_OWNER' in r['conditionIds'] and r.get('productRequirementSource') for r in rules if 'USER_IN_ORGANISATION_PRIVATE' in r['dataClasses'] and r['operation']!='supplier.report.export'))
check('bootstrap_only_declared_operations',{r['operation'] for r in rules if r['contextMode']=='BOOTSTRAP'}=={'organisation.create','invitation.accept'})
check('account_only_self',all(r['actorKinds']==['HUMAN'] and 'ACCOUNT_OWNER' in r['conditionIds'] for r in rules if r['contextMode']=='ACCOUNT'))
check('global_shared_write_service_only',all(r['contextMode']=='PLATFORM' and r['actorKinds']==['SERVICE'] and 'GLOBAL_INGEST' in r['conditionIds'] for r in rules if 'SHARED_KNOWLEDGE' in r['dataClasses'] and r['effect']!='READ'))
check('job_reauthorizes_target',all('JOB_REAUTHORIZE' in r['conditionIds'] and r.get('productRequirementSource')=='CURRENT_TARGET_OPERATION_RULE' for r in rules if r['operation']=='job.execute'))
check('projection_not_pure_read',next(r for r in rules if r['operation']=='supplier.report.read')['effect']=='READ' and next(r for r in rules if r['operation']=='supplier.report.project')['effect']=='WRITE')
check('costly_requests_require_product_usage_policy',all(r['usagePolicy']=='PRODUCT_POLICY' for r in rules if r['effect'] in ('REQUEST_COMPUTE','REQUEST_EXTERNAL')))
check('all_case_references_and_expected_values',all(c['ruleId'] in ruleids and c['expectedDecision'] in ('ALLOW','DENY') and (c['expectedReason'] is None if c['expectedDecision']=='ALLOW' else c['expectedReason'] in reasons) and c['executionStatus']=='SPECIFIED_NOT_RUNTIME_TESTED' for c in x['acceptanceCases']))
check('each_operation_has_positive_and_negative_scenario',all({c['expectedDecision'] for c in x['acceptanceCases'] if c['ruleId']==r['id']}=={'ALLOW','DENY'} for r in rules))
check('role_permission_references_resolve',all(set(r['permissions'])<=operations and set(r.get('grantableRoleTemplates',[]))<=roleids and set(r.get('manageableRoleTemplates',[]))<=roleids and set(r.get('maximumDirectGrantablePermissions',[]))<=operations for r in x['roleTemplates']))
admins=[r for r in x['roleTemplates'] if r['id'] in ('ORGANISATION_ADMIN','ORGANISATION_OWNER')]
check('admin_has_no_implicit_personal_or_product_read',all('personal.list.read' not in r['permissions'] and 'supplier.report.read' not in r['permissions'] for r in admins))
check('admin_cannot_grant_owner_or_platform_roles',all(not {'ORGANISATION_OWNER','PLATFORM_SUPPORT','SERVICE_PRINCIPAL'}&set(r.get('grantableRoleTemplates',[])) for r in admins))
check('admin_direct_grant_ceiling_excludes_charge_and_export',not {'forecast.request','supplier.report.refresh','supplier.report.export'}&set(next(r for r in admins if r['id']=='ORGANISATION_ADMIN')['maximumDirectGrantablePermissions']))
knownfeatures={r['feature'] for r in rules}
check('profile_features_resolve',all(set(p['maximumFeatures'])<=knownfeatures for p in x['applicationProfiles']))
standalone=next(p for p in x['applicationProfiles'] if p['id']=='SUPPLIER_INTELLIGENCE_STANDALONE')
check('standalone_does_not_enable_spendguru_features',not {'market','benchmark','category','forecast'}&set(standalone['maximumFeatures']))
check('porr_no_self_service_organisation_creation',not next(p for p in x['applicationProfiles'] if p['id']=='PORR_SUITE')['selfServiceOrganisationCreation'])
check('document_table_matches_every_json_rule',all(f"| {r['id']} | {r['operation']} |" in doc for r in rules))
check('document_counts_are_current',f"{len(rules)} operacji" in doc and f"{len(x['acceptanceCases'])} scenariuszy" in doc and f"OC-01–OC-{len(x['acceptanceCases'])}" in doc)
check('required_contract_sections_present',all(f'OC-R{i:02d}' in doc for i in range(1,18)))
manifest=json.loads((root/'Canon/registries/governance-manifest-v2.json').read_text())
entries={e['id']:e for e in manifest['documents']}
check('canonical_loading_for_all_consumer_profiles',all(set(entries[i]['appliesTo'])=={'SG2','SRM','ARCHITECTURE'} and entries[i]['status']=='ACTIVE' for i in ('operation-context-and-access-contract','operation-access-matrix')))
missing=[]
for p in [root/x['contractDocument'],root/'Canon/evidence/2026-10-16-operation-context-contract-acceptance.md']:
 if not p.exists():continue
 for link in re.findall(r'\]\(([^)]+)\)',p.read_text()):
  if not link.startswith(('https://','http://','#')) and not (p.parent/link.split('#')[0]).exists():missing.append(link)
check('relative_links_resolve',not missing)
check('no_credential_urls',not re.search(r'postgres(?:ql)?://',doc+registry.read_text()))
result={'status':'PASS','checks':checks,'checkCount':len(checks),'operationCount':len(rules),'specifiedCaseCount':len(x['acceptanceCases']),'runtimeAuthorizationCasesExecuted':0,'note':'Specification integrity checks only; no policy engine or consumer authorization implementation was executed.'}
print(json.dumps(result,ensure_ascii=False,indent=2))
```

## Wpływ na istniejące środowiska i raportowanie

Odczytano aktualne filtry trzech automatycznie wdrażanych usług Render: Vector rootDir apps/vector; PCOS ścieżki apps/pcos-explorer/** i packages/pcos-contracts/**; SG2 PMOS rootDir apps/pmos oraz apps/pmos/**, Canon/registries/profitia-projects-v1.json i render.yaml. Cztery ścieżki tego zadania nie odpowiadają tym zakresom. Workflow Governance preflight reaguje na Canon i wykonuje walidację; nie wykonuje deploymentu produktu.

Zadanie nie wymaga punktu rollbacku aplikacji, ponieważ nie ma deploymentu, migracji lub danych produktu. Poprzedni commit main jest zachowany; ewentualna korekta specyfikacji odbywa się przez nowy jawny commit/PR, bez przepisywania historii i bez cofania cudzej pracy. Rozróżnienie poprzedniego artefaktu LKG i pierwszego deploymentu pozostaje we właściwym kanonie wydań.

PMOS/PHR dotyczy tylko zadania ARCHITECTURE Development. Memoros jest disabled przez profil. Kanoniczny pmos:save ma zakończyć rejestrację, zweryfikować archiwum/kontekst i opublikować PHR; sukces jest potwierdzany osobnym odczytem bazy, remote PHR oraz zwolnieniem pending i lock. Wynik końcowy Git, CI, porównania wdrożeń oraz closeout jest utrwalony w tym rekordzie PMOS/PHR; dokument nie deklaruje ich z góry.

Ceny, liczbowe limity, wybór IdP i szczegóły ofert nie są rozstrzygane tym kontraktem. Reguła nieznanej polityki jest jednoznaczna: DENY, dopóki właściwy przyszły zakres nie dostarczy potwierdzonej polityki. Przyjęcie przez SG2/SRM i onboarding nowych aplikacji pozostają osobnymi zadaniami i nie rozpoczynają się po zakończeniu tego zapisu.
