'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { OrderSummary } from '../lib/types';

const alarmStatuses = new Set(['PAID', 'CONFIRMED']);

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
  const contextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | undefined>(undefined);

  const hasNewOrder = orders.some(
    (order) => alarmStatuses.has(order.status) && !acknowledged.has(order.id)
  );

  useEffect(() => {
    if (!enabled || !hasNewOrder) {
      setRinging(false);
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
      return;
    }

    setRinging(true);
    const playBeep = () => {
      const audioContext =
        contextRef.current ?? new window.AudioContext({ latencyHint: 'interactive' });
      contextRef.current = audioContext;
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
    };

    playBeep();
    intervalRef.current = window.setInterval(playBeep, 1500);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };
  }, [enabled, hasNewOrder]);

  function silence() {
    onSilence();
    setRinging(false);
  }

  return (
    <div className={`alarm-strip ${ringing ? 'ringing' : ''}`}>
      <button type="button" className="button secondary" onClick={() => setEnabled(true)}>
        <Bell aria-hidden="true" size={18} />
        Sonido
      </button>
      <button type="button" className="button secondary" onClick={silence}>
        <BellOff aria-hidden="true" size={18} />
        Silenciar
      </button>
      <strong>{hasNewOrder ? 'Pedido nuevo' : 'Sin avisos'}</strong>
    </div>
  );
}
