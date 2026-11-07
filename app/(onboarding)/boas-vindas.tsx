import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { Mascot } from '../../src/components/Mascot';
import { Screen } from '../../src/components/Screen';
import { TilePattern } from '../../src/components/TilePattern';
import { fonts, useTheme } from '../../src/components/theme';
import { copy } from '../../src/lib/copy';

// T1 — Boas-vindas (seção 10; copy 15.1 e 15.19). A sessão anônima já foi criada na abertura (8.1, passo 1).
// Recebe: nada. Devolve: a tela com o aviso 18+ e o único botão "Bora começar", que leva à Maioridade.
export default function Welcome() {
  const theme = useTheme();
  return (
    <Screen
      background={<TilePattern />}
      footer={
        <>
          <Button testID="bora-comecar" label={copy.welcome.start} onPress={() => router.push('/maioridade')} />
          <Text style={[styles.footer, { color: theme.textMuted }]}>{copy.welcome.footer}</Text>
        </>
      }
    >
      <View style={styles.hero}>
        <Text accessibilityRole="header" style={[styles.brand, { color: theme.accent }]}>
          {copy.brand}
        </Text>
        <Mascot mood="feliz" size={200} />
      </View>
      <Text style={[styles.title, { color: theme.text }]}>{copy.welcome.title}</Text>
      <Text style={[styles.subtitle, { color: theme.textMuted }]}>{copy.welcome.subtitle}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, minHeight: 280 },
  brand: { fontFamily: fonts.title, fontSize: 40, letterSpacing: 2 },
  title: { fontFamily: fonts.title, fontSize: 34, lineHeight: 40 },
  subtitle: { fontFamily: fonts.body, fontSize: 18, lineHeight: 26 },
  footer: { fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
});
