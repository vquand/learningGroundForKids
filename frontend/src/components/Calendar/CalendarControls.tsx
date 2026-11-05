import type { ComponentProps } from 'react';
import './CalendarControls.css';

type ButtonProps = ComponentProps<'button'>;
type Icon = 'up' | 'down' | 'remove' | 'close';
const icons: Record<Icon, string> = { up: '↑', down: '↓', remove: '×', close: '×' };

/** Shared calendar controls. Callers own labels, state and actions; this module owns appearance. */
export function CalendarIconButton({ icon, className = '', ...props }: Omit<ButtonProps, 'children' | 'aria-label'> & { icon: Icon; 'aria-label': string }) {
  return <button type="button" {...props} className={`calendar-icon-button calendar-icon-button--${icon} ${className}`}><span aria-hidden="true">{icons[icon]}</span></button>;
}

interface GroupButton {
  key: string;
  label: string;
  accessibleLabel: string;
  disabled?: boolean;
  pressed?: boolean;
  onClick: () => void;
}

/** One DOM structure and skin for every compact group; callers supply labels and behavior only. */
export function CalendarButtonGroup({ label, buttons }: { label: string; buttons: readonly GroupButton[] }) {
  return <div className="calendar-button-group" role="group" aria-label={label}>
    {buttons.map(button => <button key={button.key} type="button" className="calendar-group-button"
      aria-label={button.accessibleLabel} title={button.accessibleLabel} aria-pressed={button.pressed}
      disabled={button.disabled} onClick={button.onClick}>{button.label}</button>)}
  </div>;
}

/** Shared selectable text chips; appearance and pressed states stay identical for every choice. */
export function CalendarChoiceChip({ children, ...props }: Omit<ButtonProps, 'className'>) {
  return <button type="button" {...props} className="calendar-palette-choice calendar-choice-chip">{children}</button>;
}
