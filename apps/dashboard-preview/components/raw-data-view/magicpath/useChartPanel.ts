import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
/** Independent chart drawers: ribbon toggles, Escape closes the focused panel. */
export function useChartPanel(onOpenChange?: (open: boolean) => void) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId().replace(/:/g, '') + '-chart-panel';
  useLayoutEffect(() => {
    if (panel.current) panel.current.inert = !open;
    onOpenChange?.(open);
  }, [open, onOpenChange]);
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !root.current?.contains(document.activeElement)) return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [open]);
  const toggle = () => setOpen(current => !current);
  return { open, root, panel, trigger, id, toggle };
}

