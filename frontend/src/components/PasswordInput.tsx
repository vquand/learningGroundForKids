import { useState, type InputHTMLAttributes } from 'react';
import { uiText } from '../i18n/uiText';

export function PasswordInput({ containerClassName = 'mt-1', className = '', ...input }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  containerClassName?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const label = uiText(revealed ? 'Hide password' : 'Show password');
  return <span className={`relative block ${containerClassName}`}>
    <input {...input} type={revealed ? 'text' : 'password'} className={`${className} cursor-text pr-12`} />
    <button type="button" aria-label={label} aria-pressed={revealed} title={label}
      onClick={() => setRevealed(value => !value)}
      className="absolute inset-y-0 right-0 flex min-h-11 w-12 items-center justify-center rounded-r-xl text-gray-500 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-600">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/>
        <circle cx="12" cy="12" r="2.5"/>
        {revealed && <path d="m4 4 16 16"/>}
      </svg>
    </button>
  </span>;
}
