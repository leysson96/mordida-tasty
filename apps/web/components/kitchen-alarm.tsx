'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { OrderSummary } from '../lib/types';

const alarmStatuses = new Set(['PAID', 'CONFIRMED']);
const alarmPreferenceKey = 'mordida_kitchen_alarm_enabled';

export function KitchenAlarm({
  orders,
  acknowledged,
  onSilence
}: {
  orders: OrderSummary[];
  acknowledged: Set<string>;
  onSilence: () => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [ringing, setRinging] = useState(false);
  const [audioError, setAudioError] = useState<string>();
  const contextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | undefined>(undefined);

  const hasNewOrder = orders.some(
    (order) => alarmStatuses.has(order.status) && !acknowledged.has(order.id)
  );

  const stopRepeatingBeep = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, []);

  const playBeep = useCallback(async () => {
    try {
      const audioContext =
        contextRef.current ?? new window.AudioContext({ latencyHint: 'interactive' });
      contextRef.current = audioContext;

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'square';
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.35, audioContext.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.45);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.5);
      setAudioError(undefined);
    } catch {
      setAudioError('No se pudo activar el sonido en este navegador.');
    }
  }, []);

  useEffect(() => {
    setEnabled(window.localStorage.getItem(alarmPreferenceKey) === 'true');
  }, []);

  useEffect(() => {
    if (!enabled || !hasNewOrder) {
      setRinging(false);
      stopRepeatingBeep();
      return;
    }

    setRinging(true);
    void playBeep();
    intervalRef.current = window.setInterval(() => {
      void playBeep();
    }, 1500);

    return () => {
      stopRepeatingBeep();
    };
  }, [enabled, hasNewOrder, playBeep, stopRepeatingBeep]);

  function enableSound() {
    setEnabled(true);
    window.localStorage.setItem(alarmPreferenceKey, 'true');
    void playBeep();
  }

  function silence() {
    onSilence();
    setRinging(false);
    stopRepeatingBeep();
  }

  return (
    <div className={`alarm-strip ${ringing ? 'ringing' : ''}`}>
      <button type="button" className="button secondary" onClick={enableSound}>
        <Bell aria-hidden="true" size={18} />
        {enabled ? 'Probar sonido' : 'Sonido'}
      </button>
      <button type="button" className="button secondary" onClick={silence}>
        <BellOff aria-hidden="true" size={18} />
        Silenciar
      </button>
      <span className={`status-pill ${enabled ? '' : 'danger'}`}>
        {enabled ? 'Sonido activo' : 'Sonido apagado'}
      </span>
      <strong>{audioError ?? (hasNewOrder ? 'Pedido nuevo' : 'Sin avisos')}</strong>
    </div>
  );
}
