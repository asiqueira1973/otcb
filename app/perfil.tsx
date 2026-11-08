import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Alert, StyleSheet, Text, View } from 'react-native';

import { Button } from '../src/components/Button';
import { Mascot } from '../src/components/Mascot';
import { Screen } from '../src/components/Screen';
import { TextField } from '../src/components/TextField';
import { fonts, useTheme } from '../src/components/theme';
import { clearConversation } from '../src/features/chat/api';
import { loadMyProfile, saveMyProfile } from '../src/features/profile/api';
import { deleteMyData } from '../src/features/profile/deleteMyData';
import { copy } from '../src/lib/copy';

// T9 — Perfil (épicos 8.4 e 8.10): apelido e time editáveis (regra 11.7), "Limpar conversa" (6.1),
// Termos de uso, Política de privacidade, aviso 15.20, rodapé 15.12 e "Apagar meus dados" com
// confirmação em duas etapas (15.21; 13.8). Não há "Sair". Recebe: nada. Devolve: a tela.
export default function Profile() {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [nickname, setNickname] = useState('');
  const [team, setTeam] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // 'loading' → 'ready' com os valores atuais; 'offline' sem rede (15.9): salvar fica desligado para não
  // gravar campos vazios.
  const [load, setLoad] = useState<'loading' | 'ready' | 'offline'>('loading');

  useEffect(() => {
    let alive = true;
    void loadMyProfile().then((p) => {
      if (!alive) return;
      if (!p) {
        setLoad('offline');
        return;
      }
      // Não sobrescreve o que a pessoa já digitou enquanto carregava.
      setNickname((atual) => atual || p.nickname);
      setTeam((atual) => atual || p.team);
      setLoad('ready');
    });
    return () => {
      alive = false;
    };
  }, []);

  async function save() {
    if (load !== 'ready' || deleting) return;
    setSaving(true);
    setSaved(false);
    const result = await saveMyProfile(nickname, team);
    setSaving(false);
    if (result === 'ok') setSaved(true);
    else if (result === 'formato') setFieldError(copy.nickname.formatError);
    else if (result === 'em_uso') setFieldError(copy.nickname.takenError);
    else Alert.alert(copy.errors.noNetwork);
  }

  async function clear() {
    if (deleting) return;
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

  // 15.21: etapa 1 é o texto do alerta; etapa 2 é o botão "Apagar tudo". Sucesso → Boas-vindas com
  // identidade nova; falha → nada é descartado e aparece a 15.9.
  // Sucesso: esvazia a pilha antes (o Chat antigo não pode ficar atrás da Boas-vindas: no Android o voltar
  // levaria a identidade nova ao chat sem passar pelos 18+; verifier do 8.10).
  async function runDelete() {
    setDeleting(true);
    AccessibilityInfo.announceForAccessibility(copy.profile.deleting);
    const ok = await deleteMyData();
    setDeleting(false);
    if (ok) {
      if (router.canDismiss()) router.dismissAll();
      router.replace('/boas-vindas');
    } else Alert.alert(copy.errors.noNetwork);
  }

  function confirmDelete() {
    Alert.alert(copy.profile.deleteData, copy.profile.deleteConfirm, [
      { text: copy.profile.cancel, style: 'cancel' },
      { text: copy.profile.deleteAction, style: 'destructive', onPress: () => void runDelete() },
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
      {load === 'offline' ? <Text accessibilityLiveRegion="polite" style={[styles.body, { color: theme.textMuted }]}>{copy.errors.noNetwork}</Text> : null}

      <TextField
        testID="perfil-apelido"
        label={copy.nickname.label}
        hint={copy.nickname.hint}
        error={fieldError}
        value={nickname}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={20}
        onChangeText={(text) => {
          setNickname(text);
          setFieldError(null);
          setSaved(false);
        }}
      />
      <TextField
        testID="perfil-time"
        label={copy.nickname.teamLabel}
        value={team}
        maxLength={40}
        onChangeText={(text) => {
          setTeam(text);
          setSaved(false);
        }}
      />
      <Button testID="salvar-perfil" label={copy.profile.save} loading={saving} disabled={load !== 'ready' || deleting} onPress={() => void save()} />
      {saved ? <Text accessibilityLiveRegion="polite" style={[styles.body, { color: theme.text }]}>{copy.profile.saved}</Text> : null}

      <Button testID="limpar-conversa" variant="ghost" label={copy.profile.clearChat} loading={busy} disabled={deleting} onPress={confirmClear} />
      {done ? <Text accessibilityLiveRegion="polite" style={[styles.body, { color: theme.text }]}>{copy.profile.cleared}</Text> : null}

      <View style={styles.links}>
        <Button testID="abrir-termos" variant="ghost" label={copy.profile.terms} onPress={() => router.push('/termos')} />
        <Button testID="abrir-privacidade" variant="ghost" label={copy.profile.privacy} onPress={() => router.push('/privacidade')} />
      </View>

      <Text style={[styles.body, { color: theme.textMuted }]}>{copy.profile.passportNotice}</Text>

      <Button testID="apagar-dados" variant="ghost" label={copy.profile.deleteData} loading={deleting} onPress={confirmDelete} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.title, letterSpacing: 0.5, fontSize: 36, textAlign: 'center' },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, textAlign: 'center' },
  footer: { fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
  links: { gap: 4 },
});
