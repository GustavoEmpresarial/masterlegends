import { useCallback, useRef, useState } from 'react';
import type { ScoutMintResponse, ScoutPlayerDTO } from '@mll/shared';
import { useScoutMint } from '../../hooks/useApi';
import { extractErrorCode, translateError } from '../../lib/apiError';
import { SCOUT_LAP_MS } from './scoutMintConstants';

export type ScoutMintPhase = 'idle' | 'scouting' | 'landing' | 'reveal' | 'error';

export function useScoutMintAnimation() {
  const scoutMint = useScoutMint();
  const [phase, setPhase] = useState<ScoutMintPhase>('idle');
  const [players, setPlayers] = useState<ScoutPlayerDTO[]>([]);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [skipped, setSkipped] = useState(false);

  const skippedRef = useRef(false);
  const resultRef = useRef<ScoutMintResponse | null>(null);
  const cancelWaitRef = useRef<(() => void) | null>(null);

  const reset = useCallback(() => {
    skippedRef.current = false;
    resultRef.current = null;
    cancelWaitRef.current?.();
    cancelWaitRef.current = null;
    setSkipped(false);
    setPhase('idle');
    setPlayers([]);
    setError('');
    setErrorCode('');
  }, []);

  const waitOrSkip = useCallback((ms: number) => {
    return new Promise<void>((resolve) => {
      if (skippedRef.current) {
        resolve();
        return;
      }
      const timer = window.setTimeout(() => {
        cancelWaitRef.current = null;
        resolve();
      }, ms);
      cancelWaitRef.current = () => {
        window.clearTimeout(timer);
        cancelWaitRef.current = null;
        resolve();
      };
    });
  }, []);

  const finishWithPlayers = useCallback((result: ScoutMintResponse, forceReveal: boolean) => {
    setPlayers(result.players);
    setPhase(forceReveal || skippedRef.current ? 'reveal' : 'landing');
  }, []);

  const startMint = useCallback(
    async (qty: number) => {
      skippedRef.current = false;
      resultRef.current = null;
      cancelWaitRef.current?.();
      cancelWaitRef.current = null;
      setSkipped(false);
      setQuantity(qty);
      setError('');
      setErrorCode('');
      setPlayers([]);
      setPhase('scouting');

      try {
        let result: ScoutMintResponse;

        try {
          result = await scoutMint.mutateAsync(qty);
        } catch (err: unknown) {
          setErrorCode(extractErrorCode(err));
          setError(translateError(err, 'SCOUT_MINT_FAILED'));
          setPhase('error');
          return;
        }

        resultRef.current = result;
        if (skippedRef.current) {
          finishWithPlayers(result, true);
          return;
        }

        await waitOrSkip(qty * SCOUT_LAP_MS);
        finishWithPlayers(result, skippedRef.current);
      } catch (err: unknown) {
        setErrorCode(extractErrorCode(err));
        setError(translateError(err, 'SCOUT_MINT_FAILED'));
        setPhase('error');
      }
    },
    [scoutMint, finishWithPlayers, waitOrSkip],
  );

  const skipToReveal = useCallback(() => {
    skippedRef.current = true;
    setSkipped(true);
    cancelWaitRef.current?.();
    const ready = resultRef.current;
    if (ready) {
      setPlayers(ready.players);
      setPhase('reveal');
    }
  }, []);

  const completeLanding = useCallback(() => {
    setPhase('idle');
  }, []);

  const showReveal = useCallback(() => {
    setPhase('reveal');
  }, []);

  const isActive = phase !== 'idle';

  return {
    phase,
    players,
    error,
    errorCode,
    quantity,
    skipped,
    startMint,
    skipToReveal,
    reset,
    completeLanding,
    showReveal,
    isActive,
    isPending: scoutMint.isPending,
  };
}
