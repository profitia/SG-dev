# Katalog możliwości EIA, CFTC i commodities.sh

Status: **METADATA_INVENTORY_COMPLETE**. Kompletność inwentaryzacji: **potwierdzona**.

Źródłem tej reprezentacji jest [jeden katalog JSON](../catalog/commodities-capabilities-v1.json). Zawiera pola, jednostki, trasy, częstotliwości, koszty, licencje i receipt każdego potwierdzenia. Metadane LIVE nie oznaczają przetestowania wszystkich szeregów ani historii.

| Provider | Pozycje | LIVE metadanych/operacji | Udokumentowane | Płatne, nieaktywne | Ograniczone / nieznane |
|---|---:|---:|---:|---:|---:|
| eia | 259 | 259 | 0 | 0 | 0 |
| cftc | 22 | 22 | 0 | 0 | 0 |
| commodities-sh | 33 | 4 | 8 | 19 | 2 |

## eia

Current authorized SourceHub metadata acquired; observation proof is separate

| Grupa / zbiór / endpoint | Status metadanych / operacji | Dane lub harmonogram LIVE | Pola | Częstotliwości | Koszt USD |
|---|---|---|---:|---|---|
| root / EIA API v2 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| coal / Coal / coal | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| crude-oil-imports / Crude Oil Imports / crude-oil-imports | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| electricity / Electricity / electricity | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| international / International / international | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, quarterly, annual | 0 |
| natural-gas / Natural Gas / natural-gas | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| nuclear-outages / Nuclear Outages / nuclear-outages | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| petroleum / Petroleum / petroleum | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| seds / State Energy Data System (SEDS) / seds | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| steo / Short Term Energy Outlook / steo | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual, quarterly, monthly | 0 |
| densified-biomass / Densified Biomass / densified-biomass | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| total-energy / Total Energy / total-energy | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual, monthly | 0 |
| aeo / Annual Energy Outlook / aeo | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| ieo / International Energy Outlook / ieo | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| co2-emissions / State CO2 Emissions- deprecated: see SEDS / co2-emissions | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| coal / Coal Shipments / coal/shipments | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| coal / Consumption and Quality / coal/consumption-and-quality | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 7 | quarterly, annual | 0 |
| coal / Aggregate Production / coal/aggregate-production | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 5 | annual | 0 |
| coal / Exports\Imports Quantity\Price / coal/exports-imports-quantity-price | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 2 | quarterly, annual | 0 |
| coal / Market Sales Price / coal/market-sales-price | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 2 | annual | 0 |
| coal / Mine Production / coal/mine-production | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 8 | annual | 0 |
| coal / Price by Rank / coal/price-by-rank | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| coal / Reserves Capacity / coal/reserves-capacity | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 3 | annual | 0 |
| electricity / Electricity Sales to Ultimate Customers / electricity/retail-sales | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 4 | monthly, quarterly, annual | 0 |
| electricity / Electric Power Operations (Annual and Monthly) / electricity/electric-power-operational-data | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 15 | monthly, quarterly, annual | 0 |
| electricity / Electric Power Operations (Daily and Hourly) / electricity/rto | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| electricity / State Specific Data / electricity/state-electricity-profiles | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| electricity / Inventory of Operable Generators / electricity/operating-generator-capacity | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 12 | monthly | 0 |
| electricity / Electric Power Operations for Individual Power Plants (Annual and Monthly) / electricity/facility-fuel | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 7 | monthly, quarterly, annual | 0 |
| natural-gas / Natural Gas, Summary / natural-gas/sum | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| natural-gas / Natural Gas, Prices / natural-gas/pri | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| natural-gas / Natural Gas, Exploration and Reserves / natural-gas/enr | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| natural-gas / Natural Gas, Production / natural-gas/prod | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| natural-gas / Natural Gas, Imports and Exports/Pipelines / natural-gas/move | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| natural-gas / Natural Gas, Storage / natural-gas/stor | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| natural-gas / Natural Gas, Consumption / End Use / natural-gas/cons | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| nuclear-outages / U.S. Nuclear Outages / nuclear-outages/us-nuclear-outages | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 3 | daily | 0 |
| nuclear-outages / Generator Level Nuclear Outages / nuclear-outages/generator-nuclear-outages | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 3 | daily | 0 |
| nuclear-outages / Facility Level Nuclear Outages / nuclear-outages/facility-nuclear-outages | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 3 | daily | 0 |
| petroleum / Petroleum, Summary / petroleum/sum | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| petroleum / Petroleum, Prices / petroleum/pri | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| petroleum / Petroleum, Crude Reserves and Production / petroleum/crd | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| petroleum / Petroleum, Refining and Processing / petroleum/pnp | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| petroleum / Petroleum, Imports/Exports and Movements / petroleum/move | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| petroleum / Petroleum, Stocks / petroleum/stoc | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| petroleum / Petroleum, Consumption/Sales / petroleum/cons | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| densified-biomass / Capacity by Region / densified-biomass/capacity-by-region | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 3 | monthly | 0 |
| densified-biomass / Sales and Price by Region / densified-biomass/sales-and-price-by-region | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 2 | monthly | 0 |
| densified-biomass / Export Sales and Price / densified-biomass/export-sales-and-price | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 2 | monthly | 0 |
| densified-biomass / Feedstocks and Costs / densified-biomass/feedstocks-and-cost | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 2 | monthly | 0 |
| densified-biomass / Production by Region / densified-biomass/production-by-region | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly | 0 |
| densified-biomass / Characteristics by Region / densified-biomass/characteristics-by-region | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 3 | monthly | 0 |
| densified-biomass / Inventories by Region / densified-biomass/inventories-by-region | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly | 0 |
| densified-biomass / Wood Pellet Plant Capacity / densified-biomass/wood-pellet-plants | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| aeo / AEO2026 / aeo/2026 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| aeo / AEO2025 / aeo/2025 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| aeo / AEO2023 / aeo/2023 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| aeo / AEO2022 / aeo/2022 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| aeo / AEO2021 / aeo/2021 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| aeo / AEO2020 / aeo/2020 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| aeo / AEO2019 / aeo/2019 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| aeo / AEO2018 / aeo/2018 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| aeo / AEO2017 / aeo/2017 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| aeo / AEO2016 / aeo/2016 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| aeo / AEO2015 / aeo/2015 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| aeo / AEO2014 / aeo/2014 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| aeo / AEO2014ER / aeo/2014-er | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| ieo / IEO2023 / ieo/2023 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| ieo / IEO2021 / ieo/2021 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| ieo / IEO2019 / ieo/2019 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| ieo / IEO2017 / ieo/2017 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| co2-emissions / Total CO2 Emissions by Sector and Fuel - deprecated: see SEDS / co2-emissions/co2-emissions-aggregates | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| co2-emissions / CO2 Emissions and Carbon Coefficients by Product - deprecated: see SEDS / co2-emissions/co2-emissions-and-carbon-coefficients | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 2 | annual | 0 |
| coal / Mine State Aggregates / coal/shipments/mine-state-aggregates | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 5 | quarterly, annual | 0 |
| coal / Receipts / coal/shipments/receipts | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 5 | quarterly, annual | 0 |
| coal / Mine Aggregates / coal/shipments/mine-aggregates | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 5 | quarterly, annual | 0 |
| coal / Plant State Aggregates / coal/shipments/plant-state-aggregates | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 5 | quarterly, annual | 0 |
| coal / Plant Aggregates / coal/shipments/plant-aggregates | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 5 | quarterly, annual | 0 |
| coal / By Mine, By Plant / coal/shipments/by-mine-by-plant | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 5 | quarterly, annual | 0 |
| electricity / Hourly Demand, Demand Forecast, Generation, and Interchange / electricity/rto/region-data | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | hourly, local-hourly | 0 |
| electricity / Hourly Generation by Energy Source / electricity/rto/fuel-type-data | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | hourly, local-hourly | 0 |
| electricity / Hourly Demand by Subregion / electricity/rto/region-sub-ba-data | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | hourly, local-hourly | 0 |
| electricity / Hourly Interchange by Neighboring Balancing Authority / electricity/rto/interchange-data | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | hourly, local-hourly | 0 |
| electricity / Daily Demand, Demand Forecast, Generation, and Interchange / electricity/rto/daily-region-data | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | daily | 0 |
| electricity / Daily Demand by Subregion / electricity/rto/daily-region-sub-ba-data | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | daily | 0 |
| electricity / Daily Generation by Energy Source / electricity/rto/daily-fuel-type-data | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | daily | 0 |
| electricity / Daily Interchange by Neighboring Balancing Authority / electricity/rto/daily-interchange-data | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | daily | 0 |
| electricity / Emissions from Energy Consumption at Conventional Power Plants and Combined-Heat-and-Power Plants / electricity/state-electricity-profiles/emissions-by-state-by-fuel | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 6 | annual | 0 |
| electricity /  Supply and disposition of electricity / electricity/state-electricity-profiles/source-disposition | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 21 | annual | 0 |
| electricity / Generating Capacity / electricity/state-electricity-profiles/capability | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| electricity / Costs and Savings from Energy Efficiency Programs / electricity/state-electricity-profiles/energy-efficiency | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 4 | annual | 0 |
| electricity / Electricity Net Metering: Customers and Capacity / electricity/state-electricity-profiles/net-metering | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 2 | annual | 0 |
| electricity / Advanced Metering Infrastructure / electricity/state-electricity-profiles/meters | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| electricity / State Rankings for Key Statistics / electricity/state-electricity-profiles/summary | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 35 | annual | 0 |
| natural-gas / natural-gas / natural-gas/sum/snd | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| natural-gas / natural-gas / natural-gas/sum/lsum | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| natural-gas / natural-gas / natural-gas/sum/sndm | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly | 0 |
| natural-gas / natural-gas / natural-gas/pri/sum | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| natural-gas / natural-gas / natural-gas/pri/fut | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, weekly, annual, daily | 0 |
| natural-gas / natural-gas / natural-gas/pri/rescom | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| natural-gas / natural-gas / natural-gas/enr/sum | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| natural-gas / natural-gas / natural-gas/enr/cplc | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| natural-gas / natural-gas / natural-gas/enr/dry | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| natural-gas / natural-gas / natural-gas/enr/wals | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| natural-gas / natural-gas / natural-gas/enr/nang | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| natural-gas / natural-gas / natural-gas/enr/adng | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| natural-gas / natural-gas / natural-gas/enr/ngl | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| natural-gas / natural-gas / natural-gas/enr/ngpl | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| natural-gas / natural-gas / natural-gas/enr/lc | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| natural-gas / natural-gas / natural-gas/enr/coalbed | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| natural-gas / natural-gas / natural-gas/enr/shalegas | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| natural-gas / natural-gas / natural-gas/enr/deep | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| natural-gas / natural-gas / natural-gas/enr/nprod | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| natural-gas / natural-gas / natural-gas/enr/drill | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| natural-gas / natural-gas / natural-gas/enr/wellend | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| natural-gas / natural-gas / natural-gas/enr/seis | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly | 0 |
| natural-gas / natural-gas / natural-gas/enr/wellfoot | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| natural-gas / natural-gas / natural-gas/enr/welldep | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| natural-gas / natural-gas / natural-gas/enr/wellcost | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| natural-gas / natural-gas / natural-gas/prod/oilwells | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| natural-gas / natural-gas / natural-gas/prod/sum | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| natural-gas / natural-gas / natural-gas/prod/whv | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| natural-gas / natural-gas / natural-gas/prod/off | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| natural-gas / natural-gas / natural-gas/prod/deep | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| natural-gas / natural-gas / natural-gas/prod/ngpl | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| natural-gas / natural-gas / natural-gas/prod/lc | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| natural-gas / natural-gas / natural-gas/prod/coalbed | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| natural-gas / natural-gas / natural-gas/prod/shalegas | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| natural-gas / natural-gas / natural-gas/prod/ss | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| natural-gas / natural-gas / natural-gas/prod/wells | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| natural-gas / natural-gas / natural-gas/prod/pp | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| natural-gas / natural-gas / natural-gas/move/impc | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| natural-gas / natural-gas / natural-gas/move/expc | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| natural-gas / natural-gas / natural-gas/move/state | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| natural-gas / natural-gas / natural-gas/move/poe1 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| natural-gas / natural-gas / natural-gas/move/poe2 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| natural-gas / natural-gas / natural-gas/move/ist | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| natural-gas / natural-gas / natural-gas/stor/wkly | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | weekly | 0 |
| natural-gas / natural-gas / natural-gas/stor/sum | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| natural-gas / natural-gas / natural-gas/stor/type | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| natural-gas / natural-gas / natural-gas/stor/lng | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| natural-gas / natural-gas / natural-gas/stor/cap | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| natural-gas / natural-gas / natural-gas/cons/sum | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| natural-gas / natural-gas / natural-gas/cons/num | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| natural-gas / natural-gas / natural-gas/cons/pns | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| natural-gas / natural-gas / natural-gas/cons/acct | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| natural-gas / natural-gas / natural-gas/cons/heat | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/sum/b100 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/sum/snd | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/sum/sndw | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | weekly, four-week-average | 0 |
| petroleum / petroleum / petroleum/sum/crdsnd | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/sum/mkt | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pri/gnd | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, weekly, annual | 0 |
| petroleum / petroleum / petroleum/pri/spt | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, weekly, annual, daily | 0 |
| petroleum / petroleum / petroleum/pri/fut | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, weekly, annual, daily | 0 |
| petroleum / petroleum / petroleum/pri/wfr | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, weekly | 0 |
| petroleum / petroleum / petroleum/pri/refmg | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pri/refmg2 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pri/refoth | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pri/allmg | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pri/dist | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pri/prop | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pri/resid | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pri/dfp1 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pri/dfp2 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pri/dfp3 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pri/rac2 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pri/imc1 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pri/imc2 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pri/imc3 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pri/land1 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pri/land2 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pri/land3 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pri/ipct | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/crd/pres | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| petroleum / petroleum / petroleum/crd/cplc | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| petroleum / petroleum / petroleum/crd/nprod | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| petroleum / petroleum / petroleum/crd/crpdn | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/crd/api | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly | 0 |
| petroleum / petroleum / petroleum/crd/gom | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| petroleum / petroleum / petroleum/crd/drill | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/crd/wellend | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/crd/seis | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly | 0 |
| petroleum / petroleum / petroleum/crd/wellfoot | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| petroleum / petroleum / petroleum/crd/welldep | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| petroleum / petroleum / petroleum/crd/wellcost | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| petroleum / petroleum / petroleum/pnp/wiup | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | weekly, four-week-average | 0 |
| petroleum / petroleum / petroleum/pnp/wprodrb | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | weekly, four-week-average | 0 |
| petroleum / petroleum / petroleum/pnp/wprodr | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | weekly, four-week-average | 0 |
| petroleum / petroleum / petroleum/pnp/wprodb | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | weekly, four-week-average | 0 |
| petroleum / petroleum / petroleum/pnp/wprode | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | weekly, four-week-average | 0 |
| petroleum / petroleum / petroleum/pnp/inpt | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pnp/inpt2 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pnp/inpt3 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pnp/refp | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pnp/refp2 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pnp/refp3 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pnp/oxy | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pnp/feedbiofuel | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly | 0 |
| petroleum / petroleum / petroleum/pnp/capbio | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly | 0 |
| petroleum / petroleum / petroleum/pnp/unc | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pnp/crq | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pnp/dwns | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pnp/pct | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/pnp/cap1 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| petroleum / petroleum / petroleum/pnp/capchg | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| petroleum / petroleum / petroleum/pnp/capprod | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| petroleum / petroleum / petroleum/pnp/capfuel | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| petroleum / petroleum / petroleum/pnp/feedng | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| petroleum / petroleum / petroleum/pnp/capwork | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| petroleum / petroleum / petroleum/pnp/capshell | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| petroleum / petroleum / petroleum/pnp/caprec | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| petroleum / petroleum / petroleum/pnp/bioplfuel | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| petroleum / petroleum / petroleum/pnp/gp | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/move/expcp | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/move/wkly | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | weekly, four-week-average | 0 |
| petroleum / petroleum / petroleum/move/wimpc | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | weekly, four-week-average | 0 |
| petroleum / petroleum / petroleum/move/imp | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/move/imp2 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/move/res | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/move/exp | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/move/expc | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/move/neti | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/move/imc1 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/move/imc2 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/move/imc3 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/move/land1 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/move/land2 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/move/land3 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/move/ipct | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/move/ptb | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/move/pipe | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/move/tb | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/move/netr | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/move/impcus | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/move/impcp | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/move/rail | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/move/railNA | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/stoc/ts | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/stoc/wstk | LIVE_VERIFIED | LIVE_VERIFIED | 1 | weekly | 0 |
| petroleum / petroleum / petroleum/stoc/typ | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/stoc/st | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/stoc/cu | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/stoc/ref | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/stoc/gp | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/cons/wpsup | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | weekly, four-week-average | 0 |
| petroleum / petroleum / petroleum/cons/psup | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/cons/prim | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/cons/refmg | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/cons/refoth | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/cons/refres | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | monthly, annual | 0 |
| petroleum / petroleum / petroleum/cons/821dst | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| petroleum / petroleum / petroleum/cons/821dsta | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| petroleum / petroleum / petroleum/cons/821rsd | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| petroleum / petroleum / petroleum/cons/821rsda | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| petroleum / petroleum / petroleum/cons/821ker | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| petroleum / petroleum / petroleum/cons/821kera | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| petroleum / petroleum / petroleum/cons/821use | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |
| petroleum / petroleum / petroleum/cons/821usea | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 1 | annual | 0 |

<details><summary>Pola: Crude Oil Imports (crude-oil-imports)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| quantity | number\|string\|null | thousand barrels | niepodane |

</details>

<details><summary>Pola: International (international)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: State Energy Data System (SEDS) (seds)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: Short Term Energy Outlook (steo)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: Total Energy (total-energy)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: Consumption and Quality (coal/consumption-and-quality)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| receipts | number\|string\|null | short tons | niepodane |
| consumption | number\|string\|null | short tons | niepodane |
| stocks | number\|string\|null | short tons | niepodane |
| price | number\|string\|null | dollars per short ton | niepodane |
| heat-content | number\|string\|null | average sulfur percent by weight | niepodane |
| sulfur-content | number\|string\|null | average sulfur percent by weight | niepodane |
| ash-content | number\|string\|null | average ash percent by weight | niepodane |

</details>

<details><summary>Pola: Aggregate Production (coal/aggregate-production)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| production | number\|string\|null | short tons | niepodane |
| number-of-mines | number\|string\|null | number of mines | niepodane |
| labor-hours | number\|string\|null | hours | niepodane |
| average-employees | number\|string\|null | number of employees | niepodane |
| productivity | number\|string\|null | short tons per labor hour | niepodane |

</details>

<details><summary>Pola: Exports\Imports Quantity\Price (coal/exports-imports-quantity-price)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| quantity | number\|string\|null | short tons | niepodane |
| price | number\|string\|null | dollars per short ton | niepodane |

</details>

<details><summary>Pola: Market Sales Price (coal/market-sales-price)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| sales | number\|string\|null | short tons | niepodane |
| price | number\|string\|null | dollars per short ton | niepodane |

</details>

<details><summary>Pola: Mine Production (coal/mine-production)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| production | number\|string\|null | short tons | niepodane |
| labor-hours | number\|string\|null | hours | niepodane |
| average-employees | number\|string\|null | number of employees | niepodane |
| refuse-flag | number\|string\|null | niepodane | niepodane |
| latitude | number\|string\|null | niepodane | niepodane |
| longitude | number\|string\|null | niepodane | niepodane |
| operating-company | number\|string\|null | niepodane | niepodane |
| operating-company-address | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: Price by Rank (coal/price-by-rank)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| price | number\|string\|null | dollars per short ton | niepodane |

</details>

<details><summary>Pola: Reserves Capacity (coal/reserves-capacity)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| productive-capacity | number\|string\|null | short tons | niepodane |
| recoverable-reserves | number\|string\|null | short tons | niepodane |
| producer-distributor-stocks | number\|string\|null | short tons | niepodane |

</details>

<details><summary>Pola: Electricity Sales to Ultimate Customers (electricity/retail-sales)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| revenue | number\|string\|null | million dollars | Revenue from Sales to Ultimate Customers |
| sales | number\|string\|null | million kilowatt hours | Megawatt-hours Sold to Ultimate Customers |
| price | number\|string\|null | cents per kilowatt-hour | Average Price of Electricity to Ultimate Customers |
| customers | number\|string\|null | number of customers | Number of Ultimate Customers |

</details>

<details><summary>Pola: Electric Power Operations (Annual and Monthly) (electricity/electric-power-operational-data)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| generation | number\|string\|null | niepodane | Utility Scale Electricity Net Generation |
| total-consumption | number\|string\|null | niepodane | Consumption of Fuels for Electricity Generation and Useful Thermal Output (Physical Units) |
| consumption-for-eg | number\|string\|null | niepodane | Consumption of Fuels for Electricity Generation (Physical Units) |
| consumption-uto | number\|string\|null | niepodane | Consumption of Fuels for Useful Thermal Output (Physical Units) |
| total-consumption-btu | number\|string\|null | niepodane | Consumption of Fuels for Electricity Generation and Useful Thermal Output (BTUs) |
| consumption-for-eg-btu | number\|string\|null | niepodane | Consumption of Fuels for Electricity Generation (BTUs) |
| consumption-uto-btu | number\|string\|null | niepodane | Consumption of Fuels for Useful Thermal Output (BTUs) |
| stocks | number\|string\|null | niepodane | Stocks of Fuel (Physical Units) |
| receipts | number\|string\|null | niepodane | Receipts of Fuel (Physical Units) |
| receipts-btu | number\|string\|null | niepodane | Receipts of Fuel (BTUs) |
| cost | number\|string\|null | niepodane | Average Cost of Fuels (per Physical Unit) |
| cost-per-btu | number\|string\|null | niepodane | Average Cost of Fuels (per BTU) |
| sulfur-content | number\|string\|null | niepodane | Average Sulfur Content of Consumed Fuel |
| ash-content | number\|string\|null | niepodane | Average Ash Content of Consumed Fuel |
| heat-content | number\|string\|null | niepodane | Average Heat Content of Consumed Fuels |

</details>

<details><summary>Pola: Inventory of Operable Generators (electricity/operating-generator-capacity)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| nameplate-capacity-mw | number\|string\|null | MW | Nameplate Capacity |
| net-summer-capacity-mw | number\|string\|null | MW | Net Summer Capacity |
| net-winter-capacity-mw | number\|string\|null | MW | Net Winter Capacity |
| operating-year-month | number\|string\|null | niepodane | Operating Date (Year and Month) |
| planned-retirement-year-month | number\|string\|null | niepodane | Planned Retirement Date (Year and Month) |
| planned-derate-year-month | number\|string\|null | niepodane | Planned Derate Date (Year and Month) |
| planned-derate-summer-cap-mw | number\|string\|null | MW | Magnitude of Planned Derate (Summer Capacity) |
| planned-uprate-year-month | number\|string\|null | niepodane | Planned Uprate Date (Year and Month) |
| planned-uprate-summer-cap-mw | number\|string\|null | MW | Magnitude of Planned Uprate (Summer Capacity) |
| county | number\|string\|null | niepodane | County |
| longitude | number\|string\|null | niepodane | Longitude |
| latitude | number\|string\|null | niepodane | Latitude |

</details>

<details><summary>Pola: Electric Power Operations for Individual Power Plants (Annual and Monthly) (electricity/facility-fuel)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| generation | number\|string\|null | megawatthours | Net Generation |
| gross-generation | number\|string\|null | megawatthours | Gross Generation |
| total-consumption | number\|string\|null | niepodane | Consumption of Fuels for Electricity Generation and Useful Thermal Output (Physical Units) |
| total-consumption-btu | number\|string\|null | MMBtu | Consumption of Fuels for Electricity Generation and Useful Thermal Output (BTUs) |
| consumption-for-eg | number\|string\|null | niepodane | Consumption of Fuels for Electricity Generation (Physical Units) |
| consumption-for-eg-btu | number\|string\|null | MMBtu | Consumption of Fuels for Electricity Generation (BTUs) |
| average-heat-content | number\|string\|null | niepodane | Average Heat Content of Consumed Fuels |

</details>

<details><summary>Pola: U.S. Nuclear Outages (nuclear-outages/us-nuclear-outages)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| capacity | number\|string\|null | megawatts | niepodane |
| outage | number\|string\|null | megawatts | niepodane |
| percentOutage | number\|string\|null | percent | niepodane |

</details>

<details><summary>Pola: Generator Level Nuclear Outages (nuclear-outages/generator-nuclear-outages)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| capacity | number\|string\|null | megawatts | niepodane |
| outage | number\|string\|null | megawatts | niepodane |
| percentOutage | number\|string\|null | percent | niepodane |

</details>

