import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { useScheduleStatus } from '../../hooks/useScheduleStatus';
import { uiMessage, uiText } from '../../i18n/uiText';
import './AdventureLock.css';

const OPEN_WHILE_LOCKED = ['/playground', '/calendar'];

export function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Sends a locked child back to the Playground and shows the 5-minute warning. The server enforces; this only reflects. */
export function AdventureLockGuard({ children }: { children: ReactNode }) {
  useUiLanguage();
  const location = useLocation();
  const { locked, warning, secondsLeft } = useScheduleStatus();
  if (locked && !OPEN_WHILE_LOCKED.includes(location.pathname)) return <Navigate replace to="/playground" />;
  return <>
    {warning && secondsLeft !== null && <div className="adventure-warning" role="status" aria-live="polite">
      {uiMessage('Adventure time ends in {time}. Finish up and save your game!', { time: formatCountdown(secondsLeft) })}</div>}
    {children}
  </>;
}

export function LockedMessage({ nextOpenAt }: { nextOpenAt: string | null }) {
  useUiLanguage();
  const time = nextOpenAt ? new Date(nextOpenAt).toLocaleString(undefined, { weekday: 'long', hour: '2-digit', minute: '2-digit' }) : null;
  return <p className="adventure-locked-message" role="status">
    <strong>{uiText('It’s not adventure time just yet!')}</strong>
    {time ? <span>{uiMessage('Your next adventure starts {time}.', { time })}</span> : <span>{uiText('Ask a grown-up when adventure time is.')}</span>}
  </p>;
}
