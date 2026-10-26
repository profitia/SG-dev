import React from 'react';
export function Icon({
  name,
  size = 18
}: {
  name: string;
  size?: number;
}) {
  const p: Record<string, React.ReactNode> = {
    arrow: <path d="M4 12h16m-5-5 5 5-5 5" />,
    back: <path d="M20 12H4m5-5-5 5 5 5" />,
    chevron: <path d="m9 6 6 6-6 6" />,
    down: <path d="m6 9 6 6 6-6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v1" /></>,
    warning: <><path d="M12 3 2 21h20Z" /><path d="M12 9v5m0 3v1" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
    chart: <><path d="M4 4v16h17M6 15l5-5 4 3 5-7" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5ZM3 12l9 5 9-5M3 16l9 5 9-5" /></>,
    scan: <><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 12h18" /></>,
    history: <><path d="M3 6v5h5M3 11a9 9 0 1 1 2 7" /><path d="M12 7v5l3 2" /></>,
    edit: <><path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14Z" /></>,
    save: <><path d="M4 3h13l4 4v14H3V3ZM7 3v6h10V3M7 21v-8h10v8" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    grid: <>{[[4, 4], [14, 4], [4, 14], [14, 14]].map(([x, y]) => <rect key={x + ':' + y} x={x} y={y} width="6" height="6" rx="1.5" />)}</>,
    up: <path d="m6 15 6-6 6 6" />,
    file: <><path d="M14 3H5v18h14V8ZM14 3v5h5M8 12h8m-8 4h6" /></>,
    refresh: <><path d="M20 5v6h-6M4 19v-6h6M20 11a8 8 0 0 0-14-5M4 13a8 8 0 0 0 14 5" /></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v5m10-5v5M3 11h18" /></>,
    external: <><path d="M14 3h7v7m0-7L11 13M10 3H3v18h18v-7" /></>,
    cable: <><path d="M3 17c2-8 8 0 10-8s8 0 8-5M3 21v-5m18-16v5" /></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p[name] ?? p.info}</svg>;
}
