import React, { ReactNode } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';

export interface ChefsDialogButton {
  label: string;
  variant: 'primary' | 'secondary' | 'cancel' | 'positive';
  onPress: () => void;
}

interface ChefsDialogProps {
  visible: boolean;
  icon?: string;
  title: string;
  body: string | ReactNode;
  buttons: ChefsDialogButton[];
  onClose?: () => void;
}

const VARIANT_STYLES: Record<ChefsDialogButton['variant'], { bg: string; border?: string; text: string }> = {
  primary: { bg: '#ce2b37', text: '#ffffff' },
  secondary: { bg: 'transparent', border: '#ce2b37', text: '#ce2b37' },
  cancel: { bg: 'transparent', border: '#d1d5db', text: '#6b7280' },
  positive: { bg: '#009246', text: '#ffffff' },
};

export default function ChefsDialog({ visible, icon, title, body, buttons, onClose }: ChefsDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {icon && <Text style={styles.icon}>{icon}</Text>}
          <Text style={styles.title}>{title}</Text>
          <View style={styles.body}>
            {typeof body === 'string' ? <Text style={styles.bodyText}>{body}</Text> : body}
          </View>
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
    backgroundColor: '#ffffff',
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
  title: { fontSize: 18, fontWeight: '600', color: '#1a1a1a', textAlign: 'center', marginBottom: 8 },
  body: { marginBottom: 24 },
  bodyText: { fontSize: 14, color: '#6b7280', lineHeight: 22, textAlign: 'center' },
  buttonRow: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  button: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 24 },
  buttonText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
