import { useEffect, useState } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

interface TurnstileWidgetProps {
  onTokenChange: (token: string | null) => void;
  onExpire?: () => void;
  onError?: () => void;
}

export function isTurnstileConfigured(): boolean {
  return Boolean(SITE_KEY?.trim());
}

function useCompactTurnstile(): boolean {
  const [compact, setCompact] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)').matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const onChange = () => setCompact(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return compact;
}

export function TurnstileWidget({ onTokenChange, onExpire, onError }: TurnstileWidgetProps) {
  const compact = useCompactTurnstile();

  if (!isTurnstileConfigured()) return null;

  return (
    <div className="turnstile-wrap flex justify-center">
      <Turnstile
        siteKey={SITE_KEY}
        onSuccess={onTokenChange}
        onExpire={() => {
          onTokenChange(null);
          onExpire?.();
        }}
        onError={() => {
          onTokenChange(null);
          onError?.();
        }}
        options={{ theme: 'dark', size: compact ? 'compact' : 'normal' }}
      />
    </div>
  );
}
