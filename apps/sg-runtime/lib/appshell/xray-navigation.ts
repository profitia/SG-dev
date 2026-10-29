export const xrayPath=(locale:'pl'|'en')=>`/${locale}/dashboard/xray`;
export const isXrayPath=(path:string|null,locale:'pl'|'en')=>path===xrayPath(locale)||path===xrayPath(locale)+'/';
