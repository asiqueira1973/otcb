import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { Button } from '../src/components/Button';
import { Mascot } from '../src/components/Mascot';
import { Screen } from '../src/components/Screen';
import { fonts, useTheme } from '../src/components/theme';
import { type BootState, resolveBootState } from '../src/features/auth/boot';
import { copy } from '../src/lib/copy';

// Abertura do app (épico 8.1, passos 1 e 6; seção 6).
// Garante a sessão anônima e decide a primeira tela: com perfil → Chat (reabrir com sessão válida
// vai direto ao Chat, inclusive sem rede); sem perfil → Boas-vindas;
// sem rede e sem sessão → copy 15.9 com "Tentar de novo".
// Recebe: nada. Devolve: o redirecionamento ou o estado de carregamento/erro.
export default function Boot() {
  const theme = useTheme();
  const [state, setState] = useState<BootState>('loading');

  useEffect(() => {
    let alive = true;
    void resolveBootState().then((next) => {
      if (alive) setState(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (state === 'chat') return <Redirect href="/chat" />;
  if (state === 'onboarding') return <Redirect href="/boas-vindas" />;

  if (state === 'offline') {
    return (
      <Screen
        footer={
          <Button
            label={copy.errors.retry}
            onPress={() => {
              setState('loading');
              void resolveBootState().then(setState);
            }}
          />
        }
      >
        <Mascot mood="triste" />
        <Text accessibilityRole="alert" style={[styles.message, { color: theme.text }]}>
          {copy.errors.firstOpenNoNetwork}
        </Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ActivityIndicator style={styles.loading} color={theme.primary} size="large" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  message: { fontFamily: fonts.body, fontSize: 18, textAlign: 'center' },
  loading: { flex: 1 },
});
