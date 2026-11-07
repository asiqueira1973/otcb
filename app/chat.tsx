import { StyleSheet, TextInput } from 'react-native';

import { Mascot } from '../src/components/Mascot';
import { Screen } from '../src/components/Screen';
import { fonts, useTheme } from '../src/components/theme';
import { copy } from '../src/lib/copy';

// T5 — Chat (provisório do épico 8.1: só o destino do onboarding). A conversa com o agente é o épico 8.4.
// Recebe: nada. Devolve: a tela com a Bolacha e o campo do chat desabilitado.
export default function Chat() {
  const theme = useTheme();
  return (
    <Screen
      footer={
        <TextInput
          editable={false}
          accessibilityLabel={copy.chat.inputPlaceholder}
          placeholder={copy.chat.inputPlaceholder}
          placeholderTextColor={theme.textMuted}
          style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
        />
      }
    >
      <Mascot mood="feliz" size={120} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 52, borderRadius: 26, borderWidth: 2, paddingHorizontal: 20, fontFamily: fonts.body, fontSize: 17 },
});
