import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

// --- Button ---
interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({ title, onPress, variant = 'primary', size = 'md', disabled, loading, icon }: ButtonProps) {
  const { colors } = useTheme();
  const heights = { sm: 36, md: 44, lg: 52 };
  const fontSizes = { sm: 13, md: 15, lg: 17 };

  const bgColor = variant === 'primary' ? colors.accent : variant === 'secondary' ? colors.bgBase : 'transparent';
  const textColor = variant === 'primary' ? '#ffffff' : colors.textPrimary;
  const borderColor = variant === 'secondary' ? colors.borderDefault : 'transparent';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        {
          height: heights[size],
          backgroundColor: bgColor,
          borderRadius: 10,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 20,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <>
          {icon && <View style={{ marginRight: 8 }}>{icon}</View>}
          <Text style={{ color: textColor, fontSize: fontSizes[size], fontWeight: '600' }}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// --- Card ---
interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

export function Card({ children, onPress, style }: CardProps) {
  const { colors } = useTheme();
  const content = (
    <View
      style={[
        {
          backgroundColor: colors.bgCard,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.borderDefault,
          padding: 16,
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{content}</TouchableOpacity>;
  }
  return content;
}

// --- Input ---
interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: TextInput['props']['keyboardType'];
  secureTextEntry?: boolean;
  autoCapitalize?: TextInput['props']['autoCapitalize'];
  style?: ViewStyle;
}

export function Input({ value, onChangeText, placeholder, multiline, keyboardType, secureTextEntry, autoCapitalize, style }: InputProps) {
  const { colors } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textSecondary}
      multiline={multiline}
      keyboardType={keyboardType}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize}
      style={[
        {
          backgroundColor: colors.bgBase,
          borderWidth: 1,
          borderColor: colors.borderDefault,
          borderRadius: 10,
          padding: 12,
          fontSize: 15,
          color: colors.textPrimary,
          minHeight: multiline ? 100 : 44,
          textAlignVertical: multiline ? 'top' : 'center',
        },
        style,
      ]}
    />
  );
}

// --- Badge ---
interface BadgeProps {
  label: string;
  color?: string;
}

export function Badge({ label, color }: BadgeProps) {
  const { colors } = useTheme();
  const bg = color ?? colors.accent;
  return (
    <View style={{ backgroundColor: bg + '20', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color: bg, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

// --- Avatar ---
interface AvatarProps {
  uri?: string | null;
  initials?: string;
  size?: number;
}

export function Avatar({ uri, initials, size = 40 }: AvatarProps) {
  const { colors } = useTheme();
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.bgBase }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#ffffff', fontSize: size * 0.4, fontWeight: '700' }}>{initials ?? '?'}</Text>
    </View>
  );
}

// --- Section Header ---
interface SectionHeaderProps {
  title: string;
  action?: { label: string; onPress: () => void };
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={action.onPress}>
          <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// --- EmptyState ---
interface EmptyStateProps {
  icon?: string;
  title: string;
  message: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      {icon && <Text style={{ fontSize: 48, marginBottom: 16 }}>{icon}</Text>}
      <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '600', marginBottom: 8, textAlign: 'center' }}>{title}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 20 }}>{message}</Text>
      {action && <Button title={action.label} onPress={action.onPress} variant="secondary" />}
    </View>
  );
}

// --- Loading ---
export function Loading({ message }: { message?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={colors.accent} />
      {message && <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 14 }}>{message}</Text>}
    </View>
  );
}

// --- Chip ---
interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({ label, selected, onPress }: ChipProps) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: selected ? colors.accent : colors.bgBase,
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 7,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text style={{ color: selected ? '#ffffff' : colors.textPrimary, fontSize: 13, fontWeight: selected ? '600' : '400' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// --- Divider ---
export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.borderDefault, marginVertical: 12 }} />;
}

// --- RecipeCard ---
interface RecipeCardProps {
  title: string;
  imageUrl?: string | null;
  cuisine?: string | null;
  totalMinutes?: number | null;
  isFavourite?: boolean;
  sourceUrl?: string | null;
  sourceType?: string | null;
  onPress: () => void;
}

export function RecipeCard({ title, imageUrl, cuisine, totalMinutes, isFavourite, sourceUrl, sourceType, onPress }: RecipeCardProps) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{ marginBottom: 12 }}>
      <View style={{ backgroundColor: colors.bgCard, borderRadius: 12, borderWidth: 1, borderColor: colors.borderDefault, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
        {imageUrl && (
          <Image source={{ uri: imageUrl }} style={{ width: '100%', height: 160, backgroundColor: colors.bgBase }} />
        )}
        <View style={{ padding: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', flex: 1 }} numberOfLines={2}>
              {title}
            </Text>
            {isFavourite && <Text style={{ fontSize: 16, marginLeft: 8 }}>{'\u2764'}</Text>}
          </View>
          <View style={{ flexDirection: 'row', marginTop: 6, gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {cuisine && <Badge label={cuisine} />}
            {totalMinutes != null && totalMinutes > 0 && (
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{totalMinutes}min</Text>
            )}
            {sourceType === 'url' && sourceUrl && (
              <Text style={{ color: colors.textSecondary, fontSize: 11 }} numberOfLines={1}>
                {new URL(sourceUrl).hostname.replace('www.', '')}
              </Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
