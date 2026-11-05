import { useState } from 'react';
import { useUiLanguage } from '../hooks/useUiLanguage';
import { uiMessage, uiText } from '../i18n/uiText';
import './childFriendCode.css';

/** Copies the server-issued public friend code, never an internal profile ID. */
export function ChildFriendCode({ name, code }: { name: string; code?: string | null }) {
  useUiLanguage();
  const [feedback, setFeedback] = useState<{ code: string; status: 'copying' | 'copied' | 'failed' } | null>(null);
  if (!code) return null;
  const status = feedback?.code === code ? feedback.status : null;

  async function copy() {
    const currentCode = code!;
    setFeedback({ code: currentCode, status: 'copying' });
    try {
      await navigator.clipboard.writeText(currentCode);
      setFeedback({ code: currentCode, status: 'copied' });
    } catch {
      setFeedback({ code: currentCode, status: 'failed' });
    }
  }

  return <div className="child-friend-code">
    <div className="child-friend-code-actions">
      <div className="child-friend-code-value">{uiText('Friend code')} <code>{code}</code></div>
      <button type="button" onClick={() => void copy()} disabled={status === 'copying'} aria-label={uiMessage('Copy {name}’s friend code', { name })}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>
        {uiText('Copy code')}
      </button>
    </div>
    <p role="status" className="child-friend-code-status">{status === 'copied' ? uiText('Code copied!') : status === 'failed' ? uiText('Could not copy. Select the code to copy it.') : ''}</p>
  </div>;
}
