import { uiCopyCanon } from './ui-copy-canon';
import React, { forwardRef } from 'react';
import { namedComponents } from './library-names';
import type { CanonId } from './canon-identifiers';
import { spacingRulesForComponent } from './spacing-contract';
import { CanonDropdown } from './CanonDropdown';
export type CanonProps = {
  canonId: CanonId;
  usage: string;
};
const definitions = new Map(namedComponents.map(c => [c.id, c]));
export function canonAttributes(id: CanonId, usage: string) {
  if (!definitions.has(id)) throw new Error('Brak definicji w bibliotece: ' + id);
  if (!usage) throw new Error('Komponent ' + id + ' wymaga identyfikatora użycia.');
  return {
    'data-library-component': id,
    'data-canon-usage': usage,
    'data-canon-source': 'shared-v1',
    'data-content-rule': uiCopyCanon.id,
    'data-spacing-rules': spacingRulesForComponent(id)
  };
}
function primitive<T extends HTMLElement>(tag: string) {
  return forwardRef<T, any>(function CanonPrimitive({
    canonId,
    usage,
    ...props
  }, ref) {
    return React.createElement(tag, {
      ...props,
      ...canonAttributes(canonId, usage),
      ref
    });
  });
}
export const CanonButton = primitive<HTMLButtonElement>('button') as React.ForwardRefExoticComponent<React.ButtonHTMLAttributes<HTMLButtonElement> & CanonProps & React.RefAttributes<HTMLButtonElement>>;
export const CanonInput = primitive<HTMLInputElement>('input') as React.ForwardRefExoticComponent<React.InputHTMLAttributes<HTMLInputElement> & CanonProps & React.RefAttributes<HTMLInputElement>>;
export const CanonSelect = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & CanonProps>(function CanonSelect({
  canonId,
  usage,
  ...props
}, ref) {
  return <CanonDropdown {...props} {...canonAttributes(canonId, usage)} ref={ref} />;
});
export const CanonTextarea = primitive<HTMLTextAreaElement>('textarea') as React.ForwardRefExoticComponent<React.TextareaHTMLAttributes<HTMLTextAreaElement> & CanonProps & React.RefAttributes<HTMLTextAreaElement>>;
export const CanonSummary = primitive<HTMLElement>('summary');
export const CanonLink = primitive<HTMLAnchorElement>('a');
export const CanonElement = forwardRef<any, CanonProps & {
  as: keyof React.JSX.IntrinsicElements;
  [key: string]: any;
}>(function CanonElement({
  as,
  canonId,
  usage,
  ...props
}, ref) {
  return React.createElement(as, {
    ...props,
    ...canonAttributes(canonId, usage),
    ref
  });
});
export function CanonCloseButton({
  canonId = "SRM-C60",
  usage,
  className = "",
  ...props
}: React.ComponentPropsWithRef<'button'> & {
  canonId?: 'SRM-C60';
  usage: string;
}) {
  return React.createElement('button', {
    ...props,
    ...canonAttributes(canonId, usage),
    type: 'button',
    className: 'srm-close-window ' + className,
    'aria-label': props['aria-label'] ?? 'Zamknij',
    title: props.title ?? 'Zamknij'
  }, <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>);
}
