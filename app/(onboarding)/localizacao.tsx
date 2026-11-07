import * as Location from 'expo-location';
import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Button } from '../../src/components/Button';
import { Mascot } from '../../src/components/Mascot';
import { Screen } from '../../src/components/Screen';
import { fonts, useTheme } from '../../src/components/theme';
import { copy } from '../../src/lib/copy';

// T4 — Permissão de localização (épico 8.1, passo 5; copy 15.3; seção 17: só em primeiro plano).
// Permitir ou "Agora não" levam ao Chat; quem nega chega ao Chat mesmo assim (critério do 8.1).
// Recebe: nada. Devolve: a tela com a explicação e os dois botões.
export default function LocationPermission() {
  const theme = useTheme();

  async function allow() {
    try {
      await Location.requestForegroundPermissionsAsync();
    } finally {
      router.replace('/chat');
    }
  }

  return (
    <Screen
      footer={
        <>
          <Button testID="permitir-localizacao" label={copy.location.allow} onPress={() => void allow()} />
          <Button testID="agora-nao" variant="ghost" label={copy.location.notNow} onPress={() => router.replace('/chat')} />
        </>
      }
    >
      <Mascot mood="mapa" size={180} />
      <Text style={[styles.text, { color: theme.text }]}>{copy.location.explain}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  text: { fontFamily: fonts.body, fontSize: 20, lineHeight: 28, textAlign: 'center' },
});