<details><summary>Pola: Facility Level Nuclear Outages (nuclear-outages/facility-nuclear-outages)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| capacity | number\|string\|null | megawatts | niepodane |
| outage | number\|string\|null | megawatts | niepodane |
| percentOutage | number\|string\|null | percent | niepodane |

</details>

<details><summary>Pola: Capacity by Region (densified-biomass/capacity-by-region)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| number-of-facilities | number\|string\|null | number of facilities | niepodane |
| capacity | number\|string\|null | tons | niepodane |
| number-of-fte-employees | number\|string\|null | number of fte employees | niepodane |

</details>

<details><summary>Pola: Sales and Price by Region (densified-biomass/sales-and-price-by-region)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| quantity | number\|string\|null | tons | niepodane |
| average-price | number\|string\|null | USD per ton | niepodane |

</details>

<details><summary>Pola: Export Sales and Price (densified-biomass/export-sales-and-price)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| quantity | number\|string\|null | tons | niepodane |
| average-price | number\|string\|null | USD per ton | niepodane |

</details>

<details><summary>Pola: Feedstocks and Costs (densified-biomass/feedstocks-and-cost)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| quantity | number\|string\|null | tons | niepodane |
| cost | number\|string\|null | USD per ton | niepodane |

</details>

<details><summary>Pola: Production by Region (densified-biomass/production-by-region)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| production | number\|string\|null | tons | niepodane |

</details>

<details><summary>Pola: Characteristics by Region (densified-biomass/characteristics-by-region)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| average-heat | number\|string\|null | btu/lb | niepodane |
| average-ash | number\|string\|null | percent by weight | niepodane |
| average-moisture | number\|string\|null | percent by weight | niepodane |

</details>

<details><summary>Pola: Inventories by Region (densified-biomass/inventories-by-region)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| inventory | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: Wood Pellet Plant Capacity (densified-biomass/wood-pellet-plants)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| capacity | number\|string\|null | tons per year | niepodane |

</details>

<details><summary>Pola: AEO2026 (aeo/2026)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: AEO2025 (aeo/2025)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: AEO2023 (aeo/2023)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: AEO2022 (aeo/2022)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: AEO2021 (aeo/2021)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: AEO2020 (aeo/2020)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: AEO2019 (aeo/2019)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: AEO2018 (aeo/2018)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: AEO2017 (aeo/2017)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: AEO2016 (aeo/2016)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: AEO2015 (aeo/2015)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: AEO2014 (aeo/2014)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: AEO2014ER (aeo/2014-er)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: IEO2023 (ieo/2023)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: IEO2021 (ieo/2021)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: IEO2019 (ieo/2019)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: IEO2017 (ieo/2017)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: Total CO2 Emissions by Sector and Fuel - deprecated: see SEDS (co2-emissions/co2-emissions-aggregates)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | million metric tons of CO2 | niepodane |

</details>

<details><summary>Pola: CO2 Emissions and Carbon Coefficients by Product - deprecated: see SEDS (co2-emissions/co2-emissions-and-carbon-coefficients)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| emissions | number\|string\|null | CO2 metric tons | niepodane |
| carbon-coefficient | number\|string\|null | Kilograms of CO2 per million Btu | niepodane |

</details>

<details><summary>Pola: Mine State Aggregates (coal/shipments/mine-state-aggregates)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| quantity | number\|string\|null | tons | niepodane |
| price | number\|string\|null | average dollars per ton | niepodane |
| heat-content | number\|string\|null | Btu per pound | niepodane |
| sulfur-content | number\|string\|null | percent by weight | niepodane |
| ash-content | number\|string\|null | percent by weight | niepodane |

</details>

<details><summary>Pola: Receipts (coal/shipments/receipts)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| quantity | number\|string\|null | tons | niepodane |
| price | number\|string\|null | average dollars per ton | niepodane |
| heat-content | number\|string\|null | Btu per pound | niepodane |
| sulfur-content | number\|string\|null | percent by weight | niepodane |
| ash-content | number\|string\|null | percent by weight | niepodane |

</details>

<details><summary>Pola: Mine Aggregates (coal/shipments/mine-aggregates)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| quantity | number\|string\|null | tons | niepodane |
| price | number\|string\|null | average dollars per ton | niepodane |
| heat-content | number\|string\|null | Btu per pound | niepodane |
| sulfur-content | number\|string\|null | percent by weight | niepodane |
| ash-content | number\|string\|null | percent by weight | niepodane |

</details>

<details><summary>Pola: Plant State Aggregates (coal/shipments/plant-state-aggregates)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| quantity | number\|string\|null | tons | niepodane |
| price | number\|string\|null | average dollars per ton | niepodane |
| heat-content | number\|string\|null | Btu per pound | niepodane |
| sulfur-content | number\|string\|null | percent by weight | niepodane |
| ash-content | number\|string\|null | percent by weight | niepodane |

</details>

<details><summary>Pola: Plant Aggregates (coal/shipments/plant-aggregates)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| quantity | number\|string\|null | tons | niepodane |
| price | number\|string\|null | average dollars per ton | niepodane |
| sulfur-content | number\|string\|null | percent by weight | niepodane |
| ash-content | number\|string\|null | percent by weight | niepodane |
| heat-content | number\|string\|null | Btu per pound | niepodane |

</details>

<details><summary>Pola: By Mine, By Plant (coal/shipments/by-mine-by-plant)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| quantity | number\|string\|null | tons | niepodane |
| price | number\|string\|null | average dollars per ton | niepodane |
| sulfur-content | number\|string\|null | percent by weight | niepodane |
| ash-content | number\|string\|null | percent by weight | niepodane |
| heat-content | number\|string\|null | Btu per pound | niepodane |

</details>

<details><summary>Pola: Hourly Demand, Demand Forecast, Generation, and Interchange (electricity/rto/region-data)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | megawatthours | Demand, Demand Forecast, Net Generation, or Interchange |

</details>

<details><summary>Pola: Hourly Generation by Energy Source (electricity/rto/fuel-type-data)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | megawatthours | Net Generation |

</details>

<details><summary>Pola: Hourly Demand by Subregion (electricity/rto/region-sub-ba-data)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | megawatthours | Demand |

</details>

<details><summary>Pola: Hourly Interchange by Neighboring Balancing Authority (electricity/rto/interchange-data)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | megawatthours | Interchange |

</details>

<details><summary>Pola: Daily Demand, Demand Forecast, Generation, and Interchange (electricity/rto/daily-region-data)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | megawatthours | Demand, Demand Forecast, Net Generation, or Interchange |

</details>

<details><summary>Pola: Daily Demand by Subregion (electricity/rto/daily-region-sub-ba-data)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | megawatthours | Demand |

</details>

<details><summary>Pola: Daily Generation by Energy Source (electricity/rto/daily-fuel-type-data)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | megawatthours | Net Generation |

</details>

<details><summary>Pola: Daily Interchange by Neighboring Balancing Authority (electricity/rto/daily-interchange-data)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | megawatthours | Interchange |

</details>

<details><summary>Pola: Emissions from Energy Consumption at Conventional Power Plants and Combined-Heat-and-Power Plants (electricity/state-electricity-profiles/emissions-by-state-by-fuel)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| so2-rate-lbs-mwh | number\|string\|null | pounds per megawatthour | SO2 Emissions Rate per MWh |
| so2-short-tons | number\|string\|null | short tons | SO2 Emissions |
| nox-rate-lbs-mwh | number\|string\|null | pounds per megawatthour | NOx Emissions Rate per MWh |
| nox-short-tons | number\|string\|null | short tons | NOx Emissions |
| co2-rate-lbs-mwh | number\|string\|null | pounds per megawatthour | CO2 Emissions Rate per MWh |
| co2-thousand-metric-tons | number\|string\|null | thousand metric tons | CO2 Emissions |

</details>

<details><summary>Pola:  Supply and disposition of electricity (electricity/state-electricity-profiles/source-disposition)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| electric-utilities | number\|string\|null | megawatthours | Net Generation from Electric Utilities |
| independent-power-producers | number\|string\|null | megawatthours | Net Generation from Independent Power Producers, Non-Combined Heat and Power |
| combined-heat-and-pwr-elect | number\|string\|null | megawatthours | Net Generation from Independent Power Producers, Combined Heat and Power |
| elect-pwr-sector-gen-subtotal | number\|string\|null | megawatthours | Net Generation from Electric Power Sector |
| combined-heat-and-pwr-comm | number\|string\|null | megawatthours | Net Generation from Commercial Sector |
| combined-heat-and-pwr-indust | number\|string\|null | megawatthours | Net Generation from Industrial Sector |
| indust-and-comm-gen-subtotal | number\|string\|null | megawatthours | Net Generation from Industrial and Commercial Sectors |
| total-net-generation | number\|string\|null | megawatthours | Net Generation from All Sectors |
| total-international-imports | number\|string\|null | megawatthours | Total International Imports |
| total-supply | number\|string\|null | megawatthours | Total Supply |
| full-service-providers | number\|string\|null | megawatthours | Retail Sales of Electricity by Full Service Providers |
| energy-only-providers | number\|string\|null | megawatthours | Retail Sales of Electrcity by Energy-Only Providers |
| facility-direct | number\|string\|null | megawatthours | Retail Sales of Electricity Sold Directly by Commercial and Industrial Facilities |
| total-elect-indust | number\|string\|null | megawatthours | Retail Sales of Electricity, Total Electric Industry |
| direct-use | number\|string\|null | megawatthours | Direct Use of Generation by Commercial and Industrial Facilities |
| total-international-exports | number\|string\|null | megawatthours | Total International Exports |
| estimated-losses | number\|string\|null | megawatthours | Estimated Losses Incurred in Transmission and Distribution |
| net-interstate-trade | number\|string\|null | megawatthours | Net Interstate Imports |
| unaccounted | number\|string\|null | megawatthours | Unaccounted Electricity |
| total-disposition | number\|string\|null | megawatthours | Total Disposition |
| net-trade-index | number\|string\|null | ratio | Net Trade Index Ratio |

</details>

<details><summary>Pola: Generating Capacity (electricity/state-electricity-profiles/capability)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| capability | number\|string\|null | megawatts | Net Summer Capacity  |

</details>

<details><summary>Pola: Costs and Savings from Energy Efficiency Programs (electricity/state-electricity-profiles/energy-efficiency)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| energy-savings | number\|string\|null | megawatthours | Annual Energy Savings |
| potential-peak-savings | number\|string\|null | megawatts | Peak Demand Savings |
| customer-incentive | number\|string\|null | thousand dollars | Cost of Customer Incentives |
| all-other-costs | number\|string\|null | thousand dollars | All Other Costs |

</details>

<details><summary>Pola: Electricity Net Metering: Customers and Capacity (electricity/state-electricity-profiles/net-metering)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| capacity | number\|string\|null | megawatts | niepodane |
| customers | number\|string\|null | number of customers | Customer Count |

</details>

<details><summary>Pola: Advanced Metering Infrastructure (electricity/state-electricity-profiles/meters)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| meters | number\|string\|null | number of meters | Meter Count |

</details>

<details><summary>Pola: State Rankings for Key Statistics (electricity/state-electricity-profiles/summary)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| net-summer-capacity | number\|string\|null | megawatts | Net Summer Capacity, All Sectors |
| net-summer-capacity-rank | number\|string\|null | rank | Net Summer Capacity, All Sectors (U.S. Rank) |
| capacity-elec-utilities | number\|string\|null | megawatts | Net Summer Capacity, Electric Power Sector |
| capacity-elect-utilities-rank | number\|string\|null | rank | Average Retail Price of Electricity (U.S. Rank) |
| capacity-ipp | number\|string\|null | megawatts | Net Summer Capacity, Independent Power Producers and Industrial / Commercial Sectors |
| capacity-ipp-rank | number\|string\|null | rank | Net Summer Capacity, Independent Power Producers and Industrial / Commercial Sectors (U.S. Rank) |
| net-generation | number\|string\|null | megawatthours | Net Generation, All Sectors |
| net-generation-rank | number\|string\|null | rank | Net Generation, All Sectors (U.S. Rank) |
| generation-elect-utils | number\|string\|null | megawatthours | Net Generation, Electric Power Sector |
| generation-elect-utils-rank | number\|string\|null | rank | Net Generation, Electric Power Sector (U.S. Rank) |
| generation-ipp | number\|string\|null | megawatthours | Net Generation, Independent Power Producers and Industrial / Commercial Sectors |
| generation-ipp-rank | number\|string\|null | rank | Net Generation, Independent Power Producers and Industrial / Commercial Sectors (U.S. Rank) |
| sulfer-dioxide | number\|string\|null | short tons | SO2 Emissions |
| sulfer-dioxide-rank | number\|string\|null | rank | SO2 Emissions (U.S. Rank) |
| nitrogen-oxide | number\|string\|null | short tons | NOx Emissions |
| nitrogen-oxide-rank | number\|string\|null | rank | NOx Emissions (U.S. Rank) |
| carbon-dioxide | number\|string\|null | thousand metric tons | CO2 Emissions |
| carbon-dioxide-rank | number\|string\|null | rank | CO2 Emissions (U.S. Rank) |
| sulfer-dioxide-lbs | number\|string\|null | pounds per megawatthour | SO2 Emissions Rate per MWh |
| sulfer-dioxide-rank-lbs | number\|string\|null | rank | SO2 Emissions Rate per MWh (U.S. Rank) |
| nitrogen-oxide-lbs | number\|string\|null | pounds per megawatthour | NOx Emissions Rate per MWh |
| nitrogen-oxide-rank-lbs | number\|string\|null | rank | NOx Emissions Rate per MWh (U.S. Rank) |
| carbon-dioxide-lbs | number\|string\|null | pounds per megawatthour | CO2 Emissions Rate per MWh |
| carbon-dioxide-rank-lbs | number\|string\|null | rank | CO2 Emissions Rate per MWh (U.S. Rank) |
| total-retail-sales | number\|string\|null | megawatthours | Retail Sales of Electricity, Total Electric Industry  |
| total-retail-sales-rank | number\|string\|null | rank | Retail Sales of Electricity, Total Electric Industry (U.S. Rank) |
| fsp-service-provider-sales | number\|string\|null | megawatthours | Retail Sales of Electrcity by Full Service Providers and Electricity Sold Directly by Commercial and Industrial  Facilities |
| fsp-sales-rank | number\|string\|null | rank | Retail Sales of Electrcity by Full Service Providers and Electricity Sold Directly by Commercial and Industrial Facilities (U.S. Rank) |
| eop-sales | number\|string\|null | megawatthours | Retail Sales of Electrcity by Energy-Only Providers |
| eop-sales-rank | number\|string\|null | rank | Retail Sales of Electrcity by Energy-Only Providers (U.S. Rank) |
| direct-use | number\|string\|null | megawatthours | Direct Use of Generation by Commercial and Industrial Facilities |
| direct-use-rank | number\|string\|null | rank | Direct Use of Generation by Commercial and Industrial Facilities (U.S. Rank) |
| average-retail-price | number\|string\|null | cents per kilowatthour | Average Retail Price of Electricity |
| average-retail-price-rank | number\|string\|null | rank | Average Retail Price of Electricity (U.S. Rank) |
| prime-source | number\|string\|null | niepodane | Prime Source |

</details>

<details><summary>Pola: natural-gas (natural-gas/sum/snd)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/sum/lsum)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/sum/sndm)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/pri/sum)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/pri/fut)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/pri/rescom)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/enr/sum)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/enr/cplc)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/enr/dry)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/enr/wals)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/enr/nang)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/enr/adng)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/enr/ngl)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/enr/ngpl)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/enr/lc)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/enr/coalbed)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/enr/shalegas)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/enr/deep)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/enr/nprod)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/enr/drill)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/enr/wellend)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/enr/seis)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/enr/wellfoot)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/enr/welldep)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/enr/wellcost)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/prod/oilwells)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/prod/sum)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/prod/whv)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/prod/off)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/prod/deep)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/prod/ngpl)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/prod/lc)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/prod/coalbed)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/prod/shalegas)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/prod/ss)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/prod/wells)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/prod/pp)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/move/impc)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/move/expc)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/move/state)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/move/poe1)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/move/poe2)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/move/ist)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/stor/wkly)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/stor/sum)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/stor/type)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/stor/lng)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/stor/cap)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/cons/sum)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/cons/num)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/cons/pns)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/cons/acct)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: natural-gas (natural-gas/cons/heat)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/sum/b100)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/sum/snd)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/sum/sndw)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/sum/crdsnd)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/sum/mkt)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pri/gnd)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pri/spt)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pri/fut)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pri/wfr)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pri/refmg)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pri/refmg2)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pri/refoth)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pri/allmg)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pri/dist)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pri/prop)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pri/resid)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pri/dfp1)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pri/dfp2)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pri/dfp3)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pri/rac2)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pri/imc1)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pri/imc2)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pri/imc3)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pri/land1)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pri/land2)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pri/land3)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pri/ipct)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/crd/pres)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/crd/cplc)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/crd/nprod)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/crd/crpdn)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/crd/api)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/crd/gom)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/crd/drill)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/crd/wellend)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/crd/seis)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/crd/wellfoot)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/crd/welldep)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/crd/wellcost)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pnp/wiup)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pnp/wprodrb)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pnp/wprodr)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pnp/wprodb)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pnp/wprode)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pnp/inpt)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pnp/inpt2)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pnp/inpt3)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pnp/refp)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pnp/refp2)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pnp/refp3)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pnp/oxy)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pnp/feedbiofuel)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pnp/capbio)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pnp/unc)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pnp/crq)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pnp/dwns)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pnp/pct)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pnp/cap1)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pnp/capchg)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pnp/capprod)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pnp/capfuel)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pnp/feedng)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pnp/capwork)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pnp/capshell)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pnp/caprec)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pnp/bioplfuel)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/pnp/gp)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/move/expcp)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/move/wkly)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/move/wimpc)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/move/imp)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/move/imp2)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/move/res)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/move/exp)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/move/expc)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/move/neti)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/move/imc1)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/move/imc2)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/move/imc3)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/move/land1)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/move/land2)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/move/land3)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/move/ipct)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/move/ptb)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/move/pipe)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/move/tb)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/move/netr)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/move/impcus)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/move/impcp)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/move/rail)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/move/railNA)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/stoc/ts)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/stoc/wstk)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/stoc/typ)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/stoc/st)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/stoc/cu)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/stoc/ref)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/stoc/gp)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/cons/wpsup)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/cons/psup)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/cons/prim)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/cons/refmg)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/cons/refoth)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/cons/refres)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/cons/821dst)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/cons/821dsta)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/cons/821rsd)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/cons/821rsda)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/cons/821ker)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/cons/821kera)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/cons/821use)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

<details><summary>Pola: petroleum (petroleum/cons/821usea)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| value | number\|string\|null | niepodane | niepodane |

</details>

