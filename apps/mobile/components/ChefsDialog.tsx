import React, { ReactNode } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export interface ChefsDialogButton {
  label: string;
  variant: 'primary' | 'secondary' | 'cancel' | 'positive' | 'text';
  onPress: () => void;
}

interface ChefsDialogProps {
  visible: boolean;
  icon?: string;
  title: string;
  body: string | ReactNode;
  buttons: ChefsDialogButton[];
  onClose?: () => void;
  /** 'vertical' stacks pills full-width; 'horizontal' is the default side-by-side layout */
  layout?: 'horizontal' | 'vertical';
}

export default function ChefsDialog({ visible, icon, title, body, buttons, onClose, layout = 'horizontal' }: ChefsDialogProps) {
  const { colors } = useTheme();

  // White text on red/green buttons stays '#ffffff' (accessible contrast on colored bg)
  const VARIANT_STYLES: Record<ChefsDialogButton['variant'], { bg: string; border?: string; text: string }> = {
    primary: { bg: colors.accent, text: '#ffffff' },
    secondary: { bg: 'transparent', border: colors.accent, text: colors.accent },
    cancel: { bg: 'transparent', border: '#d1d5db', text: colors.textSecondary },
    positive: { bg: colors.accentGreen, text: '#ffffff' },
    text: { bg: 'transparent', text: colors.textSecondary },
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.container, { backgroundColor: colors.bgCard }]}>
          {icon && <Text style={styles.icon}>{icon}</Text>}
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          <View style={[styles.body, layout === 'vertical' ? { width: '100%' } : undefined]}>
            {typeof body === 'string' ? <Text style={[styles.bodyText, { color: colors.textSecondary }]}>{body}</Text> : body}
          </View>
          {layout === 'vertical' ? (
            <View style={styles.buttonColumn}>
              {buttons.map((btn) => {
                const vs = VARIANT_STYLES[btn.variant];
                if (btn.variant === 'text') {
                  return (
                    <TouchableOpacity key={btn.label} onPress={btn.onPress} style={styles.textButton}>
                      <Text style={[styles.textButtonLabel, { color: vs.text }]}>{btn.label}</Text>
                    </TouchableOpacity>
                  );
                }
                return (
                  <TouchableOpacity
                    key={btn.label}
                    onPress={btn.onPress}
                    style={[
                      styles.pillButton,
                      { backgroundColor: vs.bg },
                      vs.border ? { borderWidth: 1.5, borderColor: vs.border } : undefined,
                    ]}
                  >
                    <Text style={[styles.pillButtonText, { color: vs.text }]}>{btn.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.buttonRow}>
              {buttons.map((btn) => {
                const vs = VARIANT_STYLES[btn.variant];
                return (
                  <TouchableOpacity
                    key={btn.label}
                    onPress={btn.onPress}
                    style={[
                      styles.button,
                      { backgroundColor: vs.bg },
                      vs.border ? { borderWidth: 1.5, borderColor: vs.border } : undefined,
                    ]}
                  >
                    <Text style={[styles.buttonText, { color: vs.text }]}>{btn.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    borderRadius: 16,
    padding: 24,
    maxWidth: 360,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  icon: { fontSize: 32, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  body: { marginBottom: 24 },
  bodyText: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  // horizontal layout
  buttonRow: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  button: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 24 },
  buttonText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  // vertical layout
  buttonColumn: { width: '100%', gap: 10 },
  pillButton: { width: '100%', borderRadius: 24, paddingVertical: 13, alignItems: 'center' },
  pillButtonText: { fontSize: 15, fontWeight: '600' },
  textButton: { marginTop: 4, paddingVertical: 8, alignItems: 'center', width: '100%' },
  textButtonLabel: { fontSize: 14, fontWeight: '500' },
});
