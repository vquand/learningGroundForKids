import { Link } from 'react-router-dom';
import { useUiLanguage } from '../hooks/useUiLanguage';
import { uiText } from '../i18n/uiText';
import './kidControls.css';

interface Props {
  to?: string;
  onClick?: () => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

/** All child-facing return actions share copy, arrow, type and visual treatment. */
export function KidBackButton({ to = '/playground', onClick, label = 'Back to Playground', disabled, className = '' }: Props) {
  useUiLanguage();
  const accessibleLabel = uiText(label);
  const content = <><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m10 5-7 7 7 7M3 12h18" /></svg><span className="kid-back__label">{accessibleLabel}</span></>;
  const classes = `kid-back ${className}`;
  if (onClick || disabled) return <button type="button" className={classes} aria-label={accessibleLabel} disabled={disabled} onClick={onClick}>{content}</button>;
  return <Link className={classes} aria-label={accessibleLabel} to={to}>{content}</Link>;
}