Dokumentacja: [źródło](https://www.eia.gov/opendata/documentation.php), [źródło](https://www.eia.gov/opendata/terms-of-service.php)

## cftc

Current authorized SourceHub metadata acquired; observation proof is separate

| Grupa / zbiór / endpoint | Status metadanych / operacji | Dane lub harmonogram LIVE | Pola | Częstotliwości | Koszt USD |
|---|---|---|---:|---|---|
| Reference / taxonomy / Public Reporting FAQ / inwp-fmhz | LIVE_VERIFIED | UNAVAILABLE_OR_UNKNOWN | 0 | weekly | 0 |
| Reference / taxonomy / User's Guide / p2fg-u73y | LIVE_VERIFIED | UNAVAILABLE_OR_UNKNOWN | 0 | weekly | 0 |
| Supplemental / Supplemental - CIT / 4zgm-a668 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 60 | weekly | 0 |
| Traders in Financial Futures / TFF - Combined / yw9f-hn96 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 90 | weekly | 0 |
| Traders in Financial Futures / TFF - Futures Only / gpe5-46if | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 90 | weekly | 0 |
| Disaggregated / Disaggregated - Combined / kh3c-gbw2 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 194 | weekly | 0 |
| Disaggregated / Disaggregated - Futures Only / 72hh-3qpy | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 194 | weekly | 0 |
| Legacy / Legacy - Combined / jun7-fc8e | LIVE_VERIFIED | LIVE_VERIFIED | 133 | weekly | 0 |
| Legacy / Legacy - Futures Only / 6dca-aqww | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 133 | weekly | 0 |
| Supplemental / Supplemental - CIT / rxj2-hk38 | LIVE_VERIFIED | UNAVAILABLE_OR_UNKNOWN | 0 | weekly | 0 |
| Traders in Financial Futures / TFF - Combined / dw8z-x6ih | LIVE_VERIFIED | UNAVAILABLE_OR_UNKNOWN | 0 | weekly | 0 |
| Traders in Financial Futures / TFF - Futures Only / 98ig-3k9y | LIVE_VERIFIED | UNAVAILABLE_OR_UNKNOWN | 0 | weekly | 0 |
| Disaggregated / Disaggregated - Combined / gr4m-cvuh | LIVE_VERIFIED | UNAVAILABLE_OR_UNKNOWN | 0 | weekly | 0 |
| Disaggregated / Disaggregated - Futures Only / ubmb-6exi | LIVE_VERIFIED | UNAVAILABLE_OR_UNKNOWN | 0 | weekly | 0 |
| Legacy / Legacy - Combined / 8jj7-5vf4 | LIVE_VERIFIED | UNAVAILABLE_OR_UNKNOWN | 0 | weekly | 0 |
| Legacy / Legacy - Futures Only / yjak-hhbj | LIVE_VERIFIED | UNAVAILABLE_OR_UNKNOWN | 0 | weekly | 0 |
| Reference / taxonomy / Commitments of Traders / r4w3-av2u | LIVE_VERIFIED | UNAVAILABLE_OR_UNKNOWN | 0 | weekly | 0 |
| Reference / taxonomy / ProductHierarchy / rj6x-va3z | LIVE_VERIFIED | UNAVAILABLE_OR_UNKNOWN | 4 | weekly | 0 |
| Legacy / Legacy_All / srt6-5q2f | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 130 | weekly | 0 |
| Disaggregated / Disaggregated_All / rxbv-e226 | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 191 | weekly | 0 |
| Traders in Financial Futures / TFF_All / udgc-27he | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 87 | weekly | 0 |
| Supplemental / CIT_All / j83k-qyrd | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 57 | weekly | 0 |

<details><summary>Pola: Supplemental - CIT (4zgm-a668)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| id | text | niepodane | ID |
| market_and_exchange_names | text | niepodane | Market_and_Exchange_Names |
| report_date_as_yyyy_mm_dd | calendar_date | niepodane | Report_Date_as_YYYY_MM_DD |
| cftc_contract_market_code | text | niepodane | CFTC_Contract_Market_Code |
| contract_market_name | text | niepodane | CONTRACT_MARKET_NAME |
| yyyy_report_week_ww | text | niepodane | YYYY Report Week WW |
| cftc_market_code | text | niepodane | CFTC_Market_Code |
| cftc_region_code | text | niepodane | CFTC_Region_Code |
| cftc_commodity_code | text | niepodane | CFTC_Commodity_Code |
| commodity_name | text | niepodane | Commodity Name |
| open_interest_all | number | niepodane | Open_Interest_All |
| ncomm_postions_long_all_nocit | number | niepodane | ncomm_postions_long_all_nocit |
| ncomm_postions_short_all_nocit | number | niepodane | ncomm_postions_short_all_nocit |
| ncomm_postions_spread_all_nocit | number | niepodane | ncomm_postions_spread_all_nocit |
| comm_positions_long_all_nocit | number | niepodane | Comm_Positions_Long_All_NoCIT |
| comm_positions_short_all_nocit | number | niepodane | comm_positions_short_all_nocit |
| tot_rept_positions_long_all | number | niepodane | Tot_Rept_Positions_Long_All |
| tot_rept_positions_short | number | niepodane | Tot_Rept_Positions_Short_All |
| nonrept_positions_long_all | number | niepodane | NonRept_Positions_Long_All |
| nonrept_positions_short_all | number | niepodane | NonRept_Positions_Short_All |
| cit_positions_long_all | number | niepodane | CIT_Positions_Long_All |
| cit_positions_short_all | number | niepodane | CIT_Positions_Short_All |
| change_open_interest_all | number | niepodane | Change_Open_Interest_All |
| change_noncomm_long_all_nocit | number | niepodane | Change_NonComm_Long_All_NoCIT |
| change_noncomm_short_all_nocit | number | niepodane | change_noncomm_short_all_nocit |
| change_noncomm_spead_all_nocit | number | niepodane | change_noncomm_spead_all_nocit |
| change_comm_long_all_nocit | number | niepodane | Change_Comm_Long_All_NoCIT |
| change_comm_short_all_nocit | number | niepodane | Change_Comm_Short_All_NoCIT |
| change_tot_rept_long_all | number | niepodane | Change_Tot_Rept_Long_All |
| change_tot_rept_short_all | number | niepodane | Change_Tot_Rept_Short_All |
| change_nonrept_long_all | number | niepodane | Change_NonRept_Long_All |
| change_nonrept_short_all | number | niepodane | Change_NonRept_Short_All |
| change_cit_long_all | number | niepodane | Change_CIT_Long_All |
| change_cit_short_all | number | niepodane | Change_CIT_Short_All |
| pct_open_interest_all | number | niepodane | Pct_Open_Interest_All |
| pct_oi_noncomm_long_all_nocit | number | niepodane | Pct_OI_NonComm_Long_All_NoCIT |
| pct_oi_noncomm_short_all_nocit | number | niepodane | pct_oi_noncomm_short_all_nocit |
| pct_oi_noncomm_spread_all_nocit | number | niepodane | pct_oi_noncomm_spread_all_nocit |
| pct_oi_comm_long_all_nocit | number | niepodane | Pct_OI_Comm_Long_All_NoCIT |
| pct_oi_comm_short_all_nocit | number | niepodane | Pct_OI_Comm_Short_All_NoCIT |
| pct_oi_tot_rept_long_all_nocit | number | niepodane | pct_oi_tot_rept_long_all_nocit |
| pct_oi_tot_rept_short_all_nocit | number | niepodane | pct_oi_tot_rept_short_all_nocit |
| pct_oi_nonrept_long_all_nocit | number | niepodane | Pct_OI_NonRept_Long_All_NoCIT |
| pct_oi_nonrept_short_all_nocit | number | niepodane | pct_oi_nonrept_short_all_nocit |
| pct_oi_cit_long_all | number | niepodane | Pct_OI_CIT_Long_All |
| pct_oi_cit_short_all | number | niepodane | Pct_OI_CIT_Short_All |
| traders_tot_all | number | niepodane | Traders_Tot_All |
| traders_noncomm_long_all_nocit | number | niepodane | traders_noncomm_long_all_nocit |
| traders_noncomm_short_all_nocit | number | niepodane | traders_noncomm_short_all_nocit |
| traders_noncomm_spread_all_nocit | number | niepodane | traders_noncomm_spread_all_nocit |
| traders_comm_long_all_nocit | number | niepodane | Traders_Comm_Long_All_NoCIT |
| traders_comm_short_all_nocit | number | niepodane | Traders_Comm_Short_All_NoCIT |
| traders_tot_rept_long_all_nocit | number | niepodane | traders_tot_rept_long_all_nocit |
| traders_tot_rept_short_all_nocit | number | niepodane | traders_tot_rept_short_all_nocit |
| traders_cit_long_all | number | niepodane | Traders_CIT_Long_All |
| traders_cit_short_all | number | niepodane | Traders_CIT_Short_All |
| contract_units | text | niepodane | Contract_Units |
| commodity | text | niepodane | COMMODITY_NAME |
| commodity_subgroup_name | text | niepodane | COMMODITY_SUBGROUP_NAME |
| commodity_group_name | text | niepodane | COMMODITY_GROUP_NAME |

</details>

<details><summary>Pola: TFF - Combined (yw9f-hn96)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| id | text | niepodane | ID |
| market_and_exchange_names | text | niepodane | Market_and_Exchange_Names |
| report_date_as_yyyy_mm_dd | calendar_date | niepodane | Report_Date_as_YYYY_MM_DD |
| yyyy_report_week_ww | text | niepodane | YYYY Report Week WW |
| contract_market_name | text | niepodane | CONTRACT_MARKET_NAME |
| cftc_contract_market_code | text | niepodane | CFTC_Contract_Market_Code |
| cftc_market_code | text | niepodane | CFTC_Market_Code |
| cftc_region_code | text | niepodane | CFTC_Region_Code |
| cftc_commodity_code | text | niepodane | CFTC_Commodity_Code |
| commodity_name | text | niepodane | Commodity Name |
| open_interest_all | number | niepodane | Open_Interest_All |
| dealer_positions_long_all | number | niepodane | Dealer_Positions_Long_All |
| dealer_positions_short_all | number | niepodane | Dealer_Positions_Short_All |
| dealer_positions_spread_all | number | niepodane | Dealer_Positions_Spread_All |
| asset_mgr_positions_long | number | niepodane | Asset_Mgr_Positions_Long_All |
| asset_mgr_positions_short | number | niepodane | Asset_Mgr_Positions_Short_All |
| asset_mgr_positions_spread | number | niepodane | Asset_Mgr_Positions_Spread_All |
| lev_money_positions_long | number | niepodane | Lev_Money_Positions_Long_All |
| lev_money_positions_short | number | niepodane | Lev_Money_Positions_Short_All |
| lev_money_positions_spread | number | niepodane | Lev_Money_Positions_Spread_All |
| other_rept_positions_long | number | niepodane | Other_Rept_Positions_Long_All |
| other_rept_positions_short | number | niepodane | Other_Rept_Positions_Short_All |
| other_rept_positions_spread | number | niepodane | Other_Rept_Positions_Spread_All |
| tot_rept_positions_long_all | number | niepodane | Tot_Rept_Positions_Long_All |
| tot_rept_positions_short | number | niepodane | Tot_Rept_Positions_Short_All |
| nonrept_positions_long_all | number | niepodane | NonRept_Positions_Long_All |
| nonrept_positions_short_all | number | niepodane | NonRept_Positions_Short_All |
| change_in_open_interest_all | number | niepodane | Change_in_Open_Interest_All |
| change_in_dealer_long_all | number | niepodane | Change_in_Dealer_Long_All |
| change_in_dealer_short_all | number | niepodane | Change_in_Dealer_Short_All |
| change_in_dealer_spread_all | number | niepodane | Change_in_Dealer_Spread_All |
| change_in_asset_mgr_long | number | niepodane | Change_in_Asset_Mgr_Long_All |
| change_in_asset_mgr_short | number | niepodane | Change_in_Asset_Mgr_Short_All |
| change_in_asset_mgr_spread | number | niepodane | Change_in_Asset_Mgr_Spread_All |
| change_in_lev_money_long | number | niepodane | Change_in_Lev_Money_Long_All |
| change_in_lev_money_short | number | niepodane | Change_in_Lev_Money_Short_All |
| change_in_lev_money_spread | number | niepodane | Change_in_Lev_Money_Spread_All |
| change_in_other_rept_long | number | niepodane | Change_in_Other_Rept_Long_All |
| change_in_other_rept_short | number | niepodane | Change_in_Other_Rept_Short_All |
| change_in_other_rept_spread | number | niepodane | Change_in_Other_Rept_Spread_All |
| change_in_tot_rept_long_all | number | niepodane | Change_in_Tot_Rept_Long_All |
| change_in_tot_rept_short | number | niepodane | Change_in_Tot_Rept_Short_All |
| change_in_nonrept_long_all | number | niepodane | Change_in_NonRept_Long_All |
| change_in_nonrept_short_all | number | niepodane | Change_in_NonRept_Short_All |
| pct_of_open_interest_all | number | niepodane | Pct_of_Open_Interest_All |
| pct_of_oi_dealer_long_all | number | niepodane | Pct_of_OI_Dealer_Long_All |
| pct_of_oi_dealer_short_all | number | niepodane | Pct_of_OI_Dealer_Short_All |
| pct_of_oi_dealer_spread_all | number | niepodane | Pct_of_OI_Dealer_Spread_All |
| pct_of_oi_asset_mgr_long | number | niepodane | Pct_of_OI_Asset_Mgr_Long_All |
| pct_of_oi_asset_mgr_short | number | niepodane | Pct_of_OI_Asset_Mgr_Short_All |
| pct_of_oi_asset_mgr_spread | number | niepodane | Pct_of_OI_Asset_Mgr_Spread_All |
| pct_of_oi_lev_money_long | number | niepodane | Pct_of_OI_Lev_Money_Long_All |
| pct_of_oi_lev_money_short | number | niepodane | Pct_of_OI_Lev_Money_Short_All |
| pct_of_oi_lev_money_spread | number | niepodane | Pct_of_OI_Lev_Money_Spread_All |
| pct_of_oi_other_rept_long | number | niepodane | Pct_of_OI_Other_Rept_Long_All |
| pct_of_oi_other_rept_short | number | niepodane | Pct_of_OI_Other_Rept_Short_All |
| pct_of_oi_other_rept_spread | number | niepodane | Pct_of_OI_Other_Rept_Spread_All |
| pct_of_oi_tot_rept_long_all | number | niepodane | Pct_of_OI_Tot_Rept_Long_All |
| pct_of_oi_tot_rept_short | number | niepodane | Pct_of_OI_Tot_Rept_Short_All |
| pct_of_oi_nonrept_long_all | number | niepodane | Pct_of_OI_NonRept_Long_All |
| pct_of_oi_nonrept_short_all | number | niepodane | Pct_of_OI_NonRept_Short_All |
| traders_tot_all | number | niepodane | Traders_Tot_All |
| traders_dealer_long_all | number | niepodane | Traders_Dealer_Long_All |
| traders_dealer_short_all | number | niepodane | Traders_Dealer_Short_All |
| traders_dealer_spread_all | number | niepodane | Traders_Dealer_Spread_All |
| traders_asset_mgr_long_all | number | niepodane | Traders_Asset_Mgr_Long_All |
| traders_asset_mgr_short_all | number | niepodane | Traders_Asset_Mgr_Short_All |
| traders_asset_mgr_spread | number | niepodane | Traders_Asset_Mgr_Spread_All |
| traders_lev_money_long_all | number | niepodane | Traders_Lev_Money_Long_All |
| traders_lev_money_short_all | number | niepodane | Traders_Lev_Money_Short_All |
| traders_lev_money_spread | number | niepodane | Traders_Lev_Money_Spread_All |
| traders_other_rept_long_all | number | niepodane | Traders_Other_Rept_Long_All |
| traders_other_rept_short | number | niepodane | Traders_Other_Rept_Short_All |
| traders_other_rept_spread | number | niepodane | Traders_Other_Rept_Spread_All |
| traders_tot_rept_long_all | number | niepodane | Traders_Tot_Rept_Long_All |
| traders_tot_rept_short_all | number | niepodane | Traders_Tot_Rept_Short_All |
| conc_gross_le_4_tdr_long | number | niepodane | Conc_Gross_LE_4_TDR_Long_All |
| conc_gross_le_4_tdr_short | number | niepodane | Conc_Gross_LE_4_TDR_Short_All |
| conc_gross_le_8_tdr_long | number | niepodane | Conc_Gross_LE_8_TDR_Long_All |
| conc_gross_le_8_tdr_short | number | niepodane | Conc_Gross_LE_8_TDR_Short_All |
| conc_net_le_4_tdr_long_all | number | niepodane | Conc_Net_LE_4_TDR_Long_All |
| conc_net_le_4_tdr_short_all | number | niepodane | Conc_Net_LE_4_TDR_Short_All |
| conc_net_le_8_tdr_long_all | number | niepodane | Conc_Net_LE_8_TDR_Long_All |
| conc_net_le_8_tdr_short_all | number | niepodane | Conc_Net_LE_8_TDR_Short_All |
| contract_units | text | niepodane | Contract_Units |
| cftc_subgroup_code | text | niepodane | CFTC_SubGroup_Code |
| commodity | text | niepodane | COMMODITY_NAME |
| commodity_subgroup_name | text | niepodane | COMMODITY_SUBGROUP_NAME |
| commodity_group_name | text | niepodane | COMMODITY_GROUP_NAME |
| futonly_or_combined | text | niepodane | FutOnly_or_Combined |

</details>

<details><summary>Pola: TFF - Futures Only (gpe5-46if)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| id | text | niepodane | ID |
| market_and_exchange_names | text | niepodane | Market_and_Exchange_Names |
| report_date_as_yyyy_mm_dd | calendar_date | niepodane | Report_Date_as_YYYY_MM_DD |
| yyyy_report_week_ww | text | niepodane | YYYY Report Week WW |
| contract_market_name | text | niepodane | CONTRACT_MARKET_NAME |
| cftc_contract_market_code | text | niepodane | CFTC_Contract_Market_Code |
| cftc_market_code | text | niepodane | CFTC_Market_Code |
| cftc_region_code | text | niepodane | CFTC_Region_Code |
| cftc_commodity_code | text | niepodane | CFTC_Commodity_Code |
| commodity_name | text | niepodane | Commodity Name |
| open_interest_all | number | niepodane | Open_Interest_All |
| dealer_positions_long_all | number | niepodane | Dealer_Positions_Long_All |
| dealer_positions_short_all | number | niepodane | Dealer_Positions_Short_All |
| dealer_positions_spread_all | number | niepodane | Dealer_Positions_Spread_All |
| asset_mgr_positions_long | number | niepodane | Asset_Mgr_Positions_Long_All |
| asset_mgr_positions_short | number | niepodane | Asset_Mgr_Positions_Short_All |
| asset_mgr_positions_spread | number | niepodane | Asset_Mgr_Positions_Spread_All |
| lev_money_positions_long | number | niepodane | Lev_Money_Positions_Long_All |
| lev_money_positions_short | number | niepodane | Lev_Money_Positions_Short_All |
| lev_money_positions_spread | number | niepodane | Lev_Money_Positions_Spread_All |
| other_rept_positions_long | number | niepodane | Other_Rept_Positions_Long_All |
| other_rept_positions_short | number | niepodane | Other_Rept_Positions_Short_All |
| other_rept_positions_spread | number | niepodane | Other_Rept_Positions_Spread_All |
| tot_rept_positions_long_all | number | niepodane | Tot_Rept_Positions_Long_All |
| tot_rept_positions_short | number | niepodane | Tot_Rept_Positions_Short_All |
| nonrept_positions_long_all | number | niepodane | NonRept_Positions_Long_All |
| nonrept_positions_short_all | number | niepodane | NonRept_Positions_Short_All |
| change_in_open_interest_all | number | niepodane | Change_in_Open_Interest_All |
| change_in_dealer_long_all | number | niepodane | Change_in_Dealer_Long_All |
| change_in_dealer_short_all | number | niepodane | Change_in_Dealer_Short_All |
| change_in_dealer_spread_all | number | niepodane | Change_in_Dealer_Spread_All |
| change_in_asset_mgr_long | number | niepodane | Change_in_Asset_Mgr_Long_All |
| change_in_asset_mgr_short | number | niepodane | Change_in_Asset_Mgr_Short_All |
| change_in_asset_mgr_spread | number | niepodane | Change_in_Asset_Mgr_Spread_All |
| change_in_lev_money_long | number | niepodane | Change_in_Lev_Money_Long_All |
| change_in_lev_money_short | number | niepodane | Change_in_Lev_Money_Short_All |
| change_in_lev_money_spread | number | niepodane | Change_in_Lev_Money_Spread_All |
| change_in_other_rept_long | number | niepodane | Change_in_Other_Rept_Long_All |
| change_in_other_rept_short | number | niepodane | Change_in_Other_Rept_Short_All |
| change_in_other_rept_spread | number | niepodane | Change_in_Other_Rept_Spread_All |
| change_in_tot_rept_long_all | number | niepodane | Change_in_Tot_Rept_Long_All |
| change_in_tot_rept_short | number | niepodane | Change_in_Tot_Rept_Short_All |
| change_in_nonrept_long_all | number | niepodane | Change_in_NonRept_Long_All |
| change_in_nonrept_short_all | number | niepodane | Change_in_NonRept_Short_All |
| pct_of_open_interest_all | number | niepodane | Pct_of_Open_Interest_All |
| pct_of_oi_dealer_long_all | number | niepodane | Pct_of_OI_Dealer_Long_All |
| pct_of_oi_dealer_short_all | number | niepodane | Pct_of_OI_Dealer_Short_All |
| pct_of_oi_dealer_spread_all | number | niepodane | Pct_of_OI_Dealer_Spread_All |
| pct_of_oi_asset_mgr_long | number | niepodane | Pct_of_OI_Asset_Mgr_Long_All |
| pct_of_oi_asset_mgr_short | number | niepodane | Pct_of_OI_Asset_Mgr_Short_All |
| pct_of_oi_asset_mgr_spread | number | niepodane | Pct_of_OI_Asset_Mgr_Spread_All |
| pct_of_oi_lev_money_long | number | niepodane | Pct_of_OI_Lev_Money_Long_All |
| pct_of_oi_lev_money_short | number | niepodane | Pct_of_OI_Lev_Money_Short_All |
| pct_of_oi_lev_money_spread | number | niepodane | Pct_of_OI_Lev_Money_Spread_All |
| pct_of_oi_other_rept_long | number | niepodane | Pct_of_OI_Other_Rept_Long_All |
| pct_of_oi_other_rept_short | number | niepodane | Pct_of_OI_Other_Rept_Short_All |
| pct_of_oi_other_rept_spread | number | niepodane | Pct_of_OI_Other_Rept_Spread_All |
| pct_of_oi_tot_rept_long_all | number | niepodane | Pct_of_OI_Tot_Rept_Long_All |
| pct_of_oi_tot_rept_short | number | niepodane | Pct_of_OI_Tot_Rept_Short_All |
| pct_of_oi_nonrept_long_all | number | niepodane | Pct_of_OI_NonRept_Long_All |
| pct_of_oi_nonrept_short_all | number | niepodane | Pct_of_OI_NonRept_Short_All |
| traders_tot_all | number | niepodane | Traders_Tot_All |
| traders_dealer_long_all | number | niepodane | Traders_Dealer_Long_All |
| traders_dealer_short_all | number | niepodane | Traders_Dealer_Short_All |
| traders_dealer_spread_all | number | niepodane | Traders_Dealer_Spread_All |
| traders_asset_mgr_long_all | number | niepodane | Traders_Asset_Mgr_Long_All |
| traders_asset_mgr_short_all | number | niepodane | Traders_Asset_Mgr_Short_All |
| traders_asset_mgr_spread | number | niepodane | Traders_Asset_Mgr_Spread_All |
| traders_lev_money_long_all | number | niepodane | Traders_Lev_Money_Long_All |
| traders_lev_money_short_all | number | niepodane | Traders_Lev_Money_Short_All |
| traders_lev_money_spread | number | niepodane | Traders_Lev_Money_Spread_All |
| traders_other_rept_long_all | number | niepodane | Traders_Other_Rept_Long_All |
| traders_other_rept_short | number | niepodane | Traders_Other_Rept_Short_All |
| traders_other_rept_spread | number | niepodane | Traders_Other_Rept_Spread_All |
| traders_tot_rept_long_all | number | niepodane | Traders_Tot_Rept_Long_All |
| traders_tot_rept_short_all | number | niepodane | Traders_Tot_Rept_Short_All |
| conc_gross_le_4_tdr_long | number | niepodane | Conc_Gross_LE_4_TDR_Long_All |
| conc_gross_le_4_tdr_short | number | niepodane | Conc_Gross_LE_4_TDR_Short_All |
| conc_gross_le_8_tdr_long | number | niepodane | Conc_Gross_LE_8_TDR_Long_All |
| conc_gross_le_8_tdr_short | number | niepodane | Conc_Gross_LE_8_TDR_Short_All |
| conc_net_le_4_tdr_long_all | number | niepodane | Conc_Net_LE_4_TDR_Long_All |
| conc_net_le_4_tdr_short_all | number | niepodane | Conc_Net_LE_4_TDR_Short_All |
| conc_net_le_8_tdr_long_all | number | niepodane | Conc_Net_LE_8_TDR_Long_All |
| conc_net_le_8_tdr_short_all | number | niepodane | Conc_Net_LE_8_TDR_Short_All |
| contract_units | text | niepodane | Contract_Units |
| cftc_subgroup_code | text | niepodane | CFTC_SubGroup_Code |
| commodity | text | niepodane | COMMODITY_NAME |
| commodity_subgroup_name | text | niepodane | COMMODITY_SUBGROUP_NAME |
| commodity_group_name | text | niepodane | COMMODITY_GROUP_NAME |
| futonly_or_combined | text | niepodane | FutOnly_or_Combined |

</details>

<details><summary>Pola: Disaggregated - Combined (kh3c-gbw2)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| id | text | niepodane | ID |
| market_and_exchange_names | text | niepodane | Market_and_Exchange_Names |
| report_date_as_yyyy_mm_dd | calendar_date | niepodane | Report_Date_as_YYYY_MM_DD |
| yyyy_report_week_ww | text | niepodane | YYYY Report Week WW |
| contract_market_name | text | niepodane | Contract_Market_Name |
| cftc_contract_market_code | text | niepodane | CFTC_Contract_Market_Code |
| cftc_market_code | text | niepodane | CFTC_Market_Code |
| cftc_region_code | text | niepodane | CFTC_Region_Code |
| cftc_commodity_code | text | niepodane | CFTC_Commodity_Code |
| commodity_name | text | niepodane | Commodity Name |
| open_interest_all | number | niepodane | Open_Interest_All |
| prod_merc_positions_long | number | niepodane | Prod_Merc_Positions_Long_All |
| prod_merc_positions_short | number | niepodane | Prod_Merc_Positions_Short_All |
| swap_positions_long_all | number | niepodane | Swap_Positions_Long_All |
| swap__positions_short_all | number | niepodane | Swap__Positions_Short_All |
| swap__positions_spread_all | number | niepodane | Swap__Positions_Spread_All |
| m_money_positions_long_all | number | niepodane | M_Money_Positions_Long_All |
| m_money_positions_short_all | number | niepodane | M_Money_Positions_Short_All |
| m_money_positions_spread | number | niepodane | M_Money_Positions_Spread_All |
| other_rept_positions_long | number | niepodane | Other_Rept_Positions_Long_All |
| other_rept_positions_short | number | niepodane | Other_Rept_Positions_Short_All |
| other_rept_positions_spread | number | niepodane | Other_Rept_Positions_Spread_All |
| tot_rept_positions_long_all | number | niepodane | Tot_Rept_Positions_Long_All |
| tot_rept_positions_short | number | niepodane | Tot_Rept_Positions_Short_All |
| nonrept_positions_long_all | number | niepodane | NonRept_Positions_Long_All |
| nonrept_positions_short_all | number | niepodane | NonRept_Positions_Short_All |
| open_interest_old | number | niepodane | Open_Interest_Old |
| prod_merc_positions_long_1 | number | niepodane | Prod_Merc_Positions_Long_Old |
| prod_merc_positions_short_1 | number | niepodane | Prod_Merc_Positions_Short_Old |
| swap_positions_long_old | number | niepodane | Swap_Positions_Long_Old |
| swap__positions_short_old | number | niepodane | Swap__Positions_Short_Old |
| swap__positions_spread_old | number | niepodane | Swap__Positions_Spread_Old |
| m_money_positions_long_old | number | niepodane | M_Money_Positions_Long_Old |
| m_money_positions_short_old | number | niepodane | M_Money_Positions_Short_Old |
| m_money_positions_spread_1 | number | niepodane | M_Money_Positions_Spread_Old |
| other_rept_positions_long_1 | number | niepodane | Other_Rept_Positions_Long_Old |
| other_rept_positions_short_1 | number | niepodane | Other_Rept_Positions_Short_Old |
| other_rept_positions_spread_1 | number | niepodane | Other_Rept_Positions_Spread_Old |
| tot_rept_positions_long_old | number | niepodane | Tot_Rept_Positions_Long_Old |
| tot_rept_positions_short_1 | number | niepodane | Tot_Rept_Positions_Short_Old |
| nonrept_positions_long_old | number | niepodane | NonRept_Positions_Long_Old |
| nonrept_positions_short_old | number | niepodane | NonRept_Positions_Short_Old |
| open_interest_other | number | niepodane | Open_Interest_Other |
| prod_merc_positions_long_2 | number | niepodane | Prod_Merc_Positions_Long_Other |
| prod_merc_positions_short_2 | number | niepodane | Prod_Merc_Positions_Short_Other |
| swap_positions_long_other | number | niepodane | Swap_Positions_Long_Other |
| swap__positions_short_other | number | niepodane | Swap__Positions_Short_Other |
| swap__positions_spread_other | number | niepodane | Swap__Positions_Spread_Other |
| m_money_positions_long_other | number | niepodane | M_Money_Positions_Long_Other |
| m_money_positions_short_other | number | niepodane | M_Money_Positions_Short_Other |
| m_money_positions_spread_2 | number | niepodane | M_Money_Positions_Spread_Other |
| other_rept_positions_long_2 | number | niepodane | Other_Rept_Positions_Long_Other |
| other_rept_positions_short_2 | number | niepodane | Other_Rept_Positions_Short_Other |
| other_rept_positions_spread_2 | number | niepodane | Other_Rept_Positions_Spread_Other |
| tot_rept_positions_long_other | number | niepodane | Tot_Rept_Positions_Long_Other |
| tot_rept_positions_short_2 | number | niepodane | Tot_Rept_Positions_Short_Other |
| nonrept_positions_long_other | number | niepodane | NonRept_Positions_Long_Other |
| nonrept_positions_short_other | number | niepodane | NonRept_Positions_Short_Other |
| change_in_open_interest_all | number | niepodane | Change_in_Open_Interest_All |
| change_in_prod_merc_long | number | niepodane | Change_in_Prod_Merc_Long_All |
| change_in_prod_merc_short | number | niepodane | Change_in_Prod_Merc_Short_All |
| change_in_swap_long_all | number | niepodane | Change_in_Swap_Long_All |
| change_in_swap_short_all | number | niepodane | Change_in_Swap_Short_All |
| change_in_swap_spread_all | number | niepodane | Change_in_Swap_Spread_All |
| change_in_m_money_long_all | number | niepodane | Change_in_M_Money_Long_All |
| change_in_m_money_short_all | number | niepodane | Change_in_M_Money_Short_All |
| change_in_m_money_spread | number | niepodane | Change_in_M_Money_Spread_All |
| change_in_other_rept_long | number | niepodane | Change_in_Other_Rept_Long_All |
| change_in_other_rept_short | number | niepodane | Change_in_Other_Rept_Short_All |
| change_in_other_rept_spread | number | niepodane | Change_in_Other_Rept_Spread_All |
| change_in_tot_rept_long_all | number | niepodane | Change_in_Tot_Rept_Long_All |
| change_in_tot_rept_short | number | niepodane | Change_in_Tot_Rept_Short_All |
| change_in_nonrept_long_all | number | niepodane | Change_in_NonRept_Long_All |
| change_in_nonrept_short_all | number | niepodane | Change_in_NonRept_Short_All |
| pct_of_open_interest_all | number | niepodane | Pct_of_Open_Interest_All |
| pct_of_oi_prod_merc_long | number | niepodane | Pct_of_OI_Prod_Merc_Long_All |
| pct_of_oi_prod_merc_short | number | niepodane | Pct_of_OI_Prod_Merc_Short_All |
| pct_of_oi_swap_long_all | number | niepodane | Pct_of_OI_Swap_Long_All |
| pct_of_oi_swap_short_all | number | niepodane | Pct_of_OI_Swap_Short_All |
| pct_of_oi_swap_spread_all | number | niepodane | Pct_of_OI_Swap_Spread_All |
| pct_of_oi_m_money_long_all | number | niepodane | Pct_of_OI_M_Money_Long_All |
| pct_of_oi_m_money_short_all | number | niepodane | Pct_of_OI_M_Money_Short_All |
| pct_of_oi_m_money_spread | number | niepodane | Pct_of_OI_M_Money_Spread_All |
| pct_of_oi_other_rept_long | number | niepodane | Pct_of_OI_Other_Rept_Long_All |
| pct_of_oi_other_rept_short | number | niepodane | Pct_of_OI_Other_Rept_Short_All |
| pct_of_oi_other_rept_spread | number | niepodane | Pct_of_OI_Other_Rept_Spread_All |
| pct_of_oi_tot_rept_long_all | number | niepodane | Pct_of_OI_Tot_Rept_Long_All |
| pct_of_oi_tot_rept_short | number | niepodane | Pct_of_OI_Tot_Rept_Short_All |
| pct_of_oi_nonrept_long_all | number | niepodane | Pct_of_OI_NonRept_Long_All |
| pct_of_oi_nonrept_short_all | number | niepodane | Pct_of_OI_NonRept_Short_All |
| pct_of_open_interest_old | number | niepodane | Pct_of_Open_Interest_Old |
| pct_of_oi_prod_merc_long_1 | number | niepodane | Pct_of_OI_Prod_Merc_Long_Old |
| pct_of_oi_prod_merc_short_1 | number | niepodane | Pct_of_OI_Prod_Merc_Short_Old |
| pct_of_oi_swap_long_old | number | niepodane | Pct_of_OI_Swap_Long_Old |
| pct_of_oi_swap_short_old | number | niepodane | Pct_of_OI_Swap_Short_Old |
| pct_of_oi_swap_spread_old | number | niepodane | Pct_of_OI_Swap_Spread_Old |
| pct_of_oi_m_money_long_old | number | niepodane | Pct_of_OI_M_Money_Long_Old |
| pct_of_oi_m_money_short_old | number | niepodane | Pct_of_OI_M_Money_Short_Old |
| pct_of_oi_m_money_spread_1 | number | niepodane | Pct_of_OI_M_Money_Spread_Old |
| pct_of_oi_other_rept_long_1 | number | niepodane | Pct_of_OI_Other_Rept_Long_Old |
| pct_of_oi_other_rept_short_1 | number | niepodane | Pct_of_OI_Other_Rept_Short_Old |
| pct_of_oi_other_rept_spread_1 | number | niepodane | Pct_of_OI_Other_Rept_Spread_Old |
| pct_of_oi_tot_rept_long_old | number | niepodane | Pct_of_OI_Tot_Rept_Long_Old |
| pct_of_oi_tot_rept_short_1 | number | niepodane | Pct_of_OI_Tot_Rept_Short_Old |
| pct_of_oi_nonrept_long_old | number | niepodane | Pct_of_OI_NonRept_Long_Old |
| pct_of_oi_nonrept_short_old | number | niepodane | Pct_of_OI_NonRept_Short_Old |
| pct_of_open_interest_other | number | niepodane | Pct_of_Open_Interest_Other |
| pct_of_oi_prod_merc_long_2 | number | niepodane | Pct_of_OI_Prod_Merc_Long_Other |
| pct_of_oi_prod_merc_short_2 | number | niepodane | Pct_of_OI_Prod_Merc_Short_Other |
| pct_of_oi_swap_long_other | number | niepodane | Pct_of_OI_Swap_Long_Other |
| pct_of_oi_swap_short_other | number | niepodane | Pct_of_OI_Swap_Short_Other |
| pct_of_oi_swap_spread_other | number | niepodane | Pct_of_OI_Swap_Spread_Other |
| pct_of_oi_m_money_long_other | number | niepodane | Pct_of_OI_M_Money_Long_Other |
| pct_of_oi_m_money_short_other | number | niepodane | Pct_of_OI_M_Money_Short_Other |
| pct_of_oi_m_money_spread_2 | number | niepodane | Pct_of_OI_M_Money_Spread_Other |
| pct_of_oi_other_rept_long_2 | number | niepodane | Pct_of_OI_Other_Rept_Long_Other |
| pct_of_oi_other_rept_short_2 | number | niepodane | Pct_of_OI_Other_Rept_Short_Other |
| pct_of_oi_other_rept_spread_2 | number | niepodane | Pct_of_OI_Other_Rept_Spread_Other |
| pct_of_oi_tot_rept_long_other | number | niepodane | Pct_of_OI_Tot_Rept_Long_Other |
| pct_of_oi_tot_rept_short_2 | number | niepodane | Pct_of_OI_Tot_Rept_Short_Other |
| pct_of_oi_nonrept_long_other | number | niepodane | Pct_of_OI_NonRept_Long_Other |
| pct_of_oi_nonrept_short_other | number | niepodane | Pct_of_OI_NonRept_Short_Other |
| traders_tot_all | number | niepodane | Traders_Tot_All |
| traders_prod_merc_long_all | number | niepodane | Traders_Prod_Merc_Long_All |
| traders_prod_merc_short_all | number | niepodane | Traders_Prod_Merc_Short_All |
| traders_swap_long_all | number | niepodane | Traders_Swap_Long_All |
| traders_swap_short_all | number | niepodane | Traders_Swap_Short_All |
| traders_swap_spread_all | number | niepodane | Traders_Swap_Spread_All |
| traders_m_money_long_all | number | niepodane | Traders_M_Money_Long_All |
| traders_m_money_short_all | number | niepodane | Traders_M_Money_Short_All |
| traders_m_money_spread_all | number | niepodane | Traders_M_Money_Spread_All |
| traders_other_rept_long_all | number | niepodane | Traders_Other_Rept_Long_All |
| traders_other_rept_short | number | niepodane | Traders_Other_Rept_Short_All |
| traders_other_rept_spread | number | niepodane | Traders_Other_Rept_Spread_All |
| traders_tot_rept_long_all | number | niepodane | Traders_Tot_Rept_Long_All |
| traders_tot_rept_short_all | number | niepodane | Traders_Tot_Rept_Short_All |
| traders_tot_old | number | niepodane | Traders_Tot_Old |
| traders_prod_merc_long_old | number | niepodane | Traders_Prod_Merc_Long_Old |
| traders_prod_merc_short_old | number | niepodane | Traders_Prod_Merc_Short_Old |
| traders_swap_long_old | number | niepodane | Traders_Swap_Long_Old |
| traders_swap_short_old | number | niepodane | Traders_Swap_Short_Old |
| traders_swap_spread_old | number | niepodane | Traders_Swap_Spread_Old |
| traders_m_money_long_old | number | niepodane | Traders_M_Money_Long_Old |
| traders_m_money_short_old | number | niepodane | Traders_M_Money_Short_Old |
| traders_m_money_spread_old | number | niepodane | Traders_M_Money_Spread_Old |
| traders_other_rept_long_old | number | niepodane | Traders_Other_Rept_Long_Old |
| traders_other_rept_short_1 | number | niepodane | Traders_Other_Rept_Short_Old |
| traders_other_rept_spread_1 | number | niepodane | Traders_Other_Rept_Spread_Old |
| traders_tot_rept_long_old | number | niepodane | Traders_Tot_Rept_Long_Old |
| traders_tot_rept_short_old | number | niepodane | Traders_Tot_Rept_Short_Old |
| traders_tot_other | number | niepodane | Traders_Tot_Other |
| traders_prod_merc_long_other | number | niepodane | Traders_Prod_Merc_Long_Other |
| traders_prod_merc_short_other | number | niepodane | Traders_Prod_Merc_Short_Other |
| traders_swap_long_other | number | niepodane | Traders_Swap_Long_Other |
| traders_swap_short_other | number | niepodane | Traders_Swap_Short_Other |
| traders_swap_spread_other | number | niepodane | Traders_Swap_Spread_Other |
| traders_m_money_long_other | number | niepodane | Traders_M_Money_Long_Other |
| traders_m_money_short_other | number | niepodane | Traders_M_Money_Short_Other |
| traders_m_money_spread_other | number | niepodane | Traders_M_Money_Spread_Other |
| traders_other_rept_long_other | number | niepodane | Traders_Other_Rept_Long_Other |
| traders_other_rept_short_2 | number | niepodane | Traders_Other_Rept_Short_Other |
| traders_other_rept_spread_2 | number | niepodane | Traders_Other_Rept_Spread_Other |
| traders_tot_rept_long_other | number | niepodane | Traders_Tot_Rept_Long_Other |
| traders_tot_rept_short_other | number | niepodane | Traders_Tot_Rept_Short_Other |
| conc_gross_le_4_tdr_long | number | niepodane | Conc_Gross_LE_4_TDR_Long_All |
| conc_gross_le_4_tdr_short | number | niepodane | Conc_Gross_LE_4_TDR_Short_All |
| conc_gross_le_8_tdr_long | number | niepodane | Conc_Gross_LE_8_TDR_Long_All |
| conc_gross_le_8_tdr_short | number | niepodane | Conc_Gross_LE_8_TDR_Short_All |
| conc_net_le_4_tdr_long_all | number | niepodane | Conc_Net_LE_4_TDR_Long_All |
| conc_net_le_4_tdr_short_all | number | niepodane | Conc_Net_LE_4_TDR_Short_All |
| conc_net_le_8_tdr_long_all | number | niepodane | Conc_Net_LE_8_TDR_Long_All |
| conc_net_le_8_tdr_short_all | number | niepodane | Conc_Net_LE_8_TDR_Short_All |
| conc_gross_le_4_tdr_long_1 | number | niepodane | Conc_Gross_LE_4_TDR_Long_Old |
| conc_gross_le_4_tdr_short_1 | number | niepodane | Conc_Gross_LE_4_TDR_Short_Old |
| conc_gross_le_8_tdr_long_1 | number | niepodane | Conc_Gross_LE_8_TDR_Long_Old |
| conc_gross_le_8_tdr_short_1 | number | niepodane | Conc_Gross_LE_8_TDR_Short_Old |
| conc_net_le_4_tdr_long_old | number | niepodane | Conc_Net_LE_4_TDR_Long_Old |
| conc_net_le_4_tdr_short_old | number | niepodane | Conc_Net_LE_4_TDR_Short_Old |
| conc_net_le_8_tdr_long_old | number | niepodane | Conc_Net_LE_8_TDR_Long_Old |
| conc_net_le_8_tdr_short_old | number | niepodane | Conc_Net_LE_8_TDR_Short_Old |
| conc_gross_le_4_tdr_long_2 | number | niepodane | Conc_Gross_LE_4_TDR_Long_Other |
| conc_gross_le_4_tdr_short_2 | number | niepodane | Conc_Gross_LE_4_TDR_Short_Other |
| conc_gross_le_8_tdr_long_2 | number | niepodane | Conc_Gross_LE_8_TDR_Long_Other |
| conc_gross_le_8_tdr_short_2 | number | niepodane | Conc_Gross_LE_8_TDR_Short_Other |
| conc_net_le_4_tdr_long_other | number | niepodane | Conc_Net_LE_4_TDR_Long_Other |
| conc_net_le_4_tdr_short_other | number | niepodane | Conc_Net_LE_4_TDR_Short_Other |
| conc_net_le_8_tdr_long_other | number | niepodane | Conc_Net_LE_8_TDR_Long_Other |
| conc_net_le_8_tdr_short_other | number | niepodane | Conc_Net_LE_8_TDR_Short_Other |
| contract_units | text | niepodane | Contract_Units |
| cftc_subgroup_code | text | niepodane | CFTC_SubGroup_Code |
| commodity | text | niepodane | COMMODITY_NAME |
| commodity_subgroup_name | text | niepodane | COMMODITY_SUBGROUP_NAME |
| commodity_group_name | text | niepodane | COMMODITY_GROUP_NAME |
| futonly_or_combined | text | niepodane | FutOnly_or_Combined |

</details>

<details><summary>Pola: Disaggregated - Futures Only (72hh-3qpy)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| id | text | niepodane | ID |
| market_and_exchange_names | text | niepodane | Market_and_Exchange_Names |
| report_date_as_yyyy_mm_dd | calendar_date | niepodane | Report_Date_as_YYYY_MM_DD |
| yyyy_report_week_ww | text | niepodane | YYYY Report Week WW |
| contract_market_name | text | niepodane | Contract_Market_Name |
| cftc_contract_market_code | text | niepodane | CFTC_Contract_Market_Code |
| cftc_market_code | text | niepodane | CFTC_Market_Code |
| cftc_region_code | text | niepodane | CFTC_Region_Code |
| cftc_commodity_code | text | niepodane | CFTC_Commodity_Code |
| commodity_name | text | niepodane | Commodity Name |
| open_interest_all | number | niepodane | Open_Interest_All |
| prod_merc_positions_long | number | niepodane | Prod_Merc_Positions_Long_All |
| prod_merc_positions_short | number | niepodane | Prod_Merc_Positions_Short_All |
| swap_positions_long_all | number | niepodane | Swap_Positions_Long_All |
| swap__positions_short_all | number | niepodane | Swap__Positions_Short_All |
| swap__positions_spread_all | number | niepodane | Swap__Positions_Spread_All |
| m_money_positions_long_all | number | niepodane | M_Money_Positions_Long_All |
| m_money_positions_short_all | number | niepodane | M_Money_Positions_Short_All |
| m_money_positions_spread | number | niepodane | M_Money_Positions_Spread_All |
| other_rept_positions_long | number | niepodane | Other_Rept_Positions_Long_All |
| other_rept_positions_short | number | niepodane | Other_Rept_Positions_Short_All |
| other_rept_positions_spread | number | niepodane | Other_Rept_Positions_Spread_All |
| tot_rept_positions_long_all | number | niepodane | Tot_Rept_Positions_Long_All |
| tot_rept_positions_short | number | niepodane | Tot_Rept_Positions_Short_All |
| nonrept_positions_long_all | number | niepodane | NonRept_Positions_Long_All |
| nonrept_positions_short_all | number | niepodane | NonRept_Positions_Short_All |
| open_interest_old | number | niepodane | Open_Interest_Old |
| prod_merc_positions_long_1 | number | niepodane | Prod_Merc_Positions_Long_Old |
| prod_merc_positions_short_1 | number | niepodane | Prod_Merc_Positions_Short_Old |
| swap_positions_long_old | number | niepodane | Swap_Positions_Long_Old |
| swap__positions_short_old | number | niepodane | Swap__Positions_Short_Old |
| swap__positions_spread_old | number | niepodane | Swap__Positions_Spread_Old |
| m_money_positions_long_old | number | niepodane | M_Money_Positions_Long_Old |
| m_money_positions_short_old | number | niepodane | M_Money_Positions_Short_Old |
| m_money_positions_spread_1 | number | niepodane | M_Money_Positions_Spread_Old |
| other_rept_positions_long_1 | number | niepodane | Other_Rept_Positions_Long_Old |
| other_rept_positions_short_1 | number | niepodane | Other_Rept_Positions_Short_Old |
| other_rept_positions_spread_1 | number | niepodane | Other_Rept_Positions_Spread_Old |
| tot_rept_positions_long_old | number | niepodane | Tot_Rept_Positions_Long_Old |
| tot_rept_positions_short_1 | number | niepodane | Tot_Rept_Positions_Short_Old |
| nonrept_positions_long_old | number | niepodane | NonRept_Positions_Long_Old |
| nonrept_positions_short_old | number | niepodane | NonRept_Positions_Short_Old |
| open_interest_other | number | niepodane | Open_Interest_Other |
| prod_merc_positions_long_2 | number | niepodane | Prod_Merc_Positions_Long_Other |
| prod_merc_positions_short_2 | number | niepodane | Prod_Merc_Positions_Short_Other |
| swap_positions_long_other | number | niepodane | Swap_Positions_Long_Other |
| swap__positions_short_other | number | niepodane | Swap__Positions_Short_Other |
| swap__positions_spread_other | number | niepodane | Swap__Positions_Spread_Other |
| m_money_positions_long_other | number | niepodane | M_Money_Positions_Long_Other |
| m_money_positions_short_other | number | niepodane | M_Money_Positions_Short_Other |
| m_money_positions_spread_2 | number | niepodane | M_Money_Positions_Spread_Other |
| other_rept_positions_long_2 | number | niepodane | Other_Rept_Positions_Long_Other |
| other_rept_positions_short_2 | number | niepodane | Other_Rept_Positions_Short_Other |
| other_rept_positions_spread_2 | number | niepodane | Other_Rept_Positions_Spread_Other |
| tot_rept_positions_long_other | number | niepodane | Tot_Rept_Positions_Long_Other |
| tot_rept_positions_short_2 | number | niepodane | Tot_Rept_Positions_Short_Other |
| nonrept_positions_long_other | number | niepodane | NonRept_Positions_Long_Other |
| nonrept_positions_short_other | number | niepodane | NonRept_Positions_Short_Other |
| change_in_open_interest_all | number | niepodane | Change_in_Open_Interest_All |
| change_in_prod_merc_long | number | niepodane | Change_in_Prod_Merc_Long_All |
| change_in_prod_merc_short | number | niepodane | Change_in_Prod_Merc_Short_All |
| change_in_swap_long_all | number | niepodane | Change_in_Swap_Long_All |
| change_in_swap_short_all | number | niepodane | Change_in_Swap_Short_All |
| change_in_swap_spread_all | number | niepodane | Change_in_Swap_Spread_All |
| change_in_m_money_long_all | number | niepodane | Change_in_M_Money_Long_All |
| change_in_m_money_short_all | number | niepodane | Change_in_M_Money_Short_All |
| change_in_m_money_spread | number | niepodane | Change_in_M_Money_Spread_All |
| change_in_other_rept_long | number | niepodane | Change_in_Other_Rept_Long_All |
| change_in_other_rept_short | number | niepodane | Change_in_Other_Rept_Short_All |
| change_in_other_rept_spread | number | niepodane | Change_in_Other_Rept_Spread_All |
| change_in_tot_rept_long_all | number | niepodane | Change_in_Tot_Rept_Long_All |
| change_in_tot_rept_short | number | niepodane | Change_in_Tot_Rept_Short_All |
| change_in_nonrept_long_all | number | niepodane | Change_in_NonRept_Long_All |
| change_in_nonrept_short_all | number | niepodane | Change_in_NonRept_Short_All |
| pct_of_open_interest_all | number | niepodane | Pct_of_Open_Interest_All |
| pct_of_oi_prod_merc_long | number | niepodane | Pct_of_OI_Prod_Merc_Long_All |
| pct_of_oi_prod_merc_short | number | niepodane | Pct_of_OI_Prod_Merc_Short_All |
| pct_of_oi_swap_long_all | number | niepodane | Pct_of_OI_Swap_Long_All |
| pct_of_oi_swap_short_all | number | niepodane | Pct_of_OI_Swap_Short_All |
| pct_of_oi_swap_spread_all | number | niepodane | Pct_of_OI_Swap_Spread_All |
| pct_of_oi_m_money_long_all | number | niepodane | Pct_of_OI_M_Money_Long_All |
| pct_of_oi_m_money_short_all | number | niepodane | Pct_of_OI_M_Money_Short_All |
| pct_of_oi_m_money_spread | number | niepodane | Pct_of_OI_M_Money_Spread_All |
| pct_of_oi_other_rept_long | number | niepodane | Pct_of_OI_Other_Rept_Long_All |
| pct_of_oi_other_rept_short | number | niepodane | Pct_of_OI_Other_Rept_Short_All |
| pct_of_oi_other_rept_spread | number | niepodane | Pct_of_OI_Other_Rept_Spread_All |
| pct_of_oi_tot_rept_long_all | number | niepodane | Pct_of_OI_Tot_Rept_Long_All |
| pct_of_oi_tot_rept_short | number | niepodane | Pct_of_OI_Tot_Rept_Short_All |
| pct_of_oi_nonrept_long_all | number | niepodane | Pct_of_OI_NonRept_Long_All |
| pct_of_oi_nonrept_short_all | number | niepodane | Pct_of_OI_NonRept_Short_All |
| pct_of_open_interest_old | number | niepodane | Pct_of_Open_Interest_Old |
| pct_of_oi_prod_merc_long_1 | number | niepodane | Pct_of_OI_Prod_Merc_Long_Old |
| pct_of_oi_prod_merc_short_1 | number | niepodane | Pct_of_OI_Prod_Merc_Short_Old |
| pct_of_oi_swap_long_old | number | niepodane | Pct_of_OI_Swap_Long_Old |
| pct_of_oi_swap_short_old | number | niepodane | Pct_of_OI_Swap_Short_Old |
| pct_of_oi_swap_spread_old | number | niepodane | Pct_of_OI_Swap_Spread_Old |
| pct_of_oi_m_money_long_old | number | niepodane | Pct_of_OI_M_Money_Long_Old |
| pct_of_oi_m_money_short_old | number | niepodane | Pct_of_OI_M_Money_Short_Old |
| pct_of_oi_m_money_spread_1 | number | niepodane | Pct_of_OI_M_Money_Spread_Old |
| pct_of_oi_other_rept_long_1 | number | niepodane | Pct_of_OI_Other_Rept_Long_Old |
| pct_of_oi_other_rept_short_1 | number | niepodane | Pct_of_OI_Other_Rept_Short_Old |
| pct_of_oi_other_rept_spread_1 | number | niepodane | Pct_of_OI_Other_Rept_Spread_Old |
| pct_of_oi_tot_rept_long_old | number | niepodane | Pct_of_OI_Tot_Rept_Long_Old |
| pct_of_oi_tot_rept_short_1 | number | niepodane | Pct_of_OI_Tot_Rept_Short_Old |
| pct_of_oi_nonrept_long_old | number | niepodane | Pct_of_OI_NonRept_Long_Old |
| pct_of_oi_nonrept_short_old | number | niepodane | Pct_of_OI_NonRept_Short_Old |
| pct_of_open_interest_other | number | niepodane | Pct_of_Open_Interest_Other |
| pct_of_oi_prod_merc_long_2 | number | niepodane | Pct_of_OI_Prod_Merc_Long_Other |
| pct_of_oi_prod_merc_short_2 | number | niepodane | Pct_of_OI_Prod_Merc_Short_Other |
| pct_of_oi_swap_long_other | number | niepodane | Pct_of_OI_Swap_Long_Other |
| pct_of_oi_swap_short_other | number | niepodane | Pct_of_OI_Swap_Short_Other |
| pct_of_oi_swap_spread_other | number | niepodane | Pct_of_OI_Swap_Spread_Other |
| pct_of_oi_m_money_long_other | number | niepodane | Pct_of_OI_M_Money_Long_Other |
| pct_of_oi_m_money_short_other | number | niepodane | Pct_of_OI_M_Money_Short_Other |
| pct_of_oi_m_money_spread_2 | number | niepodane | Pct_of_OI_M_Money_Spread_Other |
| pct_of_oi_other_rept_long_2 | number | niepodane | Pct_of_OI_Other_Rept_Long_Other |
| pct_of_oi_other_rept_short_2 | number | niepodane | Pct_of_OI_Other_Rept_Short_Other |
| pct_of_oi_other_rept_spread_2 | number | niepodane | Pct_of_OI_Other_Rept_Spread_Other |
| pct_of_oi_tot_rept_long_other | number | niepodane | Pct_of_OI_Tot_Rept_Long_Other |
| pct_of_oi_tot_rept_short_2 | number | niepodane | Pct_of_OI_Tot_Rept_Short_Other |
| pct_of_oi_nonrept_long_other | number | niepodane | Pct_of_OI_NonRept_Long_Other |
| pct_of_oi_nonrept_short_other | number | niepodane | Pct_of_OI_NonRept_Short_Other |
| traders_tot_all | number | niepodane | Traders_Tot_All |
| traders_prod_merc_long_all | number | niepodane | Traders_Prod_Merc_Long_All |
| traders_prod_merc_short_all | number | niepodane | Traders_Prod_Merc_Short_All |
| traders_swap_long_all | number | niepodane | Traders_Swap_Long_All |
| traders_swap_short_all | number | niepodane | Traders_Swap_Short_All |
| traders_swap_spread_all | number | niepodane | Traders_Swap_Spread_All |
| traders_m_money_long_all | number | niepodane | Traders_M_Money_Long_All |
| traders_m_money_short_all | number | niepodane | Traders_M_Money_Short_All |
| traders_m_money_spread_all | number | niepodane | Traders_M_Money_Spread_All |
| traders_other_rept_long_all | number | niepodane | Traders_Other_Rept_Long_All |
| traders_other_rept_short | number | niepodane | Traders_Other_Rept_Short_All |
| traders_other_rept_spread | number | niepodane | Traders_Other_Rept_Spread_All |
| traders_tot_rept_long_all | number | niepodane | Traders_Tot_Rept_Long_All |
| traders_tot_rept_short_all | number | niepodane | Traders_Tot_Rept_Short_All |
| traders_tot_old | number | niepodane | Traders_Tot_Old |
| traders_prod_merc_long_old | number | niepodane | Traders_Prod_Merc_Long_Old |
| traders_prod_merc_short_old | number | niepodane | Traders_Prod_Merc_Short_Old |
| traders_swap_long_old | number | niepodane | Traders_Swap_Long_Old |
| traders_swap_short_old | number | niepodane | Traders_Swap_Short_Old |
| traders_swap_spread_old | number | niepodane | Traders_Swap_Spread_Old |
| traders_m_money_long_old | number | niepodane | Traders_M_Money_Long_Old |
| traders_m_money_short_old | number | niepodane | Traders_M_Money_Short_Old |
| traders_m_money_spread_old | number | niepodane | Traders_M_Money_Spread_Old |
| traders_other_rept_long_old | number | niepodane | Traders_Other_Rept_Long_Old |
| traders_other_rept_short_1 | number | niepodane | Traders_Other_Rept_Short_Old |
| traders_other_rept_spread_1 | number | niepodane | Traders_Other_Rept_Spread_Old |
| traders_tot_rept_long_old | number | niepodane | Traders_Tot_Rept_Long_Old |
| traders_tot_rept_short_old | number | niepodane | Traders_Tot_Rept_Short_Old |
| traders_tot_other | number | niepodane | Traders_Tot_Other |
| traders_prod_merc_long_other | number | niepodane | Traders_Prod_Merc_Long_Other |
| traders_prod_merc_short_other | number | niepodane | Traders_Prod_Merc_Short_Other |
| traders_swap_long_other | number | niepodane | Traders_Swap_Long_Other |
| traders_swap_short_other | number | niepodane | Traders_Swap_Short_Other |
| traders_swap_spread_other | number | niepodane | Traders_Swap_Spread_Other |
| traders_m_money_long_other | number | niepodane | Traders_M_Money_Long_Other |
| traders_m_money_short_other | number | niepodane | Traders_M_Money_Short_Other |
| traders_m_money_spread_other | number | niepodane | Traders_M_Money_Spread_Other |
| traders_other_rept_long_other | number | niepodane | Traders_Other_Rept_Long_Other |
| traders_other_rept_short_2 | number | niepodane | Traders_Other_Rept_Short_Other |
| traders_other_rept_spread_2 | number | niepodane | Traders_Other_Rept_Spread_Other |
| traders_tot_rept_long_other | number | niepodane | Traders_Tot_Rept_Long_Other |
| traders_tot_rept_short_other | number | niepodane | Traders_Tot_Rept_Short_Other |
| conc_gross_le_4_tdr_long | number | niepodane | Conc_Gross_LE_4_TDR_Long_All |
| conc_gross_le_4_tdr_short | number | niepodane | Conc_Gross_LE_4_TDR_Short_All |
| conc_gross_le_8_tdr_long | number | niepodane | Conc_Gross_LE_8_TDR_Long_All |
| conc_gross_le_8_tdr_short | number | niepodane | Conc_Gross_LE_8_TDR_Short_All |
| conc_net_le_4_tdr_long_all | number | niepodane | Conc_Net_LE_4_TDR_Long_All |
| conc_net_le_4_tdr_short_all | number | niepodane | Conc_Net_LE_4_TDR_Short_All |
| conc_net_le_8_tdr_long_all | number | niepodane | Conc_Net_LE_8_TDR_Long_All |
| conc_net_le_8_tdr_short_all | number | niepodane | Conc_Net_LE_8_TDR_Short_All |
| conc_gross_le_4_tdr_long_1 | number | niepodane | Conc_Gross_LE_4_TDR_Long_Old |
| conc_gross_le_4_tdr_short_1 | number | niepodane | Conc_Gross_LE_4_TDR_Short_Old |
| conc_gross_le_8_tdr_long_1 | number | niepodane | Conc_Gross_LE_8_TDR_Long_Old |
| conc_gross_le_8_tdr_short_1 | number | niepodane | Conc_Gross_LE_8_TDR_Short_Old |
| conc_net_le_4_tdr_long_old | number | niepodane | Conc_Net_LE_4_TDR_Long_Old |
| conc_net_le_4_tdr_short_old | number | niepodane | Conc_Net_LE_4_TDR_Short_Old |
| conc_net_le_8_tdr_long_old | number | niepodane | Conc_Net_LE_8_TDR_Long_Old |
| conc_net_le_8_tdr_short_old | number | niepodane | Conc_Net_LE_8_TDR_Short_Old |
| conc_gross_le_4_tdr_long_2 | number | niepodane | Conc_Gross_LE_4_TDR_Long_Other |
| conc_gross_le_4_tdr_short_2 | number | niepodane | Conc_Gross_LE_4_TDR_Short_Other |
| conc_gross_le_8_tdr_long_2 | number | niepodane | Conc_Gross_LE_8_TDR_Long_Other |
| conc_gross_le_8_tdr_short_2 | number | niepodane | Conc_Gross_LE_8_TDR_Short_Other |
| conc_net_le_4_tdr_long_other | number | niepodane | Conc_Net_LE_4_TDR_Long_Other |
| conc_net_le_4_tdr_short_other | number | niepodane | Conc_Net_LE_4_TDR_Short_Other |
| conc_net_le_8_tdr_long_other | number | niepodane | Conc_Net_LE_8_TDR_Long_Other |
| conc_net_le_8_tdr_short_other | number | niepodane | Conc_Net_LE_8_TDR_Short_Other |
| contract_units | text | niepodane | Contract_Units |
| cftc_subgroup_code | text | niepodane | CFTC_SubGroup_Code |
| commodity | text | niepodane | COMMODITY_NAME |
| commodity_subgroup_name | text | niepodane | COMMODITY_SUBGROUP_NAME |
| commodity_group_name | text | niepodane | COMMODITY_GROUP_NAME |
| futonly_or_combined | text | niepodane | FutOnly_or_Combined |

</details>

<details><summary>Pola: Legacy - Combined (jun7-fc8e)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| id | text | niepodane | ID |
| market_and_exchange_names | text | niepodane | Market_and_Exchange_Names |
| report_date_as_yyyy_mm_dd | calendar_date | niepodane | Report_Date_as_YYYY_MM_DD |
| yyyy_report_week_ww | text | niepodane | YYYY Report Week WW |
| contract_market_name | text | niepodane | CONTRACT_MARKET_NAME |
| cftc_contract_market_code | text | niepodane | CFTC_Contract_Market_Code |
| cftc_market_code | text | niepodane | CFTC_Market_Code |
| cftc_region_code | text | niepodane | CFTC_Region_Code |
| cftc_commodity_code | text | niepodane | CFTC_Commodity_Code |
| commodity_name | text | niepodane | Commodity Name |
| open_interest_all | number | niepodane | Open_Interest_All |
| noncomm_positions_long_all | number | niepodane | NonComm_Positions_Long_All |
| noncomm_positions_short_all | number | niepodane | NonComm_Positions_Short_All |
| noncomm_postions_spread_all | number | niepodane | NonComm_Postions_Spread_All |
| comm_positions_long_all | number | niepodane | Comm_Positions_Long_All |
| comm_positions_short_all | number | niepodane | Comm_Positions_Short_All |
| tot_rept_positions_long_all | number | niepodane | Tot_Rept_Positions_Long_All |
| tot_rept_positions_short | number | niepodane | Tot_Rept_Positions_Short_All |
| nonrept_positions_long_all | number | niepodane | NonRept_Positions_Long_All |
| nonrept_positions_short_all | number | niepodane | NonRept_Positions_Short_All |
| open_interest_old | number | niepodane | Open_Interest_Old |
| noncomm_positions_long_old | number | niepodane | NonComm_Positions_Long_Old |
| noncomm_positions_short_old | number | niepodane | NonComm_Positions_Short_Old |
| noncomm_positions_spread | number | niepodane | NonComm_Positions_Spread_Old |
| comm_positions_long_old | number | niepodane | Comm_Positions_Long_Old |
| comm_positions_short_old | number | niepodane | Comm_Positions_Short_Old |
| tot_rept_positions_long_old | number | niepodane | Tot_Rept_Positions_Long_Old |
| tot_rept_positions_short_1 | number | niepodane | Tot_Rept_Positions_Short_Old |
| nonrept_positions_long_old | number | niepodane | NonRept_Positions_Long_Old |
| nonrept_positions_short_old | number | niepodane | NonRept_Positions_Short_Old |
| open_interest_other | number | niepodane | Open_Interest_Other |
| noncomm_positions_long_other | number | niepodane | NonComm_Positions_Long_Other |
| noncomm_positions_short_other | number | niepodane | NonComm_Positions_Short_Other |
| noncomm_positions_spread_1 | number | niepodane | NonComm_Positions_Spread_Other |
| comm_positions_long_other | number | niepodane | Comm_Positions_Long_Other |
| comm_positions_short_other | number | niepodane | Comm_Positions_Short_Other |
| tot_rept_positions_long_other | number | niepodane | Tot_Rept_Positions_Long_Other |
| tot_rept_positions_short_2 | number | niepodane | Tot_Rept_Positions_Short_Other |
| nonrept_positions_long_other | number | niepodane | NonRept_Positions_Long_Other |
| nonrept_positions_short_other | number | niepodane | NonRept_Positions_Short_Other |
| change_in_open_interest_all | number | niepodane | Change_in_Open_Interest_All |
| change_in_noncomm_long_all | number | niepodane | Change_in_NonComm_Long_All |
| change_in_noncomm_short_all | number | niepodane | Change_in_NonComm_Short_All |
| change_in_noncomm_spead_all | number | niepodane | Change_in_NonComm_Spead_All |
| change_in_comm_long_all | number | niepodane | Change_in_Comm_Long_All |
| change_in_comm_short_all | number | niepodane | Change_in_Comm_Short_All |
| change_in_tot_rept_long_all | number | niepodane | Change_in_Tot_Rept_Long_All |
| change_in_tot_rept_short | number | niepodane | Change_in_Tot_Rept_Short_All |
| change_in_nonrept_long_all | number | niepodane | Change_in_NonRept_Long_All |
| change_in_nonrept_short_all | number | niepodane | Change_in_NonRept_Short_All |
| pct_of_open_interest_all | number | niepodane | Pct_of_Open_Interest_All |
| pct_of_oi_noncomm_long_all | number | niepodane | Pct_of_OI_NonComm_Long_All |
| pct_of_oi_noncomm_short_all | number | niepodane | Pct_of_OI_NonComm_Short_All |
| pct_of_oi_noncomm_spread | number | niepodane | Pct_of_OI_NonComm_Spread_All |
| pct_of_oi_comm_long_all | number | niepodane | Pct_of_OI_Comm_Long_All |
| pct_of_oi_comm_short_all | number | niepodane | Pct_of_OI_Comm_Short_All |
| pct_of_oi_tot_rept_long_all | number | niepodane | Pct_of_OI_Tot_Rept_Long_All |
| pct_of_oi_tot_rept_short | number | niepodane | Pct_of_OI_Tot_Rept_Short_All |
| pct_of_oi_nonrept_long_all | number | niepodane | Pct_of_OI_NonRept_Long_All |
| pct_of_oi_nonrept_short_all | number | niepodane | Pct_of_OI_NonRept_Short_All |
| pct_of_open_interest_old | number | niepodane | Pct_of_Open_Interest_Old |
| pct_of_oi_noncomm_long_old | number | niepodane | Pct_of_OI_NonComm_Long_Old |
| pct_of_oi_noncomm_short_old | number | niepodane | Pct_of_OI_NonComm_Short_Old |
| pct_of_oi_noncomm_spread_1 | number | niepodane | Pct_of_OI_NonComm_Spread_Old |
| pct_of_oi_comm_long_old | number | niepodane | Pct_of_OI_Comm_Long_Old |
| pct_of_oi_comm_short_old | number | niepodane | Pct_of_OI_Comm_Short_Old |
| pct_of_oi_tot_rept_long_old | number | niepodane | Pct_of_OI_Tot_Rept_Long_Old |
| pct_of_oi_tot_rept_short_1 | number | niepodane | Pct_of_OI_Tot_Rept_Short_Old |
| pct_of_oi_nonrept_long_old | number | niepodane | Pct_of_OI_NonRept_Long_Old |
| pct_of_oi_nonrept_short_old | number | niepodane | Pct_of_OI_NonRept_Short_Old |
| pct_of_open_interest_other | number | niepodane | Pct_of_Open_Interest_Other |
| pct_of_oi_noncomm_long_other | number | niepodane | Pct_of_OI_NonComm_Long_Other |
| pct_of_oi_noncomm_short_other | number | niepodane | Pct_of_OI_NonComm_Short_Other |
| pct_of_oi_noncomm_spread_2 | number | niepodane | Pct_of_OI_NonComm_Spread_Other |
| pct_of_oi_comm_long_other | number | niepodane | Pct_of_OI_Comm_Long_Other |
| pct_of_oi_comm_short_other | number | niepodane | Pct_of_OI_Comm_Short_Other |
| pct_of_oi_tot_rept_long_other | number | niepodane | Pct_of_OI_Tot_Rept_Long_Other |
| pct_of_oi_tot_rept_short_2 | number | niepodane | Pct_of_OI_Tot_Rept_Short_Other |
| pct_of_oi_nonrept_long_other | number | niepodane | Pct_of_OI_NonRept_Long_Other |
| pct_of_oi_nonrept_short_other | number | niepodane | Pct_of_OI_NonRept_Short_Other |
| traders_tot_all | number | niepodane | Traders_Tot_All |
| traders_noncomm_long_all | number | niepodane | Traders_NonComm_Long_All |
| traders_noncomm_short_all | number | niepodane | Traders_NonComm_Short_All |
| traders_noncomm_spread_all | number | niepodane | Traders_NonComm_Spread_All |
| traders_comm_long_all | number | niepodane | Traders_Comm_Long_All |
| traders_comm_short_all | number | niepodane | Traders_Comm_Short_All |
| traders_tot_rept_long_all | number | niepodane | Traders_Tot_Rept_Long_All |
| traders_tot_rept_short_all | number | niepodane | Traders_Tot_Rept_Short_All |
| traders_tot_old | number | niepodane | Traders_Tot_Old |
| traders_noncomm_long_old | number | niepodane | Traders_NonComm_Long_Old |
| traders_noncomm_short_old | number | niepodane | Traders_NonComm_Short_Old |
| traders_noncomm_spead_old | number | niepodane | Traders_NonComm_Spead_Old |
| traders_comm_long_old | number | niepodane | Traders_Comm_Long_Old |
| traders_comm_short_old | number | niepodane | Traders_Comm_Short_Old |
| traders_tot_rept_long_old | number | niepodane | Traders_Tot_Rept_Long_Old |
| traders_tot_rept_short_old | number | niepodane | Traders_Tot_Rept_Short_Old |
| traders_tot_other | number | niepodane | Traders_Tot_Other |
| traders_noncomm_long_other | number | niepodane | Traders_NonComm_Long_Other |
| traders_noncomm_short_other | number | niepodane | Traders_NonComm_Short_Other |
| traders_noncomm_spread_other | number | niepodane | Traders_NonComm_Spread_Other |
| traders_comm_long_other | number | niepodane | Traders_Comm_Long_Other |
| traders_comm_short_other | number | niepodane | Traders_Comm_Short_Other |
| traders_tot_rept_long_other | number | niepodane | Traders_Tot_Rept_Long_Other |
| traders_tot_rept_short_other | number | niepodane | Traders_Tot_Rept_Short_Other |
| conc_gross_le_4_tdr_long | number | niepodane | Conc_Gross_LE_4_TDR_Long_All |
| conc_gross_le_4_tdr_short | number | niepodane | Conc_Gross_LE_4_TDR_Short_All |
| conc_gross_le_8_tdr_long | number | niepodane | Conc_Gross_LE_8_TDR_Long_All |
| conc_gross_le_8_tdr_short | number | niepodane | Conc_Gross_LE_8_TDR_Short_All |
| conc_net_le_4_tdr_long_all | number | niepodane | Conc_Net_LE_4_TDR_Long_All |
| conc_net_le_4_tdr_short_all | number | niepodane | Conc_Net_LE_4_TDR_Short_All |
| conc_net_le_8_tdr_long_all | number | niepodane | Conc_Net_LE_8_TDR_Long_All |
| conc_net_le_8_tdr_short_all | number | niepodane | Conc_Net_LE_8_TDR_Short_All |
| conc_gross_le_4_tdr_long_1 | number | niepodane | Conc_Gross_LE_4_TDR_Long_Old |
| conc_gross_le_4_tdr_short_1 | number | niepodane | Conc_Gross_LE_4_TDR_Short_Old |
| conc_gross_le_8_tdr_long_1 | number | niepodane | Conc_Gross_LE_8_TDR_Long_Old |
| conc_gross_le_8_tdr_short_1 | number | niepodane | Conc_Gross_LE_8_TDR_Short_Old |
| conc_net_le_4_tdr_long_old | number | niepodane | Conc_Net_LE_4_TDR_Long_Old |
| conc_net_le_4_tdr_short_old | number | niepodane | Conc_Net_LE_4_TDR_Short_Old |
| conc_net_le_8_tdr_long_old | number | niepodane | Conc_Net_LE_8_TDR_Long_Old |
| conc_net_le_8_tdr_short_old | number | niepodane | Conc_Net_LE_8_TDR_Short_Old |
| conc_gross_le_4_tdr_long_2 | number | niepodane | Conc_Gross_LE_4_TDR_Long_Other |
| conc_gross_le_4_tdr_short_2 | number | niepodane | Conc_Gross_LE_4_TDR_Short_Other |
| conc_gross_le_8_tdr_long_2 | number | niepodane | Conc_Gross_LE_8_TDR_Long_Other |
| conc_gross_le_8_tdr_short_2 | number | niepodane | Conc_Gross_LE_8_TDR_Short_Other |
| conc_net_le_4_tdr_long_other | number | niepodane | Conc_Net_LE_4_TDR_Long_Other |
| conc_net_le_4_tdr_short_other | number | niepodane | Conc_Net_LE_4_TDR_Short_Other |
| conc_net_le_8_tdr_long_other | number | niepodane | Conc_Net_LE_8_TDR_Long_Other |
| conc_net_le_8_tdr_short_other | number | niepodane | Conc_Net_LE_8_TDR_Short_Other |
| contract_units | text | niepodane | Contract_Units |
| commodity | text | niepodane | COMMODITY_NAME |
| commodity_subgroup_name | text | niepodane | COMMODITY_SUBGROUP_NAME |
| commodity_group_name | text | niepodane | COMMODITY_GROUP_NAME |
| futonly_or_combined | text | niepodane | FutOnly_or_Combined |

</details>

<details><summary>Pola: Legacy - Futures Only (6dca-aqww)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| id | text | niepodane | ID |
| market_and_exchange_names | text | niepodane | Market_and_Exchange_Names |
| report_date_as_yyyy_mm_dd | calendar_date | niepodane | Report_Date_as_YYYY_MM_DD |
| yyyy_report_week_ww | text | niepodane | YYYY Report Week WW |
| contract_market_name | text | niepodane | CONTRACT_MARKET_NAME |
| cftc_contract_market_code | text | niepodane | CFTC_Contract_Market_Code |
| cftc_market_code | text | niepodane | CFTC_Market_Code |
| cftc_region_code | text | niepodane | CFTC_Region_Code |
| cftc_commodity_code | text | niepodane | CFTC_Commodity_Code |
| commodity_name | text | niepodane | Commodity Name |
| open_interest_all | number | niepodane | Open_Interest_All |
| noncomm_positions_long_all | number | niepodane | NonComm_Positions_Long_All |
| noncomm_positions_short_all | number | niepodane | NonComm_Positions_Short_All |
| noncomm_postions_spread_all | number | niepodane | NonComm_Postions_Spread_All |
| comm_positions_long_all | number | niepodane | Comm_Positions_Long_All |
| comm_positions_short_all | number | niepodane | Comm_Positions_Short_All |
| tot_rept_positions_long_all | number | niepodane | Tot_Rept_Positions_Long_All |
| tot_rept_positions_short | number | niepodane | Tot_Rept_Positions_Short_All |
| nonrept_positions_long_all | number | niepodane | NonRept_Positions_Long_All |
| nonrept_positions_short_all | number | niepodane | NonRept_Positions_Short_All |
| open_interest_old | number | niepodane | Open_Interest_Old |
| noncomm_positions_long_old | number | niepodane | NonComm_Positions_Long_Old |
| noncomm_positions_short_old | number | niepodane | NonComm_Positions_Short_Old |
| noncomm_positions_spread | number | niepodane | NonComm_Positions_Spread_Old |
| comm_positions_long_old | number | niepodane | Comm_Positions_Long_Old |
| comm_positions_short_old | number | niepodane | Comm_Positions_Short_Old |
| tot_rept_positions_long_old | number | niepodane | Tot_Rept_Positions_Long_Old |
| tot_rept_positions_short_1 | number | niepodane | Tot_Rept_Positions_Short_Old |
| nonrept_positions_long_old | number | niepodane | NonRept_Positions_Long_Old |
| nonrept_positions_short_old | number | niepodane | NonRept_Positions_Short_Old |
| open_interest_other | number | niepodane | Open_Interest_Other |
| noncomm_positions_long_other | number | niepodane | NonComm_Positions_Long_Other |
| noncomm_positions_short_other | number | niepodane | NonComm_Positions_Short_Other |
| noncomm_positions_spread_1 | number | niepodane | NonComm_Positions_Spread_Other |
| comm_positions_long_other | number | niepodane | Comm_Positions_Long_Other |
| comm_positions_short_other | number | niepodane | Comm_Positions_Short_Other |
| tot_rept_positions_long_other | number | niepodane | Tot_Rept_Positions_Long_Other |
| tot_rept_positions_short_2 | number | niepodane | Tot_Rept_Positions_Short_Other |
| nonrept_positions_long_other | number | niepodane | NonRept_Positions_Long_Other |
| nonrept_positions_short_other | number | niepodane | NonRept_Positions_Short_Other |
| change_in_open_interest_all | number | niepodane | Change_in_Open_Interest_All |
| change_in_noncomm_long_all | number | niepodane | Change_in_NonComm_Long_All |
| change_in_noncomm_short_all | number | niepodane | Change_in_NonComm_Short_All |
| change_in_noncomm_spead_all | number | niepodane | Change_in_NonComm_Spead_All |
| change_in_comm_long_all | number | niepodane | Change_in_Comm_Long_All |
| change_in_comm_short_all | number | niepodane | Change_in_Comm_Short_All |
| change_in_tot_rept_long_all | number | niepodane | Change_in_Tot_Rept_Long_All |
| change_in_tot_rept_short | number | niepodane | Change_in_Tot_Rept_Short_All |
| change_in_nonrept_long_all | number | niepodane | Change_in_NonRept_Long_All |
| change_in_nonrept_short_all | number | niepodane | Change_in_NonRept_Short_All |
| pct_of_open_interest_all | number | niepodane | Pct_of_Open_Interest_All |
| pct_of_oi_noncomm_long_all | number | niepodane | Pct_of_OI_NonComm_Long_All |
| pct_of_oi_noncomm_short_all | number | niepodane | Pct_of_OI_NonComm_Short_All |
| pct_of_oi_noncomm_spread | number | niepodane | Pct_of_OI_NonComm_Spread_All |
| pct_of_oi_comm_long_all | number | niepodane | Pct_of_OI_Comm_Long_All |
| pct_of_oi_comm_short_all | number | niepodane | Pct_of_OI_Comm_Short_All |
| pct_of_oi_tot_rept_long_all | number | niepodane | Pct_of_OI_Tot_Rept_Long_All |
| pct_of_oi_tot_rept_short | number | niepodane | Pct_of_OI_Tot_Rept_Short_All |
| pct_of_oi_nonrept_long_all | number | niepodane | Pct_of_OI_NonRept_Long_All |
| pct_of_oi_nonrept_short_all | number | niepodane | Pct_of_OI_NonRept_Short_All |
| pct_of_open_interest_old | number | niepodane | Pct_of_Open_Interest_Old |
| pct_of_oi_noncomm_long_old | number | niepodane | Pct_of_OI_NonComm_Long_Old |
| pct_of_oi_noncomm_short_old | number | niepodane | Pct_of_OI_NonComm_Short_Old |
| pct_of_oi_noncomm_spread_1 | number | niepodane | Pct_of_OI_NonComm_Spread_Old |
| pct_of_oi_comm_long_old | number | niepodane | Pct_of_OI_Comm_Long_Old |
| pct_of_oi_comm_short_old | number | niepodane | Pct_of_OI_Comm_Short_Old |
| pct_of_oi_tot_rept_long_old | number | niepodane | Pct_of_OI_Tot_Rept_Long_Old |
| pct_of_oi_tot_rept_short_1 | number | niepodane | Pct_of_OI_Tot_Rept_Short_Old |
| pct_of_oi_nonrept_long_old | number | niepodane | Pct_of_OI_NonRept_Long_Old |
| pct_of_oi_nonrept_short_old | number | niepodane | Pct_of_OI_NonRept_Short_Old |
| pct_of_open_interest_other | number | niepodane | Pct_of_Open_Interest_Other |
| pct_of_oi_noncomm_long_other | number | niepodane | Pct_of_OI_NonComm_Long_Other |
| pct_of_oi_noncomm_short_other | number | niepodane | Pct_of_OI_NonComm_Short_Other |
| pct_of_oi_noncomm_spread_2 | number | niepodane | Pct_of_OI_NonComm_Spread_Other |
| pct_of_oi_comm_long_other | number | niepodane | Pct_of_OI_Comm_Long_Other |
| pct_of_oi_comm_short_other | number | niepodane | Pct_of_OI_Comm_Short_Other |
| pct_of_oi_tot_rept_long_other | number | niepodane | Pct_of_OI_Tot_Rept_Long_Other |
| pct_of_oi_tot_rept_short_2 | number | niepodane | Pct_of_OI_Tot_Rept_Short_Other |
| pct_of_oi_nonrept_long_other | number | niepodane | Pct_of_OI_NonRept_Long_Other |
| pct_of_oi_nonrept_short_other | number | niepodane | Pct_of_OI_NonRept_Short_Other |
| traders_tot_all | number | niepodane | Traders_Tot_All |
| traders_noncomm_long_all | number | niepodane | Traders_NonComm_Long_All |
| traders_noncomm_short_all | number | niepodane | Traders_NonComm_Short_All |
| traders_noncomm_spread_all | number | niepodane | Traders_NonComm_Spread_All |
| traders_comm_long_all | number | niepodane | Traders_Comm_Long_All |
| traders_comm_short_all | number | niepodane | Traders_Comm_Short_All |
| traders_tot_rept_long_all | number | niepodane | Traders_Tot_Rept_Long_All |
| traders_tot_rept_short_all | number | niepodane | Traders_Tot_Rept_Short_All |
| traders_tot_old | number | niepodane | Traders_Tot_Old |
| traders_noncomm_long_old | number | niepodane | Traders_NonComm_Long_Old |
| traders_noncomm_short_old | number | niepodane | Traders_NonComm_Short_Old |
| traders_noncomm_spead_old | number | niepodane | Traders_NonComm_Spead_Old |
| traders_comm_long_old | number | niepodane | Traders_Comm_Long_Old |
| traders_comm_short_old | number | niepodane | Traders_Comm_Short_Old |
| traders_tot_rept_long_old | number | niepodane | Traders_Tot_Rept_Long_Old |
| traders_tot_rept_short_old | number | niepodane | Traders_Tot_Rept_Short_Old |
| traders_tot_other | number | niepodane | Traders_Tot_Other |
| traders_noncomm_long_other | number | niepodane | Traders_NonComm_Long_Other |
| traders_noncomm_short_other | number | niepodane | Traders_NonComm_Short_Other |
| traders_noncomm_spread_other | number | niepodane | Traders_NonComm_Spread_Other |
| traders_comm_long_other | number | niepodane | Traders_Comm_Long_Other |
| traders_comm_short_other | number | niepodane | Traders_Comm_Short_Other |
| traders_tot_rept_long_other | number | niepodane | Traders_Tot_Rept_Long_Other |
| traders_tot_rept_short_other | number | niepodane | Traders_Tot_Rept_Short_Other |
| conc_gross_le_4_tdr_long | number | niepodane | Conc_Gross_LE_4_TDR_Long_All |
| conc_gross_le_4_tdr_short | number | niepodane | Conc_Gross_LE_4_TDR_Short_All |
| conc_gross_le_8_tdr_long | number | niepodane | Conc_Gross_LE_8_TDR_Long_All |
| conc_gross_le_8_tdr_short | number | niepodane | Conc_Gross_LE_8_TDR_Short_All |
| conc_net_le_4_tdr_long_all | number | niepodane | Conc_Net_LE_4_TDR_Long_All |
| conc_net_le_4_tdr_short_all | number | niepodane | Conc_Net_LE_4_TDR_Short_All |
| conc_net_le_8_tdr_long_all | number | niepodane | Conc_Net_LE_8_TDR_Long_All |
| conc_net_le_8_tdr_short_all | number | niepodane | Conc_Net_LE_8_TDR_Short_All |
| conc_gross_le_4_tdr_long_1 | number | niepodane | Conc_Gross_LE_4_TDR_Long_Old |
| conc_gross_le_4_tdr_short_1 | number | niepodane | Conc_Gross_LE_4_TDR_Short_Old |
| conc_gross_le_8_tdr_long_1 | number | niepodane | Conc_Gross_LE_8_TDR_Long_Old |
| conc_gross_le_8_tdr_short_1 | number | niepodane | Conc_Gross_LE_8_TDR_Short_Old |
| conc_net_le_4_tdr_long_old | number | niepodane | Conc_Net_LE_4_TDR_Long_Old |
| conc_net_le_4_tdr_short_old | number | niepodane | Conc_Net_LE_4_TDR_Short_Old |
| conc_net_le_8_tdr_long_old | number | niepodane | Conc_Net_LE_8_TDR_Long_Old |
| conc_net_le_8_tdr_short_old | number | niepodane | Conc_Net_LE_8_TDR_Short_Old |
| conc_gross_le_4_tdr_long_2 | number | niepodane | Conc_Gross_LE_4_TDR_Long_Other |
| conc_gross_le_4_tdr_short_2 | number | niepodane | Conc_Gross_LE_4_TDR_Short_Other |
| conc_gross_le_8_tdr_long_2 | number | niepodane | Conc_Gross_LE_8_TDR_Long_Other |
| conc_gross_le_8_tdr_short_2 | number | niepodane | Conc_Gross_LE_8_TDR_Short_Other |
| conc_net_le_4_tdr_long_other | number | niepodane | Conc_Net_LE_4_TDR_Long_Other |
| conc_net_le_4_tdr_short_other | number | niepodane | Conc_Net_LE_4_TDR_Short_Other |
| conc_net_le_8_tdr_long_other | number | niepodane | Conc_Net_LE_8_TDR_Long_Other |
| conc_net_le_8_tdr_short_other | number | niepodane | Conc_Net_LE_8_TDR_Short_Other |
| contract_units | text | niepodane | Contract_Units |
| commodity | text | niepodane | COMMODITY_NAME |
| commodity_subgroup_name | text | niepodane | COMMODITY_SUBGROUP_NAME |
| commodity_group_name | text | niepodane | COMMODITY_GROUP_NAME |
| futonly_or_combined | text | niepodane | FutOnly_or_Combined |

</details>

<details><summary>Pola: ProductHierarchy (rj6x-va3z)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| contract_market_code | text | niepodane | CONTRACT_MARKET_CODE |
| commodity_name | text | niepodane | COMMODITY_NAME |
| commodity_subgroup_name | text | niepodane | COMMODITY_SUBGROUP_NAME |
| commodity_group_name | text | niepodane | COMMODITY_GROUP_NAME |

</details>

<details><summary>Pola: Legacy_All (srt6-5q2f)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| id | text | niepodane | ID |
| market_and_exchange_names | text | niepodane | Market_and_Exchange_Names |
| contract_market_name | text | niepodane | CONTRACT_MARKET_NAME |
| report_date_as_yyyy_mm_dd | calendar_date | niepodane | Report_Date_as_YYYY_MM_DD |
| yyyy_report_week_ww | text | niepodane | YYYY Report Week WW |
| cftc_contract_market_code | text | niepodane | CFTC_Contract_Market_Code |
| cftc_market_code | text | niepodane | CFTC_Market_Code |
| cftc_region_code | text | niepodane | CFTC_Region_Code |
| cftc_commodity_code | text | niepodane | CFTC_Commodity_Code |
| commodity_name | text | niepodane | Commodity Name |
| open_interest_all | number | niepodane | Open_Interest_All |
| noncomm_positions_long_all | number | niepodane | NonComm_Positions_Long_All |
| noncomm_positions_short_all | number | niepodane | NonComm_Positions_Short_All |
| noncomm_postions_spread_all | number | niepodane | NonComm_Postions_Spread_All |
| comm_positions_long_all | number | niepodane | Comm_Positions_Long_All |
| comm_positions_short_all | number | niepodane | Comm_Positions_Short_All |
| tot_rept_positions_long_all | number | niepodane | Tot_Rept_Positions_Long_All |
| tot_rept_positions_short | number | niepodane | Tot_Rept_Positions_Short_All |
| nonrept_positions_long_all | number | niepodane | NonRept_Positions_Long_All |
| nonrept_positions_short_all | number | niepodane | NonRept_Positions_Short_All |
| open_interest_old | number | niepodane | Open_Interest_Old |
| noncomm_positions_long_old | number | niepodane | NonComm_Positions_Long_Old |
| noncomm_positions_short_old | number | niepodane | NonComm_Positions_Short_Old |
| noncomm_positions_spread | number | niepodane | NonComm_Positions_Spread_Old |
| comm_positions_long_old | number | niepodane | Comm_Positions_Long_Old |
| comm_positions_short_old | number | niepodane | Comm_Positions_Short_Old |
| tot_rept_positions_long_old | number | niepodane | Tot_Rept_Positions_Long_Old |
| tot_rept_positions_short_1 | number | niepodane | Tot_Rept_Positions_Short_Old |
| nonrept_positions_long_old | number | niepodane | NonRept_Positions_Long_Old |
| nonrept_positions_short_old | number | niepodane | NonRept_Positions_Short_Old |
| open_interest_other | number | niepodane | Open_Interest_Other |
| noncomm_positions_long_other | number | niepodane | NonComm_Positions_Long_Other |
| noncomm_positions_short_other | number | niepodane | NonComm_Positions_Short_Other |
| noncomm_positions_spread_1 | number | niepodane | NonComm_Positions_Spread_Other |
| comm_positions_long_other | number | niepodane | Comm_Positions_Long_Other |
| comm_positions_short_other | number | niepodane | Comm_Positions_Short_Other |
| tot_rept_positions_long_other | number | niepodane | Tot_Rept_Positions_Long_Other |
| tot_rept_positions_short_2 | number | niepodane | Tot_Rept_Positions_Short_Other |
| nonrept_positions_long_other | number | niepodane | NonRept_Positions_Long_Other |
| nonrept_positions_short_other | number | niepodane | NonRept_Positions_Short_Other |
| change_in_open_interest_all | number | niepodane | Change_in_Open_Interest_All |
| change_in_noncomm_long_all | number | niepodane | Change_in_NonComm_Long_All |
| change_in_noncomm_short_all | number | niepodane | Change_in_NonComm_Short_All |
| change_in_noncomm_spead_all | number | niepodane | Change_in_NonComm_Spead_All |
| change_in_comm_long_all | number | niepodane | Change_in_Comm_Long_All |
| change_in_comm_short_all | number | niepodane | Change_in_Comm_Short_All |
| change_in_tot_rept_long_all | number | niepodane | Change_in_Tot_Rept_Long_All |
| change_in_tot_rept_short | number | niepodane | Change_in_Tot_Rept_Short_All |
| change_in_nonrept_long_all | number | niepodane | Change_in_NonRept_Long_All |
| change_in_nonrept_short_all | number | niepodane | Change_in_NonRept_Short_All |
| pct_of_open_interest_all | number | niepodane | Pct_of_Open_Interest_All |
| pct_of_oi_noncomm_long_all | number | niepodane | Pct_of_OI_NonComm_Long_All |
| pct_of_oi_noncomm_short_all | number | niepodane | Pct_of_OI_NonComm_Short_All |
| pct_of_oi_noncomm_spread | number | niepodane | Pct_of_OI_NonComm_Spread_All |
| pct_of_oi_comm_long_all | number | niepodane | Pct_of_OI_Comm_Long_All |
| pct_of_oi_comm_short_all | number | niepodane | Pct_of_OI_Comm_Short_All |
| pct_of_oi_tot_rept_long_all | number | niepodane | Pct_of_OI_Tot_Rept_Long_All |
| pct_of_oi_tot_rept_short | number | niepodane | Pct_of_OI_Tot_Rept_Short_All |
| pct_of_oi_nonrept_long_all | number | niepodane | Pct_of_OI_NonRept_Long_All |
| pct_of_oi_nonrept_short_all | number | niepodane | Pct_of_OI_NonRept_Short_All |
| pct_of_open_interest_old | number | niepodane | Pct_of_Open_Interest_Old |
| pct_of_oi_noncomm_long_old | number | niepodane | Pct_of_OI_NonComm_Long_Old |
| pct_of_oi_noncomm_short_old | number | niepodane | Pct_of_OI_NonComm_Short_Old |
| pct_of_oi_noncomm_spread_1 | number | niepodane | Pct_of_OI_NonComm_Spread_Old |
| pct_of_oi_comm_long_old | number | niepodane | Pct_of_OI_Comm_Long_Old |
| pct_of_oi_comm_short_old | number | niepodane | Pct_of_OI_Comm_Short_Old |
| pct_of_oi_tot_rept_long_old | number | niepodane | Pct_of_OI_Tot_Rept_Long_Old |
| pct_of_oi_tot_rept_short_1 | number | niepodane | Pct_of_OI_Tot_Rept_Short_Old |
| pct_of_oi_nonrept_long_old | number | niepodane | Pct_of_OI_NonRept_Long_Old |
| pct_of_oi_nonrept_short_old | number | niepodane | Pct_of_OI_NonRept_Short_Old |
| pct_of_open_interest_other | number | niepodane | Pct_of_Open_Interest_Other |
| pct_of_oi_noncomm_long_other | number | niepodane | Pct_of_OI_NonComm_Long_Other |
| pct_of_oi_noncomm_short_other | number | niepodane | Pct_of_OI_NonComm_Short_Other |
| pct_of_oi_noncomm_spread_2 | number | niepodane | Pct_of_OI_NonComm_Spread_Other |
| pct_of_oi_comm_long_other | number | niepodane | Pct_of_OI_Comm_Long_Other |
| pct_of_oi_comm_short_other | number | niepodane | Pct_of_OI_Comm_Short_Other |
| pct_of_oi_tot_rept_long_other | number | niepodane | Pct_of_OI_Tot_Rept_Long_Other |
| pct_of_oi_tot_rept_short_2 | number | niepodane | Pct_of_OI_Tot_Rept_Short_Other |
| pct_of_oi_nonrept_long_other | number | niepodane | Pct_of_OI_NonRept_Long_Other |
| pct_of_oi_nonrept_short_other | number | niepodane | Pct_of_OI_NonRept_Short_Other |
| traders_tot_all | number | niepodane | Traders_Tot_All |
| traders_noncomm_long_all | number | niepodane | Traders_NonComm_Long_All |
| traders_noncomm_short_all | number | niepodane | Traders_NonComm_Short_All |
| traders_noncomm_spread_all | number | niepodane | Traders_NonComm_Spread_All |
| traders_comm_long_all | number | niepodane | Traders_Comm_Long_All |
| traders_comm_short_all | number | niepodane | Traders_Comm_Short_All |
| traders_tot_rept_long_all | number | niepodane | Traders_Tot_Rept_Long_All |
| traders_tot_rept_short_all | number | niepodane | Traders_Tot_Rept_Short_All |
| traders_tot_old | number | niepodane | Traders_Tot_Old |
| traders_noncomm_long_old | number | niepodane | Traders_NonComm_Long_Old |
| traders_noncomm_short_old | number | niepodane | Traders_NonComm_Short_Old |
| traders_noncomm_spead_old | number | niepodane | Traders_NonComm_Spead_Old |
| traders_comm_long_old | number | niepodane | Traders_Comm_Long_Old |
| traders_comm_short_old | number | niepodane | Traders_Comm_Short_Old |
| traders_tot_rept_long_old | number | niepodane | Traders_Tot_Rept_Long_Old |
| traders_tot_rept_short_old | number | niepodane | Traders_Tot_Rept_Short_Old |
| traders_tot_other | number | niepodane | Traders_Tot_Other |
| traders_noncomm_long_other | number | niepodane | Traders_NonComm_Long_Other |
| traders_noncomm_short_other | number | niepodane | Traders_NonComm_Short_Other |
| traders_noncomm_spread_other | number | niepodane | Traders_NonComm_Spread_Other |
| traders_comm_long_other | number | niepodane | Traders_Comm_Long_Other |
| traders_comm_short_other | number | niepodane | Traders_Comm_Short_Other |
| traders_tot_rept_long_other | number | niepodane | Traders_Tot_Rept_Long_Other |
| traders_tot_rept_short_other | number | niepodane | Traders_Tot_Rept_Short_Other |
| conc_gross_le_4_tdr_long | number | niepodane | Conc_Gross_LE_4_TDR_Long_All |
| conc_gross_le_4_tdr_short | number | niepodane | Conc_Gross_LE_4_TDR_Short_All |
| conc_gross_le_8_tdr_long | number | niepodane | Conc_Gross_LE_8_TDR_Long_All |
| conc_gross_le_8_tdr_short | number | niepodane | Conc_Gross_LE_8_TDR_Short_All |
| conc_net_le_4_tdr_long_all | number | niepodane | Conc_Net_LE_4_TDR_Long_All |
| conc_net_le_4_tdr_short_all | number | niepodane | Conc_Net_LE_4_TDR_Short_All |
| conc_net_le_8_tdr_long_all | number | niepodane | Conc_Net_LE_8_TDR_Long_All |
| conc_net_le_8_tdr_short_all | number | niepodane | Conc_Net_LE_8_TDR_Short_All |
| conc_gross_le_4_tdr_long_1 | number | niepodane | Conc_Gross_LE_4_TDR_Long_Old |
| conc_gross_le_4_tdr_short_1 | number | niepodane | Conc_Gross_LE_4_TDR_Short_Old |
| conc_gross_le_8_tdr_long_1 | number | niepodane | Conc_Gross_LE_8_TDR_Long_Old |
| conc_gross_le_8_tdr_short_1 | number | niepodane | Conc_Gross_LE_8_TDR_Short_Old |
| conc_net_le_4_tdr_long_old | number | niepodane | Conc_Net_LE_4_TDR_Long_Old |
| conc_net_le_4_tdr_short_old | number | niepodane | Conc_Net_LE_4_TDR_Short_Old |
| conc_net_le_8_tdr_long_old | number | niepodane | Conc_Net_LE_8_TDR_Long_Old |
| conc_net_le_8_tdr_short_old | number | niepodane | Conc_Net_LE_8_TDR_Short_Old |
| conc_gross_le_4_tdr_long_2 | number | niepodane | Conc_Gross_LE_4_TDR_Long_Other |
| conc_gross_le_4_tdr_short_2 | number | niepodane | Conc_Gross_LE_4_TDR_Short_Other |
| conc_gross_le_8_tdr_long_2 | number | niepodane | Conc_Gross_LE_8_TDR_Long_Other |
| conc_gross_le_8_tdr_short_2 | number | niepodane | Conc_Gross_LE_8_TDR_Short_Other |
| conc_net_le_4_tdr_long_other | number | niepodane | Conc_Net_LE_4_TDR_Long_Other |
| conc_net_le_4_tdr_short_other | number | niepodane | Conc_Net_LE_4_TDR_Short_Other |
| conc_net_le_8_tdr_long_other | number | niepodane | Conc_Net_LE_8_TDR_Long_Other |
| conc_net_le_8_tdr_short_other | number | niepodane | Conc_Net_LE_8_TDR_Short_Other |
| contract_units | text | niepodane | Contract_Units |
| futonly_or_combined | text | niepodane | FutOnly_or_Combined |

</details>

<details><summary>Pola: Disaggregated_All (rxbv-e226)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| id | text | niepodane | ID |
| market_and_exchange_names | text | niepodane | Market_and_Exchange_Names |
| contract_market_name | text | niepodane | Contract_Market_Name |
| report_date_as_yyyy_mm_dd | calendar_date | niepodane | Report_Date_as_YYYY_MM_DD |
| yyyy_report_week_ww | text | niepodane | YYYY Report Week WW |
| cftc_contract_market_code | text | niepodane | CFTC_Contract_Market_Code |
| cftc_market_code | text | niepodane | CFTC_Market_Code |
| cftc_region_code | text | niepodane | CFTC_Region_Code |
| cftc_commodity_code | text | niepodane | CFTC_Commodity_Code |
| commodity_name | text | niepodane | Commodity Name |
| open_interest_all | number | niepodane | Open_Interest_All |
| prod_merc_positions_long | number | niepodane | Prod_Merc_Positions_Long_All |
| prod_merc_positions_short | number | niepodane | Prod_Merc_Positions_Short_All |
| swap_positions_long_all | number | niepodane | Swap_Positions_Long_All |
| swap__positions_short_all | number | niepodane | Swap__Positions_Short_All |
| swap__positions_spread_all | number | niepodane | Swap__Positions_Spread_All |
| m_money_positions_long_all | number | niepodane | M_Money_Positions_Long_All |
| m_money_positions_short_all | number | niepodane | M_Money_Positions_Short_All |
| m_money_positions_spread | number | niepodane | M_Money_Positions_Spread_All |
| other_rept_positions_long | number | niepodane | Other_Rept_Positions_Long_All |
| other_rept_positions_short | number | niepodane | Other_Rept_Positions_Short_All |
| other_rept_positions_spread | number | niepodane | Other_Rept_Positions_Spread_All |
| tot_rept_positions_long_all | number | niepodane | Tot_Rept_Positions_Long_All |
| tot_rept_positions_short | number | niepodane | Tot_Rept_Positions_Short_All |
| nonrept_positions_long_all | number | niepodane | NonRept_Positions_Long_All |
| nonrept_positions_short_all | number | niepodane | NonRept_Positions_Short_All |
| open_interest_old | number | niepodane | Open_Interest_Old |
| prod_merc_positions_long_1 | number | niepodane | Prod_Merc_Positions_Long_Old |
| prod_merc_positions_short_1 | number | niepodane | Prod_Merc_Positions_Short_Old |
| swap_positions_long_old | number | niepodane | Swap_Positions_Long_Old |
| swap__positions_short_old | number | niepodane | Swap__Positions_Short_Old |
| swap__positions_spread_old | number | niepodane | Swap__Positions_Spread_Old |
| m_money_positions_long_old | number | niepodane | M_Money_Positions_Long_Old |
| m_money_positions_short_old | number | niepodane | M_Money_Positions_Short_Old |
| m_money_positions_spread_1 | number | niepodane | M_Money_Positions_Spread_Old |
| other_rept_positions_long_1 | number | niepodane | Other_Rept_Positions_Long_Old |
| other_rept_positions_short_1 | number | niepodane | Other_Rept_Positions_Short_Old |
| other_rept_positions_spread_1 | number | niepodane | Other_Rept_Positions_Spread_Old |
| tot_rept_positions_long_old | number | niepodane | Tot_Rept_Positions_Long_Old |
| tot_rept_positions_short_1 | number | niepodane | Tot_Rept_Positions_Short_Old |
| nonrept_positions_long_old | number | niepodane | NonRept_Positions_Long_Old |
| nonrept_positions_short_old | number | niepodane | NonRept_Positions_Short_Old |
| open_interest_other | number | niepodane | Open_Interest_Other |
| prod_merc_positions_long_2 | number | niepodane | Prod_Merc_Positions_Long_Other |
| prod_merc_positions_short_2 | number | niepodane | Prod_Merc_Positions_Short_Other |
| swap_positions_long_other | number | niepodane | Swap_Positions_Long_Other |
| swap__positions_short_other | number | niepodane | Swap__Positions_Short_Other |
| swap__positions_spread_other | number | niepodane | Swap__Positions_Spread_Other |
| m_money_positions_long_other | number | niepodane | M_Money_Positions_Long_Other |
| m_money_positions_short_other | number | niepodane | M_Money_Positions_Short_Other |
| m_money_positions_spread_2 | number | niepodane | M_Money_Positions_Spread_Other |
| other_rept_positions_long_2 | number | niepodane | Other_Rept_Positions_Long_Other |
| other_rept_positions_short_2 | number | niepodane | Other_Rept_Positions_Short_Other |
| other_rept_positions_spread_2 | number | niepodane | Other_Rept_Positions_Spread_Other |
| tot_rept_positions_long_other | number | niepodane | Tot_Rept_Positions_Long_Other |
| tot_rept_positions_short_2 | number | niepodane | Tot_Rept_Positions_Short_Other |
| nonrept_positions_long_other | number | niepodane | NonRept_Positions_Long_Other |
| nonrept_positions_short_other | number | niepodane | NonRept_Positions_Short_Other |
| change_in_open_interest_all | number | niepodane | Change_in_Open_Interest_All |
| change_in_prod_merc_long | number | niepodane | Change_in_Prod_Merc_Long_All |
| change_in_prod_merc_short | number | niepodane | Change_in_Prod_Merc_Short_All |
| change_in_swap_long_all | number | niepodane | Change_in_Swap_Long_All |
| change_in_swap_short_all | number | niepodane | Change_in_Swap_Short_All |
| change_in_swap_spread_all | number | niepodane | Change_in_Swap_Spread_All |
| change_in_m_money_long_all | number | niepodane | Change_in_M_Money_Long_All |
| change_in_m_money_short_all | number | niepodane | Change_in_M_Money_Short_All |
| change_in_m_money_spread | number | niepodane | Change_in_M_Money_Spread_All |
| change_in_other_rept_long | number | niepodane | Change_in_Other_Rept_Long_All |
| change_in_other_rept_short | number | niepodane | Change_in_Other_Rept_Short_All |
| change_in_other_rept_spread | number | niepodane | Change_in_Other_Rept_Spread_All |
| change_in_tot_rept_long_all | number | niepodane | Change_in_Tot_Rept_Long_All |
| change_in_tot_rept_short | number | niepodane | Change_in_Tot_Rept_Short_All |
| change_in_nonrept_long_all | number | niepodane | Change_in_NonRept_Long_All |
| change_in_nonrept_short_all | number | niepodane | Change_in_NonRept_Short_All |
| pct_of_open_interest_all | number | niepodane | Pct_of_Open_Interest_All |
| pct_of_oi_prod_merc_long | number | niepodane | Pct_of_OI_Prod_Merc_Long_All |
| pct_of_oi_prod_merc_short | number | niepodane | Pct_of_OI_Prod_Merc_Short_All |
| pct_of_oi_swap_long_all | number | niepodane | Pct_of_OI_Swap_Long_All |
| pct_of_oi_swap_short_all | number | niepodane | Pct_of_OI_Swap_Short_All |
| pct_of_oi_swap_spread_all | number | niepodane | Pct_of_OI_Swap_Spread_All |
| pct_of_oi_m_money_long_all | number | niepodane | Pct_of_OI_M_Money_Long_All |
| pct_of_oi_m_money_short_all | number | niepodane | Pct_of_OI_M_Money_Short_All |
| pct_of_oi_m_money_spread | number | niepodane | Pct_of_OI_M_Money_Spread_All |
| pct_of_oi_other_rept_long | number | niepodane | Pct_of_OI_Other_Rept_Long_All |
| pct_of_oi_other_rept_short | number | niepodane | Pct_of_OI_Other_Rept_Short_All |
| pct_of_oi_other_rept_spread | number | niepodane | Pct_of_OI_Other_Rept_Spread_All |
| pct_of_oi_tot_rept_long_all | number | niepodane | Pct_of_OI_Tot_Rept_Long_All |
| pct_of_oi_tot_rept_short | number | niepodane | Pct_of_OI_Tot_Rept_Short_All |
| pct_of_oi_nonrept_long_all | number | niepodane | Pct_of_OI_NonRept_Long_All |
| pct_of_oi_nonrept_short_all | number | niepodane | Pct_of_OI_NonRept_Short_All |
| pct_of_open_interest_old | number | niepodane | Pct_of_Open_Interest_Old |
| pct_of_oi_prod_merc_long_1 | number | niepodane | Pct_of_OI_Prod_Merc_Long_Old |
| pct_of_oi_prod_merc_short_1 | number | niepodane | Pct_of_OI_Prod_Merc_Short_Old |
| pct_of_oi_swap_long_old | number | niepodane | Pct_of_OI_Swap_Long_Old |
| pct_of_oi_swap_short_old | number | niepodane | Pct_of_OI_Swap_Short_Old |
| pct_of_oi_swap_spread_old | number | niepodane | Pct_of_OI_Swap_Spread_Old |
| pct_of_oi_m_money_long_old | number | niepodane | Pct_of_OI_M_Money_Long_Old |
| pct_of_oi_m_money_short_old | number | niepodane | Pct_of_OI_M_Money_Short_Old |
| pct_of_oi_m_money_spread_1 | number | niepodane | Pct_of_OI_M_Money_Spread_Old |
| pct_of_oi_other_rept_long_1 | number | niepodane | Pct_of_OI_Other_Rept_Long_Old |
| pct_of_oi_other_rept_short_1 | number | niepodane | Pct_of_OI_Other_Rept_Short_Old |
| pct_of_oi_other_rept_spread_1 | number | niepodane | Pct_of_OI_Other_Rept_Spread_Old |
| pct_of_oi_tot_rept_long_old | number | niepodane | Pct_of_OI_Tot_Rept_Long_Old |
| pct_of_oi_tot_rept_short_1 | number | niepodane | Pct_of_OI_Tot_Rept_Short_Old |
| pct_of_oi_nonrept_long_old | number | niepodane | Pct_of_OI_NonRept_Long_Old |
| pct_of_oi_nonrept_short_old | number | niepodane | Pct_of_OI_NonRept_Short_Old |
| pct_of_open_interest_other | number | niepodane | Pct_of_Open_Interest_Other |
| pct_of_oi_prod_merc_long_2 | number | niepodane | Pct_of_OI_Prod_Merc_Long_Other |
| pct_of_oi_prod_merc_short_2 | number | niepodane | Pct_of_OI_Prod_Merc_Short_Other |
| pct_of_oi_swap_long_other | number | niepodane | Pct_of_OI_Swap_Long_Other |
| pct_of_oi_swap_short_other | number | niepodane | Pct_of_OI_Swap_Short_Other |
| pct_of_oi_swap_spread_other | number | niepodane | Pct_of_OI_Swap_Spread_Other |
| pct_of_oi_m_money_long_other | number | niepodane | Pct_of_OI_M_Money_Long_Other |
| pct_of_oi_m_money_short_other | number | niepodane | Pct_of_OI_M_Money_Short_Other |
| pct_of_oi_m_money_spread_2 | number | niepodane | Pct_of_OI_M_Money_Spread_Other |
| pct_of_oi_other_rept_long_2 | number | niepodane | Pct_of_OI_Other_Rept_Long_Other |
| pct_of_oi_other_rept_short_2 | number | niepodane | Pct_of_OI_Other_Rept_Short_Other |
| pct_of_oi_other_rept_spread_2 | number | niepodane | Pct_of_OI_Other_Rept_Spread_Other |
| pct_of_oi_tot_rept_long_other | number | niepodane | Pct_of_OI_Tot_Rept_Long_Other |
| pct_of_oi_tot_rept_short_2 | number | niepodane | Pct_of_OI_Tot_Rept_Short_Other |
| pct_of_oi_nonrept_long_other | number | niepodane | Pct_of_OI_NonRept_Long_Other |
| pct_of_oi_nonrept_short_other | number | niepodane | Pct_of_OI_NonRept_Short_Other |
| traders_tot_all | number | niepodane | Traders_Tot_All |
| traders_prod_merc_long_all | number | niepodane | Traders_Prod_Merc_Long_All |
| traders_prod_merc_short_all | number | niepodane | Traders_Prod_Merc_Short_All |
| traders_swap_long_all | number | niepodane | Traders_Swap_Long_All |
| traders_swap_short_all | number | niepodane | Traders_Swap_Short_All |
| traders_swap_spread_all | number | niepodane | Traders_Swap_Spread_All |
| traders_m_money_long_all | number | niepodane | Traders_M_Money_Long_All |
| traders_m_money_short_all | number | niepodane | Traders_M_Money_Short_All |
| traders_m_money_spread_all | number | niepodane | Traders_M_Money_Spread_All |
| traders_other_rept_long_all | number | niepodane | Traders_Other_Rept_Long_All |
| traders_other_rept_short | number | niepodane | Traders_Other_Rept_Short_All |
| traders_other_rept_spread | number | niepodane | Traders_Other_Rept_Spread_All |
| traders_tot_rept_long_all | number | niepodane | Traders_Tot_Rept_Long_All |
| traders_tot_rept_short_all | number | niepodane | Traders_Tot_Rept_Short_All |
| traders_tot_old | number | niepodane | Traders_Tot_Old |
| traders_prod_merc_long_old | number | niepodane | Traders_Prod_Merc_Long_Old |
| traders_prod_merc_short_old | number | niepodane | Traders_Prod_Merc_Short_Old |
| traders_swap_long_old | number | niepodane | Traders_Swap_Long_Old |
| traders_swap_short_old | number | niepodane | Traders_Swap_Short_Old |
| traders_swap_spread_old | number | niepodane | Traders_Swap_Spread_Old |
| traders_m_money_long_old | number | niepodane | Traders_M_Money_Long_Old |
| traders_m_money_short_old | number | niepodane | Traders_M_Money_Short_Old |
| traders_m_money_spread_old | number | niepodane | Traders_M_Money_Spread_Old |
| traders_other_rept_long_old | number | niepodane | Traders_Other_Rept_Long_Old |
| traders_other_rept_short_1 | number | niepodane | Traders_Other_Rept_Short_Old |
| traders_other_rept_spread_1 | number | niepodane | Traders_Other_Rept_Spread_Old |
| traders_tot_rept_long_old | number | niepodane | Traders_Tot_Rept_Long_Old |
| traders_tot_rept_short_old | number | niepodane | Traders_Tot_Rept_Short_Old |
| traders_tot_other | number | niepodane | Traders_Tot_Other |
| traders_prod_merc_long_other | number | niepodane | Traders_Prod_Merc_Long_Other |
| traders_prod_merc_short_other | number | niepodane | Traders_Prod_Merc_Short_Other |
| traders_swap_long_other | number | niepodane | Traders_Swap_Long_Other |
| traders_swap_short_other | number | niepodane | Traders_Swap_Short_Other |
| traders_swap_spread_other | number | niepodane | Traders_Swap_Spread_Other |
| traders_m_money_long_other | number | niepodane | Traders_M_Money_Long_Other |
| traders_m_money_short_other | number | niepodane | Traders_M_Money_Short_Other |
| traders_m_money_spread_other | number | niepodane | Traders_M_Money_Spread_Other |
| traders_other_rept_long_other | number | niepodane | Traders_Other_Rept_Long_Other |
| traders_other_rept_short_2 | number | niepodane | Traders_Other_Rept_Short_Other |
| traders_other_rept_spread_2 | number | niepodane | Traders_Other_Rept_Spread_Other |
| traders_tot_rept_long_other | number | niepodane | Traders_Tot_Rept_Long_Other |
| traders_tot_rept_short_other | number | niepodane | Traders_Tot_Rept_Short_Other |
| conc_gross_le_4_tdr_long | number | niepodane | Conc_Gross_LE_4_TDR_Long_All |
| conc_gross_le_4_tdr_short | number | niepodane | Conc_Gross_LE_4_TDR_Short_All |
| conc_gross_le_8_tdr_long | number | niepodane | Conc_Gross_LE_8_TDR_Long_All |
| conc_gross_le_8_tdr_short | number | niepodane | Conc_Gross_LE_8_TDR_Short_All |
| conc_net_le_4_tdr_long_all | number | niepodane | Conc_Net_LE_4_TDR_Long_All |
| conc_net_le_4_tdr_short_all | number | niepodane | Conc_Net_LE_4_TDR_Short_All |
| conc_net_le_8_tdr_long_all | number | niepodane | Conc_Net_LE_8_TDR_Long_All |
| conc_net_le_8_tdr_short_all | number | niepodane | Conc_Net_LE_8_TDR_Short_All |
| conc_gross_le_4_tdr_long_1 | number | niepodane | Conc_Gross_LE_4_TDR_Long_Old |
| conc_gross_le_4_tdr_short_1 | number | niepodane | Conc_Gross_LE_4_TDR_Short_Old |
| conc_gross_le_8_tdr_long_1 | number | niepodane | Conc_Gross_LE_8_TDR_Long_Old |
| conc_gross_le_8_tdr_short_1 | number | niepodane | Conc_Gross_LE_8_TDR_Short_Old |
| conc_net_le_4_tdr_long_old | number | niepodane | Conc_Net_LE_4_TDR_Long_Old |
| conc_net_le_4_tdr_short_old | number | niepodane | Conc_Net_LE_4_TDR_Short_Old |
| conc_net_le_8_tdr_long_old | number | niepodane | Conc_Net_LE_8_TDR_Long_Old |
| conc_net_le_8_tdr_short_old | number | niepodane | Conc_Net_LE_8_TDR_Short_Old |
| conc_gross_le_4_tdr_long_2 | number | niepodane | Conc_Gross_LE_4_TDR_Long_Other |
| conc_gross_le_4_tdr_short_2 | number | niepodane | Conc_Gross_LE_4_TDR_Short_Other |
| conc_gross_le_8_tdr_long_2 | number | niepodane | Conc_Gross_LE_8_TDR_Long_Other |
| conc_gross_le_8_tdr_short_2 | number | niepodane | Conc_Gross_LE_8_TDR_Short_Other |
| conc_net_le_4_tdr_long_other | number | niepodane | Conc_Net_LE_4_TDR_Long_Other |
| conc_net_le_4_tdr_short_other | number | niepodane | Conc_Net_LE_4_TDR_Short_Other |
| conc_net_le_8_tdr_long_other | number | niepodane | Conc_Net_LE_8_TDR_Long_Other |
| conc_net_le_8_tdr_short_other | number | niepodane | Conc_Net_LE_8_TDR_Short_Other |
| contract_units | text | niepodane | Contract_Units |
| cftc_subgroup_code | text | niepodane | CFTC_SubGroup_Code |
| futonly_or_combined | text | niepodane | FutOnly_or_Combined |

</details>

<details><summary>Pola: TFF_All (udgc-27he)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| id | text | niepodane | ID |
| market_and_exchange_names | text | niepodane | Market_and_Exchange_Names |
| contract_market_name | text | niepodane | CONTRACT_MARKET_NAME |
| report_date_as_yyyy_mm_dd | calendar_date | niepodane | Report_Date_as_YYYY_MM_DD |
| yyyy_report_week_ww | text | niepodane | YYYY Report Week WW |
| cftc_contract_market_code | text | niepodane | CFTC_Contract_Market_Code |
| cftc_market_code | text | niepodane | CFTC_Market_Code |
| cftc_region_code | text | niepodane | CFTC_Region_Code |
| cftc_commodity_code | text | niepodane | CFTC_Commodity_Code |
| commodity_name | text | niepodane | Commodity Name |
| open_interest_all | number | niepodane | Open_Interest_All |
| dealer_positions_long_all | number | niepodane | Dealer_Positions_Long_All |
| dealer_positions_short_all | number | niepodane | Dealer_Positions_Short_All |
| dealer_positions_spread_all | number | niepodane | Dealer_Positions_Spread_All |
| asset_mgr_positions_long | number | niepodane | Asset_Mgr_Positions_Long_All |
| asset_mgr_positions_short | number | niepodane | Asset_Mgr_Positions_Short_All |
| asset_mgr_positions_spread | number | niepodane | Asset_Mgr_Positions_Spread_All |
| lev_money_positions_long | number | niepodane | Lev_Money_Positions_Long_All |
| lev_money_positions_short | number | niepodane | Lev_Money_Positions_Short_All |
| lev_money_positions_spread | number | niepodane | Lev_Money_Positions_Spread_All |
| other_rept_positions_long | number | niepodane | Other_Rept_Positions_Long_All |
| other_rept_positions_short | number | niepodane | Other_Rept_Positions_Short_All |
| other_rept_positions_spread | number | niepodane | Other_Rept_Positions_Spread_All |
| tot_rept_positions_long_all | number | niepodane | Tot_Rept_Positions_Long_All |
| tot_rept_positions_short | number | niepodane | Tot_Rept_Positions_Short_All |
| nonrept_positions_long_all | number | niepodane | NonRept_Positions_Long_All |
| nonrept_positions_short_all | number | niepodane | NonRept_Positions_Short_All |
| change_in_open_interest_all | number | niepodane | Change_in_Open_Interest_All |
| change_in_dealer_long_all | number | niepodane | Change_in_Dealer_Long_All |
| change_in_dealer_short_all | number | niepodane | Change_in_Dealer_Short_All |
| change_in_dealer_spread_all | number | niepodane | Change_in_Dealer_Spread_All |
| change_in_asset_mgr_long | number | niepodane | Change_in_Asset_Mgr_Long_All |
| change_in_asset_mgr_short | number | niepodane | Change_in_Asset_Mgr_Short_All |
| change_in_asset_mgr_spread | number | niepodane | Change_in_Asset_Mgr_Spread_All |
| change_in_lev_money_long | number | niepodane | Change_in_Lev_Money_Long_All |
| change_in_lev_money_short | number | niepodane | Change_in_Lev_Money_Short_All |
| change_in_lev_money_spread | number | niepodane | Change_in_Lev_Money_Spread_All |
| change_in_other_rept_long | number | niepodane | Change_in_Other_Rept_Long_All |
| change_in_other_rept_short | number | niepodane | Change_in_Other_Rept_Short_All |
| change_in_other_rept_spread | number | niepodane | Change_in_Other_Rept_Spread_All |
| change_in_tot_rept_long_all | number | niepodane | Change_in_Tot_Rept_Long_All |
| change_in_tot_rept_short | number | niepodane | Change_in_Tot_Rept_Short_All |
| change_in_nonrept_long_all | number | niepodane | Change_in_NonRept_Long_All |
| change_in_nonrept_short_all | number | niepodane | Change_in_NonRept_Short_All |
| pct_of_open_interest_all | number | niepodane | Pct_of_Open_Interest_All |
| pct_of_oi_dealer_long_all | number | niepodane | Pct_of_OI_Dealer_Long_All |
| pct_of_oi_dealer_short_all | number | niepodane | Pct_of_OI_Dealer_Short_All |
| pct_of_oi_dealer_spread_all | number | niepodane | Pct_of_OI_Dealer_Spread_All |
| pct_of_oi_asset_mgr_long | number | niepodane | Pct_of_OI_Asset_Mgr_Long_All |
| pct_of_oi_asset_mgr_short | number | niepodane | Pct_of_OI_Asset_Mgr_Short_All |
| pct_of_oi_asset_mgr_spread | number | niepodane | Pct_of_OI_Asset_Mgr_Spread_All |
| pct_of_oi_lev_money_long | number | niepodane | Pct_of_OI_Lev_Money_Long_All |
| pct_of_oi_lev_money_short | number | niepodane | Pct_of_OI_Lev_Money_Short_All |
| pct_of_oi_lev_money_spread | number | niepodane | Pct_of_OI_Lev_Money_Spread_All |
| pct_of_oi_other_rept_long | number | niepodane | Pct_of_OI_Other_Rept_Long_All |
| pct_of_oi_other_rept_short | number | niepodane | Pct_of_OI_Other_Rept_Short_All |
| pct_of_oi_other_rept_spread | number | niepodane | Pct_of_OI_Other_Rept_Spread_All |
| pct_of_oi_tot_rept_long_all | number | niepodane | Pct_of_OI_Tot_Rept_Long_All |
| pct_of_oi_tot_rept_short | number | niepodane | Pct_of_OI_Tot_Rept_Short_All |
| pct_of_oi_nonrept_long_all | number | niepodane | Pct_of_OI_NonRept_Long_All |
| pct_of_oi_nonrept_short_all | number | niepodane | Pct_of_OI_NonRept_Short_All |
| traders_tot_all | number | niepodane | Traders_Tot_All |
| traders_dealer_long_all | number | niepodane | Traders_Dealer_Long_All |
| traders_dealer_short_all | number | niepodane | Traders_Dealer_Short_All |
| traders_dealer_spread_all | number | niepodane | Traders_Dealer_Spread_All |
| traders_asset_mgr_long_all | number | niepodane | Traders_Asset_Mgr_Long_All |
| traders_asset_mgr_short_all | number | niepodane | Traders_Asset_Mgr_Short_All |
| traders_asset_mgr_spread | number | niepodane | Traders_Asset_Mgr_Spread_All |
| traders_lev_money_long_all | number | niepodane | Traders_Lev_Money_Long_All |
| traders_lev_money_short_all | number | niepodane | Traders_Lev_Money_Short_All |
| traders_lev_money_spread | number | niepodane | Traders_Lev_Money_Spread_All |
| traders_other_rept_long_all | number | niepodane | Traders_Other_Rept_Long_All |
| traders_other_rept_short | number | niepodane | Traders_Other_Rept_Short_All |
| traders_other_rept_spread | number | niepodane | Traders_Other_Rept_Spread_All |
| traders_tot_rept_long_all | number | niepodane | Traders_Tot_Rept_Long_All |
| traders_tot_rept_short_all | number | niepodane | Traders_Tot_Rept_Short_All |
| conc_gross_le_4_tdr_long | number | niepodane | Conc_Gross_LE_4_TDR_Long_All |
| conc_gross_le_4_tdr_short | number | niepodane | Conc_Gross_LE_4_TDR_Short_All |
| conc_gross_le_8_tdr_long | number | niepodane | Conc_Gross_LE_8_TDR_Long_All |
| conc_gross_le_8_tdr_short | number | niepodane | Conc_Gross_LE_8_TDR_Short_All |
| conc_net_le_4_tdr_long_all | number | niepodane | Conc_Net_LE_4_TDR_Long_All |
| conc_net_le_4_tdr_short_all | number | niepodane | Conc_Net_LE_4_TDR_Short_All |
| conc_net_le_8_tdr_long_all | number | niepodane | Conc_Net_LE_8_TDR_Long_All |
| conc_net_le_8_tdr_short_all | number | niepodane | Conc_Net_LE_8_TDR_Short_All |
| contract_units | text | niepodane | Contract_Units |
| cftc_subgroup_code | text | niepodane | CFTC_SubGroup_Code |
| futonly_or_combined | text | niepodane | FutOnly_or_Combined |

</details>

<details><summary>Pola: CIT_All (j83k-qyrd)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| id | text | niepodane | ID |
| market_and_exchange_names | text | niepodane | Market_and_Exchange_Names |
| contract_market_name | text | niepodane | CONTRACT_MARKET_NAME |
| report_date_as_yyyy_mm_dd | calendar_date | niepodane | Report_Date_as_YYYY_MM_DD |
| cftc_contract_market_code | text | niepodane | CFTC_Contract_Market_Code |
| yyyy_report_week_ww | text | niepodane | YYYY Report Week WW |
| cftc_market_code | text | niepodane | CFTC_Market_Code |
| cftc_region_code | text | niepodane | CFTC_Region_Code |
| cftc_commodity_code | text | niepodane | CFTC_Commodity_Code |
| commodity_name | text | niepodane | Commodity Name |
| open_interest_all | number | niepodane | Open_Interest_All |
| ncomm_positions_long_all | number | niepodane | NComm_Positions_Long_All_NoCIT |
| ncomm_positions_short_all | number | niepodane | NComm_Positions_Short_All_NoCIT |
| ncomm_postions_spread_all | number | niepodane | NComm_Postions_Spread_All_NoCIT |
| comm_positions_long_all_nocit | number | niepodane | Comm_Positions_Long_All_NoCIT |
| comm_positions_short_all | number | niepodane | Comm_Positions_Short_All_NoCIT |
| tot_rept_positions_long_all | number | niepodane | Tot_Rept_Positions_Long_All |
| tot_rept_positions_short | number | niepodane | Tot_Rept_Positions_Short_All |
| nonrept_positions_long_all | number | niepodane | NonRept_Positions_Long_All |
| nonrept_positions_short_all | number | niepodane | NonRept_Positions_Short_All |
| cit_positions_long_all | number | niepodane | CIT_Positions_Long_All |
| cit_positions_short_all | number | niepodane | CIT_Positions_Short_All |
| change_open_interest_all | number | niepodane | Change_Open_Interest_All |
| change_noncomm_long_all_nocit | number | niepodane | Change_NonComm_Long_All_NoCIT |
| change_noncomm_short_all | number | niepodane | Change_NonComm_Short_All_NoCIT |
| change_noncomm_spead_all | number | niepodane | Change_NonComm_Spead_All_NoCIT |
| change_comm_long_all_nocit | number | niepodane | Change_Comm_Long_All_NoCIT |
| change_comm_short_all_nocit | number | niepodane | Change_Comm_Short_All_NoCIT |
| change_tot_rept_long_all | number | niepodane | Change_Tot_Rept_Long_All |
| change_tot_rept_short_all | number | niepodane | Change_Tot_Rept_Short_All |
| change_nonrept_long_all | number | niepodane | Change_NonRept_Long_All |
| change_nonrept_short_all | number | niepodane | Change_NonRept_Short_All |
| change_cit_long_all | number | niepodane | Change_CIT_Long_All |
| change_cit_short_all | number | niepodane | Change_CIT_Short_All |
| pct_open_interest_all | number | niepodane | Pct_Open_Interest_All |
| pct_oi_noncomm_long_all_nocit | number | niepodane | Pct_OI_NonComm_Long_All_NoCIT |
| pct_oi_noncomm_short_all | number | niepodane | Pct_OI_NonComm_Short_All_NoCIT |
| pct_oi_noncomm_spread_all | number | niepodane | Pct_OI_NonComm_Spread_All_NoCIT |
| pct_oi_comm_long_all_nocit | number | niepodane | Pct_OI_Comm_Long_All_NoCIT |
| pct_oi_comm_short_all_nocit | number | niepodane | Pct_OI_Comm_Short_All_NoCIT |
| pct_oi_tot_rept_long_all | number | niepodane | Pct_OI_Tot_Rept_Long_All |
| pct_oi_tot_rept_short_all | number | niepodane | Pct_OI_Tot_Rept_Short_All |
| pct_oi_nonrept_long_all_nocit | number | niepodane | Pct_OI_NonRept_Long_All_NoCIT |
| pct_oi_nonrept_short_all | number | niepodane | Pct_OI_NonRept_Short_All_NoCIT |
| pct_oi_cit_long_all | number | niepodane | Pct_OI_CIT_Long_All |
| pct_oi_cit_short_all | number | niepodane | Pct_OI_CIT_Short_All |
| traders_tot_all | number | niepodane | Traders_Tot_All |
| traders_noncomm_long_all | number | niepodane | Traders_NonComm_Long_All_NoCIT |
| traders_noncomm_short_all | number | niepodane | Traders_NonComm_Short_All_NoCIT |
| traders_noncomm_spread_all | number | niepodane | Traders_NonComm_Spread_All_NoCIT |
| traders_comm_long_all_nocit | number | niepodane | Traders_Comm_Long_All_NoCIT |
| traders_comm_short_all_nocit | number | niepodane | Traders_Comm_Short_All_NoCIT |
| traders_tot_rept_long_all | number | niepodane | Traders_Tot_Rept_Long_All |
| traders_tot_rept_short_all | number | niepodane | Traders_Tot_Rept_Short_All |
| traders_cit_long_all | number | niepodane | Traders_CIT_Long_All |
| traders_cit_short_all | number | niepodane | Traders_CIT_Short_All |
| contract_units | text | niepodane | Contract_Units |

</details>

Dokumentacja: [źródło](https://publicreporting.cftc.gov/stories/s/COT-Help/p2fg-u73y/), [źródło](https://www.cftc.gov/WebPolicy/index.htm)

## commodities-sh

Current authorized SourceHub metadata acquired; observation proof is separate

| Grupa / zbiór / endpoint | Status metadanych / operacji | Dane lub harmonogram LIVE | Pola | Częstotliwości | Koszt USD |
|---|---|---|---:|---|---|
| discovery / Health + staleness / GET /health | DOCUMENTED_NOT_TESTED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| discovery / Instrument catalog / GET /v1/catalog | LIVE_VERIFIED | LIVE_VERIFIED | 0 | nieustalona | 0 |
| discovery / Release calendar / GET /v1/calendar | LIVE_VERIFIED | LIVE_VERIFIED | 0 | nieustalona | 0 |
| discovery / Agent briefing (llms.txt) / GET /llms.txt | DOCUMENTED_NOT_TESTED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| discovery / Full agent reference / GET /llms-full.txt | DOCUMENTED_NOT_TESTED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| discovery / Agent skill manifest / GET /SKILL.md | DOCUMENTED_NOT_TESTED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| discovery / A2A agent card / GET /.well-known/agent.json | DOCUMENTED_NOT_TESTED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| discovery / x402 resource catalog / GET /.well-known/x402.json | DOCUMENTED_NOT_TESTED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| discovery / Latest price / GET /v1/price/{code} | PAID_NOT_ACTIVATED | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.01 |
| discovery / Bundle prices / GET /v1/prices | PAID_NOT_ACTIVATED | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.02 |
| discovery / Series history / GET /v1/history/{code} | PAID_NOT_ACTIVATED | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.02 |
| discovery / EIA inventories + surprise / GET /v1/inventory/eia | PAID_NOT_ACTIVATED | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.03 |
| discovery / Single EIA inventory series / GET /v1/inventory/eia/{series} | PAID_NOT_ACTIVATED | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.02 |
| discovery / COT managed-money net / GET /v1/cot/{code} | PAID_NOT_ACTIVATED | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.02 |
| discovery / 3-2-1 crack / GET /v1/spreads/crack | PAID_NOT_ACTIVATED | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.03 |
| discovery / Soy crush proxy / GET /v1/spreads/crush | PAID_NOT_ACTIVATED | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.03 |
| discovery / WTI-Brent basis / GET /v1/spreads/basis | PAID_NOT_ACTIVATED | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.03 |
| discovery / USDA WASDE slice / GET /v1/fundamentals/wasde | PAID_NOT_ACTIVATED | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.03 |
| discovery / Crop progress / GET /v1/fundamentals/crop-progress | PAID_NOT_ACTIVATED | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.02 |
| discovery / Export sales / GET /v1/fundamentals/export-sales | PAID_NOT_ACTIVATED | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.02 |
| discovery / USGS Mineral Commodity Summaries / GET /v1/fundamentals/usgs | PAID_NOT_ACTIVATED | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.03 |
| discovery / FX pair / GET /v1/fx/{pair} | PAID_NOT_ACTIVATED | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.01 |
| discovery / Sector snapshot / GET /v1/snapshot/{sector} | PAID_NOT_ACTIVATED | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.05 |
| discovery / Decision pack / GET /v1/decision/{sector} | PAID_NOT_ACTIVATED | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.1 |
| discovery / All-sector snapshot bundle / GET /v1/snapshot/all | PAID_NOT_ACTIVATED | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.12 |
| discovery / All-sector decision pack bundle / GET /v1/decision/all | PAID_NOT_ACTIVATED | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.25 |
| discovery / Forward curve (stub) / GET /v1/curve/{root} | UNAVAILABLE_OR_UNKNOWN | UNAVAILABLE_OR_UNKNOWN | 0 | nieustalona | 0 |
| discovery / Calendar spread (stub) / GET /v1/spreads/calendar/{root} | UNAVAILABLE_OR_UNKNOWN | UNAVAILABLE_OR_UNKNOWN | 0 | nieustalona | 0 |
| discovery / MCP streamable HTTP / POST /api/mcp | PAID_NOT_ACTIVATED | PAID_NOT_ACTIVATED | 0 | nieustalona | nieustalony |
| discovery / MCP tool names (discovery) / GET /api/mcp | DOCUMENTED_NOT_TESTED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| discovery / commodities.sh free discovery catalogue / catalog | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 2 | nieustalona | 0 |
| discovery / /openapi.json / GET /openapi.json | LIVE_VERIFIED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| discovery / /terms.txt / GET /terms.txt | DOCUMENTED_NOT_TESTED | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |

<details><summary>Pola: Latest price (GET /v1/price/{code})</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| instrument | string | niepodane | niepodane |
| value | number | niepodane | niepodane |
| unit | string | niepodane | niepodane |
| as_of | string | niepodane | niepodane |
| observed_at | string | niepodane | niepodane |
| freshness_class | string | niepodane | niepodane |
| quality | string | niepodane | niepodane |
| derived | boolean | niepodane | niepodane |
| source | object | niepodane | niepodane |
| license_tag | string | niepodane | niepodane |
| provenance | object | niepodane | niepodane |
| prior | number | niepodane | Previous print value when history exists |
| pct_change | number | niepodane | Percent change vs prior print |
| short_history | array | niepodane | Newest-first short history (≤8 points) |
| cite | string | niepodane | One-line citation for agents |

</details>

<details><summary>Pola: Bundle prices (GET /v1/prices)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| instrument | string | niepodane | niepodane |
| value | number | niepodane | niepodane |
| unit | string | niepodane | niepodane |
| as_of | string | niepodane | niepodane |
| observed_at | string | niepodane | niepodane |
| freshness_class | string | niepodane | niepodane |
| quality | string | niepodane | niepodane |
| derived | boolean | niepodane | niepodane |
| source | object | niepodane | niepodane |
| license_tag | string | niepodane | niepodane |
| provenance | object | niepodane | niepodane |
| prior | number | niepodane | Previous print value when history exists |
| pct_change | number | niepodane | Percent change vs prior print |
| short_history | array | niepodane | Newest-first short history (≤8 points) |
| cite | string | niepodane | One-line citation for agents |

</details>

<details><summary>Pola: Series history (GET /v1/history/{code})</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| instrument | string | niepodane | niepodane |
| value | number | niepodane | niepodane |
| unit | string | niepodane | niepodane |
| as_of | string | niepodane | niepodane |
| observed_at | string | niepodane | niepodane |
| freshness_class | string | niepodane | niepodane |
| quality | string | niepodane | niepodane |
| derived | boolean | niepodane | niepodane |
| source | object | niepodane | niepodane |
| license_tag | string | niepodane | niepodane |
| provenance | object | niepodane | niepodane |
| prior | number | niepodane | Previous print value when history exists |
| pct_change | number | niepodane | Percent change vs prior print |
| short_history | array | niepodane | Newest-first short history (≤8 points) |
| cite | string | niepodane | One-line citation for agents |

</details>

<details><summary>Pola: EIA inventories + surprise (GET /v1/inventory/eia)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| instrument | string | niepodane | niepodane |
| value | number | niepodane | niepodane |
| unit | string | niepodane | niepodane |
| as_of | string | niepodane | niepodane |
| observed_at | string | niepodane | niepodane |
| freshness_class | string | niepodane | niepodane |
| quality | string | niepodane | niepodane |
| derived | boolean | niepodane | niepodane |
| source | object | niepodane | niepodane |
| license_tag | string | niepodane | niepodane |
| provenance | object | niepodane | niepodane |
| prior | number | niepodane | Previous print value when history exists |
| pct_change | number | niepodane | Percent change vs prior print |
| short_history | array | niepodane | Newest-first short history (≤8 points) |
| cite | string | niepodane | One-line citation for agents |

</details>

<details><summary>Pola: Single EIA inventory series (GET /v1/inventory/eia/{series})</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| instrument | string | niepodane | niepodane |
| value | number | niepodane | niepodane |
| unit | string | niepodane | niepodane |
| as_of | string | niepodane | niepodane |
| observed_at | string | niepodane | niepodane |
| freshness_class | string | niepodane | niepodane |
| quality | string | niepodane | niepodane |
| derived | boolean | niepodane | niepodane |
| source | object | niepodane | niepodane |
| license_tag | string | niepodane | niepodane |
| provenance | object | niepodane | niepodane |
| prior | number | niepodane | Previous print value when history exists |
| pct_change | number | niepodane | Percent change vs prior print |
| short_history | array | niepodane | Newest-first short history (≤8 points) |
| cite | string | niepodane | One-line citation for agents |

</details>

<details><summary>Pola: COT managed-money net (GET /v1/cot/{code})</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| instrument | string | niepodane | niepodane |
| value | number | niepodane | niepodane |
| unit | string | niepodane | niepodane |
| as_of | string | niepodane | niepodane |
| observed_at | string | niepodane | niepodane |
| freshness_class | string | niepodane | niepodane |
| quality | string | niepodane | niepodane |
| derived | boolean | niepodane | niepodane |
| source | object | niepodane | niepodane |
| license_tag | string | niepodane | niepodane |
| provenance | object | niepodane | niepodane |
| prior | number | niepodane | Previous print value when history exists |
| pct_change | number | niepodane | Percent change vs prior print |
| short_history | array | niepodane | Newest-first short history (≤8 points) |
| cite | string | niepodane | One-line citation for agents |

</details>

<details><summary>Pola: 3-2-1 crack (GET /v1/spreads/crack)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| instrument | string | niepodane | niepodane |
| value | number | niepodane | niepodane |
| unit | string | niepodane | niepodane |
| as_of | string | niepodane | niepodane |
| observed_at | string | niepodane | niepodane |
| freshness_class | string | niepodane | niepodane |
| quality | string | niepodane | niepodane |
| derived | boolean | niepodane | niepodane |
| source | object | niepodane | niepodane |
| license_tag | string | niepodane | niepodane |
| provenance | object | niepodane | niepodane |
| prior | number | niepodane | Previous print value when history exists |
| pct_change | number | niepodane | Percent change vs prior print |
| short_history | array | niepodane | Newest-first short history (≤8 points) |
| cite | string | niepodane | One-line citation for agents |

</details>

<details><summary>Pola: Soy crush proxy (GET /v1/spreads/crush)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| instrument | string | niepodane | niepodane |
| value | number | niepodane | niepodane |
| unit | string | niepodane | niepodane |
| as_of | string | niepodane | niepodane |
| observed_at | string | niepodane | niepodane |
| freshness_class | string | niepodane | niepodane |
| quality | string | niepodane | niepodane |
| derived | boolean | niepodane | niepodane |
| source | object | niepodane | niepodane |
| license_tag | string | niepodane | niepodane |
| provenance | object | niepodane | niepodane |
| prior | number | niepodane | Previous print value when history exists |
| pct_change | number | niepodane | Percent change vs prior print |
| short_history | array | niepodane | Newest-first short history (≤8 points) |
| cite | string | niepodane | One-line citation for agents |

</details>

<details><summary>Pola: WTI-Brent basis (GET /v1/spreads/basis)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| instrument | string | niepodane | niepodane |
| value | number | niepodane | niepodane |
| unit | string | niepodane | niepodane |
| as_of | string | niepodane | niepodane |
| observed_at | string | niepodane | niepodane |
| freshness_class | string | niepodane | niepodane |
| quality | string | niepodane | niepodane |
| derived | boolean | niepodane | niepodane |
| source | object | niepodane | niepodane |
| license_tag | string | niepodane | niepodane |
| provenance | object | niepodane | niepodane |
| prior | number | niepodane | Previous print value when history exists |
| pct_change | number | niepodane | Percent change vs prior print |
| short_history | array | niepodane | Newest-first short history (≤8 points) |
| cite | string | niepodane | One-line citation for agents |

</details>

<details><summary>Pola: USDA WASDE slice (GET /v1/fundamentals/wasde)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| instrument | string | niepodane | niepodane |
| value | number | niepodane | niepodane |
| unit | string | niepodane | niepodane |
| as_of | string | niepodane | niepodane |
| observed_at | string | niepodane | niepodane |
| freshness_class | string | niepodane | niepodane |
| quality | string | niepodane | niepodane |
| derived | boolean | niepodane | niepodane |
| source | object | niepodane | niepodane |
| license_tag | string | niepodane | niepodane |
| provenance | object | niepodane | niepodane |
| prior | number | niepodane | Previous print value when history exists |
| pct_change | number | niepodane | Percent change vs prior print |
| short_history | array | niepodane | Newest-first short history (≤8 points) |
| cite | string | niepodane | One-line citation for agents |

</details>

<details><summary>Pola: Crop progress (GET /v1/fundamentals/crop-progress)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| instrument | string | niepodane | niepodane |
| value | number | niepodane | niepodane |
| unit | string | niepodane | niepodane |
| as_of | string | niepodane | niepodane |
| observed_at | string | niepodane | niepodane |
| freshness_class | string | niepodane | niepodane |
| quality | string | niepodane | niepodane |
| derived | boolean | niepodane | niepodane |
| source | object | niepodane | niepodane |
| license_tag | string | niepodane | niepodane |
| provenance | object | niepodane | niepodane |
| prior | number | niepodane | Previous print value when history exists |
| pct_change | number | niepodane | Percent change vs prior print |
| short_history | array | niepodane | Newest-first short history (≤8 points) |
| cite | string | niepodane | One-line citation for agents |

</details>

<details><summary>Pola: Export sales (GET /v1/fundamentals/export-sales)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| instrument | string | niepodane | niepodane |
| value | number | niepodane | niepodane |
| unit | string | niepodane | niepodane |
| as_of | string | niepodane | niepodane |
| observed_at | string | niepodane | niepodane |
| freshness_class | string | niepodane | niepodane |
| quality | string | niepodane | niepodane |
| derived | boolean | niepodane | niepodane |
| source | object | niepodane | niepodane |
| license_tag | string | niepodane | niepodane |
| provenance | object | niepodane | niepodane |
| prior | number | niepodane | Previous print value when history exists |
| pct_change | number | niepodane | Percent change vs prior print |
| short_history | array | niepodane | Newest-first short history (≤8 points) |
| cite | string | niepodane | One-line citation for agents |

</details>

<details><summary>Pola: USGS Mineral Commodity Summaries (GET /v1/fundamentals/usgs)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| instrument | string | niepodane | niepodane |
| value | number | niepodane | niepodane |
| unit | string | niepodane | niepodane |
| as_of | string | niepodane | niepodane |
| observed_at | string | niepodane | niepodane |
| freshness_class | string | niepodane | niepodane |
| quality | string | niepodane | niepodane |
| derived | boolean | niepodane | niepodane |
| source | object | niepodane | niepodane |
| license_tag | string | niepodane | niepodane |
| provenance | object | niepodane | niepodane |
| prior | number | niepodane | Previous print value when history exists |
| pct_change | number | niepodane | Percent change vs prior print |
| short_history | array | niepodane | Newest-first short history (≤8 points) |
| cite | string | niepodane | One-line citation for agents |

</details>

<details><summary>Pola: FX pair (GET /v1/fx/{pair})</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| instrument | string | niepodane | niepodane |
| value | number | niepodane | niepodane |
| unit | string | niepodane | niepodane |
| as_of | string | niepodane | niepodane |
| observed_at | string | niepodane | niepodane |
| freshness_class | string | niepodane | niepodane |
| quality | string | niepodane | niepodane |
| derived | boolean | niepodane | niepodane |
| source | object | niepodane | niepodane |
| license_tag | string | niepodane | niepodane |
| provenance | object | niepodane | niepodane |
| prior | number | niepodane | Previous print value when history exists |
| pct_change | number | niepodane | Percent change vs prior print |
| short_history | array | niepodane | Newest-first short history (≤8 points) |
| cite | string | niepodane | One-line citation for agents |

</details>

<details><summary>Pola: Sector snapshot (GET /v1/snapshot/{sector})</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| instrument | string | niepodane | niepodane |
| value | number | niepodane | niepodane |
| unit | string | niepodane | niepodane |
| as_of | string | niepodane | niepodane |
| observed_at | string | niepodane | niepodane |
| freshness_class | string | niepodane | niepodane |
| quality | string | niepodane | niepodane |
| derived | boolean | niepodane | niepodane |
| source | object | niepodane | niepodane |
| license_tag | string | niepodane | niepodane |
| provenance | object | niepodane | niepodane |
| prior | number | niepodane | Previous print value when history exists |
| pct_change | number | niepodane | Percent change vs prior print |
| short_history | array | niepodane | Newest-first short history (≤8 points) |
| cite | string | niepodane | One-line citation for agents |

</details>

<details><summary>Pola: Decision pack (GET /v1/decision/{sector})</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| instrument | string | niepodane | niepodane |
| value | number | niepodane | niepodane |
| unit | string | niepodane | niepodane |
| as_of | string | niepodane | niepodane |
| observed_at | string | niepodane | niepodane |
| freshness_class | string | niepodane | niepodane |
| quality | string | niepodane | niepodane |
| derived | boolean | niepodane | niepodane |
| source | object | niepodane | niepodane |
| license_tag | string | niepodane | niepodane |
| provenance | object | niepodane | niepodane |
| prior | number | niepodane | Previous print value when history exists |
| pct_change | number | niepodane | Percent change vs prior print |
| short_history | array | niepodane | Newest-first short history (≤8 points) |
| cite | string | niepodane | One-line citation for agents |

</details>

<details><summary>Pola: All-sector snapshot bundle (GET /v1/snapshot/all)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| instrument | string | niepodane | niepodane |
| value | number | niepodane | niepodane |
| unit | string | niepodane | niepodane |
| as_of | string | niepodane | niepodane |
| observed_at | string | niepodane | niepodane |
| freshness_class | string | niepodane | niepodane |
| quality | string | niepodane | niepodane |
| derived | boolean | niepodane | niepodane |
| source | object | niepodane | niepodane |
| license_tag | string | niepodane | niepodane |
| provenance | object | niepodane | niepodane |
| prior | number | niepodane | Previous print value when history exists |
| pct_change | number | niepodane | Percent change vs prior print |
| short_history | array | niepodane | Newest-first short history (≤8 points) |
| cite | string | niepodane | One-line citation for agents |

</details>

<details><summary>Pola: All-sector decision pack bundle (GET /v1/decision/all)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| instrument | string | niepodane | niepodane |
| value | number | niepodane | niepodane |
| unit | string | niepodane | niepodane |
| as_of | string | niepodane | niepodane |
| observed_at | string | niepodane | niepodane |
| freshness_class | string | niepodane | niepodane |
| quality | string | niepodane | niepodane |
| derived | boolean | niepodane | niepodane |
| source | object | niepodane | niepodane |
| license_tag | string | niepodane | niepodane |
| provenance | object | niepodane | niepodane |
| prior | number | niepodane | Previous print value when history exists |
| pct_change | number | niepodane | Percent change vs prior print |
| short_history | array | niepodane | Newest-first short history (≤8 points) |
| cite | string | niepodane | One-line citation for agents |

</details>

<details><summary>Pola: commodities.sh free discovery catalogue (catalog)</summary>

| Pole API | Typ dostawcy | Jednostka | Znaczenie |
|---|---|---|---|
| instruments | array | niepodane | niepodane |
| pricing_usd | object | niepodane | niepodane |

</details>

Dokumentacja: [źródło](https://commodities.sh/docs/reference), [źródło](https://commodities.sh/terms)

## Zakres katalogu

EIA: 14 grup głównych, 259 węzłów metadanych i 232 tras z definicją pomiarów.

CFTC: 7 wariantów COT, 4 zbiorów bazowych i 12 zbiorów tabularnych łącznie.

commodities.sh: 30 operacji w paths OpenAPI oraz 2 dodatkowe deklaracje discovery; 30 instrumentów i 7 serii zapasów.

Metadane CFTC obejmują siedem wariantów raportów oraz ich zbiory bazowe; strony pomocy i wizualizacje nie są dodatkowymi zbiorami COT. Operacje z info.x-free-paths, których nie ma w paths OpenAPI, są opisane osobno. Serie AEO/IEO/STEO mogą być projekcjami lub scenariuszami dostawcy; nie stanowią wyniku Forecast Core.

## Ograniczenia i licencje

EIA: bezpłatny klucz, rzeczywisty throttling dostawcy, atrybucja EIA, zastrzeżenia praw do materiałów osób trzecich. CFTC: informacje rządowe są public domain, z wyjątkami dla cudzych materiałów; atrybucja CFTC. commodities.sh: obowiązują także warunki źródeł nadrzędnych, w tym FRED. Darmowy discovery nie przyznaje prawa do redystrybucji płatnych obserwacji. Komercyjna redystrybucja wymaga sprawdzenia praw konkretnej serii. SourceHub nie utrwala treści obserwacji przy TTL 0; katalog zapisuje wyłącznie dopuszczone metadane.

## Niewiążące możliwe zastosowania

Oil Report: zapasy, produkcja, handel i ceny energii EIA oraz pozycjonowanie COT CFTC. Kalendarz Surowcowy: harmonogramy publikacji i okresy referencyjne, bez utożsamiania ich z opublikowanym odczytem. Analityka SpendGuru: porównania szeregów z zachowaniem jednostek, rewizji i semantyki instrumentów. Żadne z tych zastosowań nie jest wdrażane ani zatwierdzane przez ten katalog.
