import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { formatCountdown } from '../lib/timers';

interface CountdownTimerProps {
  minutes: number;
  label: string;
  compact?: boolean;
  onDone?: () => void;
}

export function CountdownTimer({ minutes, label, compact, onDone }: CountdownTimerProps) {
  const { colors } = useTheme();
  const [remaining, setRemaining] = useState(minutes * 60);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRunning(false);
  }, []);

  const start = useCallback(() => {
    if (remaining <= 0) setRemaining(minutes * 60);
    setRunning(true);
  }, [remaining, minutes]);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          stop();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onDone?.();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, stop, onDone]);

  useEffect(() => () => stop(), [stop]);

  const reset = () => { stop(); setRemaining(minutes * 60); };
  const done = remaining === 0;
  const progress = 1 - remaining / (minutes * 60);

  if (compact) {
    return (
      <TouchableOpacity
        onPress={() => (running ? stop() : start())}
        onLongPress={reset}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: done ? colors.accentGreenSoft : running ? colors.accentSoft : colors.bgBase,
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 6,
          gap: 6,
        }}
      >
        <Text style={{ fontSize: 14 }}>{done ? '\u2705' : '\u23F1'}</Text>
        <Text style={{
          color: done ? colors.accentGreen : running ? colors.accent : colors.textPrimary,
          fontSize: 14,
          fontWeight: '600',
          fontVariant: ['tabular-nums'],
        }}>
          {formatCountdown(remaining)}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={{
      backgroundColor: done ? colors.accentGreenSoft : running ? colors.accentSoft : colors.bgCard,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: done ? colors.accentGreen : running ? colors.accent : colors.borderDefault,
      padding: 16,
      alignItems: 'center',
    }}>
      <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 4 }}>{label}</Text>
      <Text style={{
        color: done ? colors.accentGreen : running ? colors.accent : colors.textPrimary,
        fontSize: 40,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
      }}>
        {formatCountdown(remaining)}
      </Text>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
        <TouchableOpacity
          onPress={() => (running ? stop() : start())}
          style={{
            backgroundColor: running ? colors.bgBase : colors.accent,
            borderRadius: 8,
            paddingHorizontal: 20,
            paddingVertical: 8,
          }}
        >
          <Text style={{ color: running ? colors.textPrimary : '#ffffff', fontWeight: '600', fontSize: 15 }}>
            {done ? 'Restart' : running ? 'Pause' : 'Start'}
          </Text>
        </TouchableOpacity>
        {(running || remaining !== minutes * 60) && !done && (
          <TouchableOpacity
            onPress={reset}
            style={{ backgroundColor: colors.bgBase, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 }}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 15 }}>Reset</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
