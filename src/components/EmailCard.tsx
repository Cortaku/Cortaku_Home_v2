'use client';

import { useRef, useState } from 'react';
import { Check, Copy, Mail } from 'lucide-react';
import { EMAIL, EMAIL_LINK } from '@/lib/site';

/** Copies the address as well as opening mail, since mailto does nothing without a mail app. */
export default function EmailCard() {
  const [status, setStatus] = useState<'idle' | 'opening' | 'copied'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = () => {
    // No preventDefault, so the mailto link still fires.
    setStatus('opening');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus('idle'), 5000);
    navigator.clipboard
      ?.writeText(EMAIL)
      .then(() => setStatus((current) => (current === 'opening' ? 'copied' : current)))
      .catch(() => {});
  };

  const message =
    status === 'copied' ? 'Address copied. Opening your mail app…' : status === 'opening' ? 'Opening your mail app…' : EMAIL;

  return (
    <a href={EMAIL_LINK} className="social" onClick={copy}>
      <Mail className="size-5" aria-hidden="true" />
      <span className="social-title">Email</span>
      <span className="social-handle" aria-live="polite">
        {message}
      </span>
      {status !== 'idle' ? (
        <Check className="size-4 social-arrow social-done" aria-hidden="true" />
      ) : (
        <Copy className="size-4 social-arrow" aria-hidden="true" />
      )}
    </a>
  );
}
