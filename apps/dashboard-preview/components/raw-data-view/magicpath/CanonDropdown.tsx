import React, { forwardRef, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CanonElement } from './CanonElements';

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  "data-library-component"?: string;
};
type Choice = {
  value: string;
  label: string;
  disabled: boolean;
  group?: string;
};
function textOf(node: React.ReactNode): string {
  return React.Children.toArray(node).map(child => React.isValidElement(child) ? textOf((child.props as any).children) : String(child)).join('');
}
function choicesOf(children: React.ReactNode, group?: string, disabled = false): Choice[] {
  return React.Children.toArray(children).flatMap(child => {
    if (!React.isValidElement(child)) return [];
    const p = child.props as any;
    if (child.type === 'option') return [{
      value: String(p.value ?? textOf(p.children)),
      label: p.label ?? textOf(p.children),
      disabled: disabled || !!p.disabled,
      group
    }];
    return choicesOf(p.children, child.type === 'optgroup' ? p.label : group, disabled || !!p.disabled);
  });
}
const normalize = (value: string) => value.toLocaleLowerCase('pl').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');

/** C07 / ACT-08. One searchable single-select shared by filters and chart controls. */
export const CanonDropdown = forwardRef<HTMLSelectElement, Props>(function CanonDropdown(props, forwardedRef) {
  const {
    children,
    value,
    defaultValue,
    onChange,
    className = '',
    style,
    disabled,
    ...nativeProps
  } = props;
  const choices = useMemo(() => choicesOf(children), [children]);
  const [localValue, setLocalValue] = useState(String(defaultValue ?? choices.find(x => !x.disabled)?.value ?? ''));
  const selectedValue = value === undefined ? localValue : String(value);
  const selected = choices.find(x => x.value === selectedValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState('');
  const [label, setLabel] = useState(props['aria-label'] ?? 'Wybierz wartość');
  const [position, setPosition] = useState<React.CSSProperties>({});
  const native = useRef<HTMLSelectElement | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const uid = useId();
  const listId = `${uid}-list`;
  const matches = choices.filter(x => normalize(x.label).includes(normalize(query.trim())));
  const visible = matches.slice(0, 40);
  const enabled = visible.filter(x => !x.disabled);
  const activeIndex = visible.findIndex(x => x.value === active);
  const close = (restore = false) => {
    setOpen(false);
    if (restore) trigger.current?.focus({
      preventScroll: true
    });
  };
  useLayoutEffect(() => {
    const parent = trigger.current?.closest('label');
    const copy = parent?.cloneNode(true) as HTMLElement | undefined;
    copy?.querySelectorAll('select,button,.srm-dropdown').forEach(x => x.remove());
    setLabel(props['aria-label'] ?? copy?.textContent?.trim() ?? 'Wybierz wartość');
  }, [props['aria-label']]);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  useEffect(() => {
    if (!open) return;
    if (!enabled.some(x => x.value === active)) setActive(enabled[0]?.value ?? '');
  }, [query, open, choices]);
  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const place = () => {
      const node = trigger.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const cs = getComputedStyle(node);
      const width = Math.min(Math.max(rect.width, 260), window.innerWidth - 24);
      const below = window.innerHeight - rect.bottom - 14;
      const above = rect.top - 14;
      const up = below < 250 && above > below;
      const maxHeight = Math.min(370, Math.max(150, up ? above : below));
      setPosition({
        position: 'fixed',
        width,
        maxHeight,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        ...(up ? {
          bottom: window.innerHeight - rect.top + 7
        } : {
          top: rect.bottom + 7
        }),
        fontFamily: cs.fontFamily,
        '--dd-brand': cs.getPropertyValue('--brand').trim() || '#005A9C',
        '--dd-ink': cs.getPropertyValue('--brand-dark').trim() || '#003366',
        '--dd-line': cs.getPropertyValue('--line').trim() || '#D6E0E9'
      } as React.CSSProperties & Record<`--${string}`, string>);
    };
    place();
    search.current?.focus({
      preventScroll: true
    });
    const outside = (event: PointerEvent) => {
      if (!popup.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close();
    };
    const scroll = (event: Event) => {
      if (!popup.current?.contains(event.target as Node)) place();
    };
    const resizeObserver = new ResizeObserver(place);
    resizeObserver.observe(trigger.current);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', scroll, true);
    return () => {
      resizeObserver.disconnect();
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', scroll, true);
    };
  }, [open]);
  useLayoutEffect(() => {
    const option = list.current?.querySelector<HTMLElement>(`[data-active="true"]`);
    if (option && list.current) {
      const top = option.offsetTop - list.current.offsetTop;
      if (top < list.current.scrollTop) list.current.scrollTop = top;else if (top + option.offsetHeight > list.current.scrollTop + list.current.clientHeight) list.current.scrollTop = top + option.offsetHeight - list.current.clientHeight;
    }
  }, [active, open]);
  function show() {
    setQuery('');
    setActive(selected && !selected.disabled ? selected.value : choices.find(x => !x.disabled)?.value ?? '');
    setOpen(true);
  }
  function choose(choice: Choice) {
    if (choice.disabled || !native.current) return;
    native.current.value = choice.value;
    native.current.dispatchEvent(new Event('change', {
      bubbles: true
    }));
    close(true);
  }
  function navigate(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key === 'Tab') {
      // Return to the field before the browser moves to its next/previous tab stop.
      close(true);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const choice = enabled.find(x => x.value === active);
      if (choice) choose(choice);
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const index = enabled.findIndex(x => x.value === active);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1 : Math.max(0, Math.min(enabled.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
      setActive(enabled[next]?.value ?? '');
    }
  }
  if (props.multiple || (props.size ?? 0) > 1) return <CanonElement as="select" canonId="SRM-C07" usage="CanonDropdown:native-multiple" {...props} ref={forwardedRef} />;
  return <span className={`srm-dropdown ${className}`} style={style} data-open={open} data-library-component={props['data-library-component']} data-canon-usage={(props as any)['data-canon-usage']}>
    <CanonElement as="select" canonId="SRM-C07" usage="CanonDropdown:native-value" {...nativeProps} disabled={disabled} value={value} defaultValue={defaultValue} ref={(node: HTMLSelectElement | null) => {
      native.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);else if (forwardedRef) forwardedRef.current = node;
    }} className="srm-dropdown-native" tabIndex={-1} aria-hidden="true" onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
      setLocalValue(event.target.value);
      onChange?.(event);
    }}>{children}</CanonElement>
    <CanonElement as="button" canonId="SRM-C07" usage="CanonDropdown:trigger" ref={trigger} type="button" className="srm-dropdown-trigger" disabled={disabled} aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} aria-invalid={props['aria-invalid']} title={selected?.label} onClick={() => open ? close() : show()} onKeyDown={(event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault();
        show();
      }
    }}>
      <span>{selected?.label ?? 'Wybierz wartość'}</span>
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg>
    </CanonElement>
    {open && createPortal(<div ref={popup} className="srm-dropdown-popup" style={position} data-canon-rule="ACT-08" data-library-component={props['data-library-component']} data-canon-usage={(props as any)['data-canon-usage']} onKeyDown={navigate} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== trigger.current) close();
    }}>
      <div className="srm-dropdown-search">
        <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5" /><path d="m12.5 12.5 4 4" /></svg>
        <CanonElement as="input" canonId="SRM-C07" usage="CanonDropdown:filter" ref={search} value={query} onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          setQuery(event.target.value);
          if (list.current) list.current.scrollTop = 0;
        }} placeholder="Filtruj wartości…" aria-label={`Filtruj: ${label}`} role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls={listId} aria-activedescendant={activeIndex >= 0 ? `${uid}-option-${activeIndex}` : undefined} />
      </div>
      <div ref={list} id={listId} role="listbox" aria-label={label} className="srm-dropdown-list">
        {visible.map((choice, index) => <CanonElement as="button" canonId="SRM-C07" usage="CanonDropdown:option" type="button" key={choice.value} id={`${uid}-option-${index}`} role="option" tabIndex={-1} aria-selected={choice.value === selectedValue} aria-disabled={choice.disabled || undefined} className="srm-dropdown-option" data-active={choice.value === active && !choice.disabled} data-empty={choice.value === ''} title={choice.label} onPointerMove={() => {
          if (!choice.disabled) setActive(choice.value);
        }} onMouseDown={(event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault()} onClick={() => choose(choice)}>
          <span>{choice.group && <small>{choice.group}</small>}{choice.label}</span>
          {choice.value === selectedValue && <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 10 3 3 7-7" /></svg>}
        </CanonElement>)}
        {!visible.length && <div className="srm-dropdown-empty" role="status">Brak pasujących wartości</div>}
      </div>
      {(query || matches.length > 40) && <div className="srm-dropdown-footer" role="status">
        {matches.length > 40 ? `Pokazano pierwsze 40 z ${matches.length} pasujących wartości. Dopisz więcej znaków, aby zawęzić listę.` : `${matches.length} z ${choices.length} pozycji`}
      </div>}
    </div>, document.body)}
  </span>;
});
