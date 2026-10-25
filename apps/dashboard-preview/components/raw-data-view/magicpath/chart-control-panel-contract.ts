/** CHT-09 · C81–82 · B58: one source for the chart drawer specimen. */
export const chartControlPanelCanon = {
  surface: 'var(--canvas,#F8F9FA)',
  forecastSurfaceFade: '38%',
  panelShadowBlur: '1rem', panelShadowSpread: '.125rem',
  panelShadowExtent: '1.5rem', panelShadowColor: 'rgb(0 51 102 / .06)',
  duration: '320ms', easing: 'cubic-bezier(.22,1,.36,1)',
  plotMinHeight: '32rem', edgeInset: '0rem', radius: '0rem', padding: '1rem', gap: '1rem', rows: 3, rowHeight: '2.25rem', rowGap: '.5rem',
  ribbonWidth: '2.25rem', ribbonHeight: '2.25rem', ribbonRadius: '1.125rem',
  toolsRibbonTop: '0rem', toolsWidth: '6rem', toolsColumn: '2.25rem', toolsGap: '.375rem', toolsPadding: '.5rem',
  symbolSize: '2.25rem'
} as const;
export const chartControlPanelVariables = {
  // CHT-12: derives from the face diameter, including future size changes.
  '--chart-control-corner-radius': `calc(${chartControlPanelCanon.symbolSize} / 2)`,
  '--chart-panel-surface': chartControlPanelCanon.surface,
  '--chart-forecast-surface-fade': chartControlPanelCanon.forecastSurfaceFade,
  '--chart-panel-shadow-blur': chartControlPanelCanon.panelShadowBlur,
  '--chart-panel-shadow-spread': chartControlPanelCanon.panelShadowSpread,
  '--chart-panel-shadow-extent': chartControlPanelCanon.panelShadowExtent,
  '--chart-panel-shadow-color': chartControlPanelCanon.panelShadowColor,
  '--chart-panel-edge-inset': chartControlPanelCanon.edgeInset,
  '--chart-tools-width': chartControlPanelCanon.toolsWidth,
  '--chart-tools-ribbon-top': chartControlPanelCanon.toolsRibbonTop,
  '--chart-tools-column': chartControlPanelCanon.toolsColumn,
  '--chart-tools-gap': chartControlPanelCanon.toolsGap,
  '--chart-tools-pad': chartControlPanelCanon.toolsPadding,
  '--chart-controls-duration': chartControlPanelCanon.duration,
  '--chart-controls-easing': chartControlPanelCanon.easing,
  '--chart-controls-radius': chartControlPanelCanon.radius,
  '--chart-controls-pad': chartControlPanelCanon.padding,
  '--chart-controls-gap': chartControlPanelCanon.gap,
  '--chart-controls-rows': chartControlPanelCanon.rows,
  '--chart-controls-row-height': chartControlPanelCanon.rowHeight,
  '--chart-controls-row-gap': chartControlPanelCanon.rowGap,
  '--chart-controls-ribbon-width': chartControlPanelCanon.ribbonWidth,
  '--chart-controls-ribbon-height': chartControlPanelCanon.ribbonHeight,
  '--chart-controls-ribbon-radius': chartControlPanelCanon.ribbonRadius,
  '--chart-controls-symbol-size': chartControlPanelCanon.symbolSize,
};

