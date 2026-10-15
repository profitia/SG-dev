export type {
  SectionStatus,
  SupplierIdentity,
  SupplierWebIdentityData,
  SourceProvenance,
  SectionEnvelope,
  GeneralCompanyData,
  FinancialPeriod,
  FinancialData,
  FinancialIndicatorResult,
  ReportFreshness,
  FinancialFactEvidence,
  FinancialHistoryPoint,
  SupplierReportData,
  ScannerAxisCode,
  FinancialScannerProjection,
  JdgField,
  JdgEntry,
  JdgRegistryData,
  VerclyKysData,
  SupplierXRayCard,
} from "./contracts";

export { JdgRegistryMount } from "./jdg";
export { AVAILABLE_REPORT, IAS_UNAVAILABLE_MESSAGE, LIQUIDATION_MESSAGE, reportAvailability, type ReportAvailability } from "./report-availability";
export { ReportAvailabilityView } from "./report-availability-view";
export { isCompanyReportRestricted, isRestrictedRegistrationStatus, INACTIVE_COMPANY_MESSAGE, inactiveCompanyMessage, isDeregisteredCompany, jdgDeregistration, isDeregisteredJdg, inactiveJdgMessage } from "./company-activity";

export {
  GeneralCompanyDataMount,
  FinancialDataMount,
  VerclyKysMount,
  SupplierXRayMount,
} from "./mounts";

export { latestAvailableFinancialYear, defaultFinancialScope, financialPeriodsByScope } from "./financial-dashboard";
export { financialLabels } from "./financial-labels";

export type { FinancialPeriodSelection } from "./financial-dashboard";
export { FinancialHealthArea, type FinancialSourceAction } from "./financial-health";
export { healthGroups, indicatorContent, indicatorPresentation, importanceLabels, financialReason } from "./financial-indicator-content";
export { FinancialHistory, historyPlot, historyPoints, financialValue, comparisonText } from "./financial-history";

export { ExecutiveSummary } from "./executive-summary";
export { executiveSummary } from "./executive-summary-rules";
export type { ExecutiveSummaryInput, ExecutiveSummaryModel, SummaryItem, SummaryEvidence } from "./executive-summary-rules";

export { KysOverview, useKysOverview } from "./kys-overview";
export { kysOverview } from "./kys-overview-model";
export type { KysDetailTarget, KysOverviewInput, KysOverviewModel } from "./kys-overview-model";

export { kysPdfDocument, kysPdfCoverage } from "./kys-pdf-document";
export type { KysPdfSelection, KysPdfDocument, KysPdfSection, KysPdfRecord } from "./kys-pdf-document";
export { KysPdfButton } from "./kys-pdf-button";
export { KysKrsButton } from "./kys-krs-button";

export { FinancialScannerMount } from "./financial-scanner";
export { SCANNER_METHODOLOGY_VERSION, MIN_HISTORICAL_PERIODS, previousAnnualPeriod } from "./financial-scanner-model";

export { SupplierWebIdentity, type SupplierWebIdentityGateway } from "./supplier-web-identity";

export { CanonCloseButton, CanonButton, CanonInput, CanonSelect, CanonTextarea, CanonSummary, CanonLink, CanonElement, uiCanon, canonAttributes } from './ui-canon';
export type { CanonId } from './ui-canon';

export { formatKysRetrievedAt, kysRegistryRows, kysListRows } from "./kys-content";
export { KysIcon } from "./kys-report";

export { SupplierHeader, SUPPLIER_HEADER_TITLE } from "./header";
