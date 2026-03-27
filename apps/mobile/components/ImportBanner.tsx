import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useImportStore } from '../lib/zustand/importStore';

export function ImportBanner() {
  const { colors } = useTheme();
  const job = useImportStore((s) => s.currentJob);
  const dismiss = useImportStore((s) => s.dismissBanner);

  if (!job) return null;

  const isDone = job.status === 'done';
  const bg = isDone ? colors.accentGreenSoft : colors.accentSoft;
  const textColor = isDone ? colors.accentGreen : colors.accent;

  return (
    <TouchableOpacity
      onPress={isDone ? dismiss : undefined}
      style={{
        backgroundColor: bg,
        paddingHorizontal: 16,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: textColor, fontSize: 14, fontWeight: '600' }}>
          {isDone
            ? `Imported ${job.completed} recipe${job.completed !== 1 ? 's' : ''}${job.failed > 0 ? ` (${job.failed} failed)` : ''}`
            : `Importing ${job.completed}/${job.total} recipes...`}
        </Text>
        {!isDone && (
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
            Tap to see progress
          </Text>
        )}
      </View>
      {isDone && (
        <TouchableOpacity onPress={dismiss} hitSlop={8}>
          <Text style={{ color: textColor, fontSize: 18, fontWeight: '700' }}>{'\u00D7'}</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}
