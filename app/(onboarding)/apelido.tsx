import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { fonts, useTheme } from '../../src/components/theme';
import { nicknameErrorFromDb, validateNickname } from '../../src/features/auth/nickname';
import { rememberProfile } from '../../src/features/auth/profile-flag';
import { copy } from '../../src/lib/copy';
import { supabase } from '../../src/lib/supabase';
import { track } from '../../src/lib/telemetry';

// T3 — Apelido e time (épico 8.1, passo 5; regra 11.7). Grava a própria linha em otcb_perfis
// (política otcb_perfis_insere_proprio) com o instante da confirmação de maioridade vindo da T2.
// Apelido fora do formato ou já usado (sem diferenciar maiúsculas) → erro inline.
// Recebe: o parâmetro confirmadaEm. Devolve: a tela com apelido, time opcional e o botão "Bora".
export default function Nickname() {
  const theme = useTheme();
  const { confirmadaEm } = useLocalSearchParams<{ confirmadaEm?: string }>();
  const [nickname, setNickname] = useState('');
  const [team, setTeam] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const value = nickname.trim();
    if (validateNickname(value)) {
      setError(copy.nickname.formatError);
      return;
    }
    // Sem a confirmação da T2 não há como gravar o perfil: volta para a Maioridade.
    if (!confirmadaEm) {
      router.replace('/maioridade');
      return;
    }
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setBusy(false);
      setError(copy.errors.noNetwork);
      return;
    }
    const { error: dbError } = await supabase.from('otcb_perfis').insert({
      id: auth.user.id,
      apelido: value,
      maioridade_confirmada_em: confirmadaEm,
      time_do_coracao: team.trim() || null,
    });
    setBusy(false);
    if (dbError) {
      const kind = nicknameErrorFromDb(dbError.code);
      setError(kind === 'em_uso' ? copy.nickname.takenError : kind === 'formato' ? copy.nickname.formatError : copy.errors.noNetwork);
      return;
    }
    await rememberProfile(auth.user.id);
    track('otcb_primeiro_acesso');
    router.replace('/localizacao');
  }

  return (
    <Screen footer={<Button testID="salvar-apelido" label={copy.nickname.submit} onPress={() => void save()} loading={busy} />}>
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
        {copy.nickname.title}
      </Text>
      <TextField
        testID="apelido"
        label={copy.nickname.label}
        hint={copy.nickname.hint}
        error={error}
        value={nickname}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={20}
        onChangeText={(text) => {
          setNickname(text);
          setError(null);
        }}
      />
      <TextField testID="time" label={copy.nickname.teamLabel} value={team} maxLength={40} onChangeText={setTeam} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.title, letterSpacing: 0.5, fontSize: 38, lineHeight: 41 },
});
