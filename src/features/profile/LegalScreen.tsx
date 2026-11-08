import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { fonts, useTheme } from '../../components/theme';
import { copy } from '../../lib/copy';
import type { LegalDoc } from '../../lib/legal';

// Tela de texto legal (Termos de uso e Política de privacidade; épico 8.10, T9). Texto embutido no app:
// abre sem rede. Recebe: o documento de src/lib/legal.ts e o testID da tela. Devolve: a tela rolável.
export function LegalScreen({ doc, testID }: { doc: LegalDoc; testID: string }) {
  const theme = useTheme();
  return (
    <Screen footer={<Button testID="voltar-legal" variant="ghost" label={copy.profile.back} onPress={() => router.back()} />}>
      <View testID={testID} style={styles.gap}>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{doc.title}</Text>
        <Text style={[styles.meta, { color: theme.textMuted }]}>{doc.updatedAt}</Text>
        {doc.sections.map((s) => (
          <View key={s.title} style={styles.section}>
            <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>{s.title}</Text>
            <Text style={[styles.body, { color: theme.text }]}>{s.body}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 16, paddingBottom: 24 },
  section: { gap: 6 },
  title: { fontFamily: fonts.title, letterSpacing: 0.5, fontSize: 34 },
  heading: { fontFamily: fonts.bodyBold, fontSize: 17 },
  meta: { fontFamily: fonts.body, fontSize: 13 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23 },
});
