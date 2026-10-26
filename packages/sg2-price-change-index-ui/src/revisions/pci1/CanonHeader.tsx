import {useContent} from '../../PresentationScope';
import {CanonThemeSwitch} from '../../Theme';
import React from 'react';
import { CanonElement } from './CanonElements';
import { SpendGuruLogo } from './SpendGuruLogo';

export const HEADER_TITLE = 'X-Ray | Supplier Intelligence Dashboard';
/** SRM-C52 / HDR-01: fixed brand core; optional page-owned action slot. */
export function CanonHeader({
  children,
  title = HEADER_TITLE
}: {
  children?: React.ReactNode;
  title?: string;
}) {
  const content=useContent();
  return <CanonElement as="header" canonId="SRM-C52" usage="CanonHeader:01" className="srm-topbar srm-canon-header">
    <div className="srm-brand">
      <CanonElement as="span" canonId="SRM-C44" usage="CanonHeader:02" className="srm-header-logo" data-brand-asset="SRM-L01"><SpendGuruLogo color="#005A9C" width={144} /></CanonElement>
      <b className="srm-header-title">{content.headerTitle??title}</b>
    </div>
    <div className="srm-header-actions">{children}<CanonThemeSwitch /></div>
  </CanonElement>;
}
