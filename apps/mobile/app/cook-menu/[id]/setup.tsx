import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../context/ThemeContext';

export default function SetupChefsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [chefs, setChefs] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');

  const addChef = () => {
    const name = inputValue.trim();
    if (!name) return;
    if (chefs.includes(name)) {
      setInputValue('');
      return;
    }
    setChefs((prev) => [...prev, name]);
    setInputValue('');
  };

  const removeChef = (name: string) => {
    setChefs((prev) => prev.filter((c) => c !== name));
  };

  const canProceed = chefs.length >= 1;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bgScreen }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: 16,
          backgroundColor: colors.bgCard,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderDefault,
        }}
      >
        <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 4 }}>
          Step 1 of 4
        </Text>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.textPrimary }}>
          Who's cooking?
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>
          Add at least one chef. Steps will be assigned by name.
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Input row */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
          <TextInput
            style={{
              flex: 1,
              height: 48,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.borderDefault,
              backgroundColor: colors.bgCard,
              paddingHorizontal: 16,
              fontSize: 16,
              color: colors.textPrimary,
            }}
            placeholder="Chef name"
            placeholderTextColor={colors.textMuted}
            value={inputValue}
            onChangeText={setInputValue}
            onSubmitEditing={addChef}
            returnKeyType="done"
            autoCapitalize="words"
          />
          <TouchableOpacity
            onPress={addChef}
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              backgroundColor: colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="add" size={26} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Chef chips */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {chefs.map((chef) => (
            <View
              key={chef}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.accentSoft,
                borderRadius: 24,
                paddingVertical: 10,
                paddingLeft: 18,
                paddingRight: 12,
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.accent }}>
                {chef}
              </Text>
              <TouchableOpacity onPress={() => removeChef(chef)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={20} color={colors.accent} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {chefs.length === 0 && (
          <Text style={{ color: colors.textMuted, fontSize: 14, fontStyle: 'italic', marginTop: 8 }}>
            No chefs added yet. Add at least one to continue.
          </Text>
        )}
      </ScrollView>

      {/* Bottom button */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 16,
          paddingTop: 12,
          backgroundColor: colors.bgCard,
          borderTopWidth: 1,
          borderTopColor: colors.borderDefault,
        }}
      >
        <TouchableOpacity
          onPress={() => {
            if (!canProceed) return;
            router.push({
              pathname: `/cook-menu/${id}/setup-ovens` as any,
              params: { chefs: JSON.stringify(chefs) },
            });
          }}
          disabled={!canProceed}
          style={{
            height: 52,
            borderRadius: 12,
            backgroundColor: canProceed ? colors.accent : colors.bgBase,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: canProceed ? 1 : 0.5,
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: '700', color: canProceed ? '#fff' : colors.textMuted }}>
            Next
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
