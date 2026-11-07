import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from './theme';

type Props = { children: ReactNode; footer?: ReactNode; background?: ReactNode };

// Estrutura de tela do onboarding: fundo do tema, área segura, conteúdo rolável (fonte grande do sistema,
// seção 17) e rodapé fixo para o botão principal. Recebe: conteúdo, rodapé e fundo decorativo opcional.
export function Screen({ children, footer, background }: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {background}
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, gap: 20 },
  footer: { paddingHorizontal: 24, paddingBottom: 12, gap: 12 },
});
