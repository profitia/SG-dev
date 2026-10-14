import React from "react";
import { CanonElement } from "./ui-canon";

export const SUPPLIER_HEADER_TITLE = "X-Ray | Supplier Intelligence Dashboard";

/** C52 shell is shared; host actions are optional and belong to the current screen. */
export function SupplierHeader({ children, logoSrc = "/spendguru/logo.svg" }: { children?: React.ReactNode; logoSrc?: string }) {
  return <CanonElement as="header" canonId="SRM-C52" usage="SupplierHeader:01" className="srm-ui srm-canon-header">
    <div className="srm-header-brand">
      <CanonElement as="span" canonId="SRM-C44" usage="SupplierHeader:02" className="srm-header-logo" data-brand-asset="SRM-L01">
        <img src={logoSrc} alt="SpendGuru" width={144} height={47} />
      </CanonElement>
      <h1>{SUPPLIER_HEADER_TITLE}</h1>
    </div>
    {children && <div className="srm-header-actions">{children}</div>}
  </CanonElement>;
}
