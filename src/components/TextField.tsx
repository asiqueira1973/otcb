import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { fonts, useTheme } from './theme';

type Props = Omit<TextInputProps, 'style'> & { label: string; hint?: string; error?: string | null };

// Campo de texto com rótulo, dica e erro inline (épico 8.1: "apelido em uso" e formato aparecem no campo).
// Recebe: rótulo, dica, erro e as props do TextInput. Devolve: o campo acessível; o erro é anunciado.
export function TextField({ label, hint, error, ...input }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={theme.textMuted}
        style={[
          styles.input,
          { backgroundColor: theme.card, color: theme.text, borderColor: error ? theme.error : theme.border },
        ]}
        {...input}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.helper, { color: theme.error }]}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={[styles.helper, { color: theme.textMuted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontFamily: fonts.bodyBold, fontSize: 16 },
  input: { minHeight: 56, borderRadius: 16, borderWidth: 2, paddingHorizontal: 16, fontFamily: fonts.body, fontSize: 18 },
  helper: { fontFamily: fonts.body, fontSize: 14 },
});
