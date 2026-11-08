import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';

import { Button } from '../src/components/Button';
import { Mascot } from '../src/components/Mascot';
import { Screen } from '../src/components/Screen';
import { fonts, useTheme } from '../src/components/theme';
import { clearConversation } from '../src/features/chat/api';
import { copy } from '../src/lib/copy';

// T9 — Perfil, versão mínima do 8.4: "Limpar conversa" (6.1; critério 7), aviso 15.20 e rodapé 15.12.
// Editar perfil, termos, privacidade e "Apagar meus dados" entram no 8.10. Recebe: nada. Devolve: a tela.
export default function Profile() {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function clear() {
    setBusy(true);
    const ok = await clearConversation();
    setBusy(false);
    if (ok) setDone(true);
    else Alert.alert(copy.errors.noNetwork);
  }

  function confirmClear() {
    Alert.alert(copy.profile.clearChat, copy.profile.clearConfirm, [
      { text: copy.profile.cancel, style: 'cancel' },
      { text: copy.profile.clearAction, style: 'destructive', onPress: () => void clear() },
    ]);
  }

  return (
    <Screen
      footer={
        <>
          <Button testID="voltar" variant="ghost" label={copy.profile.back} onPress={() => router.back()} />
          <Text style={[styles.footer, { color: theme.textMuted }]}>{copy.profile.footer}</Text>
        </>
      }
    >
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{copy.profile.title}</Text>
      <Mascot mood="gentil" size={120} />
      <Button testID="limpar-conversa" label={copy.profile.clearChat} loading={busy} onPress={confirmClear} />
      {done ? <Text accessibilityLiveRegion="polite" style={[styles.body, { color: theme.text }]}>{copy.profile.cleared}</Text> : null}
      <Text style={[styles.body, { color: theme.textMuted }]}>{copy.profile.passportNotice}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.title, letterSpacing: 0.5, fontSize: 36, textAlign: 'center' },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, textAlign: 'center' },
  footer: { fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
});
