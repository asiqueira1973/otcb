import { StyleSheet, Text } from 'react-native';

import { Mascot } from '../../src/components/Mascot';
import { Screen } from '../../src/components/Screen';
import { fonts, useTheme } from '../../src/components/theme';
import { copy } from '../../src/lib/copy';

// T10 — Bloqueio de menor (épico 8.1, passo 4; copy 15.2). A conta anônima já foi apagada pela T2;
// na próxima abertura o fluxo recomeça (seção 6). Recebe: nada. Devolve: a mensagem, sem ações.
export default function Blocked() {
  const theme = useTheme();
  return (
    <Screen>
      <Mascot mood="gentil" size={180} />
      <Text accessibilityRole="header" style={[styles.text, { color: theme.text }]}>
        {copy.blocked}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  text: { fontFamily: fonts.title, fontSize: 26, lineHeight: 32, textAlign: 'center' },
});
