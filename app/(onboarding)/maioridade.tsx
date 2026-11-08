import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { fonts, useTheme } from '../../src/components/theme';
import { isAdult, isFuture, maskBirthDate, parseBirthDate, todayInSaoPaulo } from '../../src/features/auth/age';
import { forgetProfile } from '../../src/features/auth/profile-flag';
import { deleteAccountAndSignOut } from '../../src/features/auth/session';
import { copy } from '../../src/lib/copy';
import { supabase } from '../../src/lib/supabase';

// T2 — Maioridade (seção 6 e épico 8.1, passos 3–4). A data é digitada e calculada só no app;
// ela vive apenas neste estado e nunca é enviada, gravada nem logada (seção 20).
// 18+ → T3 levando só o instante da confirmação; menor → apaga a conta anônima (13.8) e mostra T10.
// Recebe: nada. Devolve: a tela com o campo de data e o botão "Confirmar".
export default function Age() {
  const theme = useTheme();
  const [birth, setBirth] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    const parsed = parseBirthDate(birth);
    const today = todayInSaoPaulo();
    if (!parsed || isFuture(parsed, today)) {
      setError(copy.age.invalidDate);
      return;
    }
    if (isAdult(parsed, today)) {
      router.push({ pathname: '/apelido', params: { confirmadaEm: new Date().toISOString() } });
      return;
    }
    setBusy(true);
    try {
      await forgetProfile();
      await deleteAccountAndSignOut(supabase);
    } catch {
      // Sem rede: a sessão local já foi limpa; o usuário anônimo órfão é aceito (24.13).
    } finally {
      router.replace('/bloqueio');
    }
  }

  return (
    <Screen footer={<Button testID="confirmar-idade" label={copy.age.confirm} onPress={() => void confirm()} loading={busy} />}>
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
        {copy.age.question}
      </Text>
      <Text style={[styles.explain, { color: theme.textMuted }]}>{copy.age.explain}</Text>
      <TextField
        testID="data-nascimento"
        label={copy.age.fieldLabel}
        placeholder={copy.age.placeholder}
        keyboardType="number-pad"
        value={birth}
        maxLength={10}
        error={error}
        onChangeText={(text) => {
          setBirth(maskBirthDate(text));
          setError(null);
        }}
        onSubmitEditing={() => void confirm()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.title, letterSpacing: 0.5, fontSize: 38, lineHeight: 41 },
  explain: { fontFamily: fonts.body, fontSize: 18 },
});
