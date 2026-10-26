/** NAV-01. Shared by the library specimen and the supplier-card mockup. */
export const sideMenuCanon = {
  id: 'SRM-C64', name: 'Menu krawędziowe · Dock',
  dockMaxWidth: '62rem', dockIcon: '1.5rem', dockTarget: '3rem', relocationDuration: '160ms',
  ribbonWidth:'2.75rem', ribbonLength:'5rem', ribbonSymbol:'1.875rem',
  width: '17rem', duration: '360ms', easing: 'cubic-bezier(.22,1,.36,1)',
  background: '#003366', foreground: '#F8F9FA', activeBackground: '#E8F3FF',
  padding: '1.25rem', itemPadding: '.75rem 1rem', gap: '.5rem',
  avatarSize: '2.75rem', radius: '1.25rem',
  demoItems: ['Przegląd', 'Dostawcy', 'Raporty', 'Ustawienia']
} as const;
export const sideMenuVariables = {
  '--side-menu-ribbon-width': sideMenuCanon.ribbonWidth,
  '--side-menu-ribbon-length': sideMenuCanon.ribbonLength,
  '--side-menu-ribbon-symbol': sideMenuCanon.ribbonSymbol,
  '--side-menu-dock-max': sideMenuCanon.dockMaxWidth,
  '--side-menu-dock-icon': sideMenuCanon.dockIcon,
  '--side-menu-dock-target': sideMenuCanon.dockTarget,
  '--side-menu-relocation': sideMenuCanon.relocationDuration,
  '--side-menu-width': sideMenuCanon.width,
  '--side-menu-duration': sideMenuCanon.duration,
  '--side-menu-easing': sideMenuCanon.easing,
  '--side-menu-bg': sideMenuCanon.background,
  '--side-menu-fg': sideMenuCanon.foreground,
  '--side-menu-active': sideMenuCanon.activeBackground,
  '--side-menu-pad': sideMenuCanon.padding,
  '--side-menu-item-pad': sideMenuCanon.itemPadding,
  '--side-menu-gap': sideMenuCanon.gap,
  '--side-menu-avatar': sideMenuCanon.avatarSize,
  '--side-menu-radius': sideMenuCanon.radius
};


