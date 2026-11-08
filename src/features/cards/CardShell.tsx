import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { fonts, palette, useTheme } from '../../components/theme';
import { copy } from '../../lib/copy';
import type { EstadoCard } from './useCardSubmit';

type Props = { titulo: string; estado: EstadoCard; onRetry?: () => void; children: ReactNode; testID?: string };

// Moldura comum dos cards de entrada (16.4: mesmo visual dos cards do chat). Mostra o rodapé do estado:
// registrado com check verde e "pop" (A8, ~400 ms; só opacidade com "reduzir movimento"), aviso, recusado
// (15.7) e erro com "tentar de novo" (15.9). Recebe: título, estado, ação de reenviar e o conteúdo.
export function CardShell({ titulo, estado, onRetry, children, testID }: Props) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const pop = useSharedValue(estado.fase === 'registrado' ? 1 : 0);
  const registrado = estado.fase === 'registrado';

  useEffect(() => {
    if (registrado) pop.value = reduceMotion ? withTiming(1, { duration: 200 }) : withSpring(1, { damping: 8, stiffness: 260 });
  }, [registrado, reduceMotion, pop]);
  const checkStyle = useAnimatedStyle(() => (reduceMotion ? { opacity: pop.value } : { opacity: pop.value, transform: [{ scale: 0.6 + 0.4 * pop.value }] }));

  return (
    <View testID={testID} style={[styles.card, { backgroundColor: theme.card, borderColor: registrado ? palette.confirmed : theme.border }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{titulo}</Text>
      {children}
      {registrado || estado.fase === 'aviso' ? (
        <View style={styles.row} accessibilityLiveRegion="polite">
          {registrado ? (
            <Animated.View style={[styles.check, { backgroundColor: palette.confirmed }, checkStyle]}>
              <Text style={styles.checkMark}>✓</Text>
            </Animated.View>
          ) : null}
          <Text style={[styles.msg, { color: theme.text }]}>{estado.mensagem}</Text>
        </View>
      ) : null}
      {estado.fase === 'recusado' ? <Text accessibilityLiveRegion="polite" style={[styles.msg, { color: theme.error }]}>{estado.mensagem}</Text> : null}
      {estado.fase === 'erro' ? (
        <View style={styles.row}>
          <Text accessibilityLiveRegion="polite" style={[styles.msg, { color: theme.error, flex: 1 }]}>{estado.mensagem}</Text>
          {onRetry ? (
            <Pressable accessibilityRole="button" accessibilityLabel={copy.errors.retry} onPress={onRetry} hitSlop={12} style={styles.retry}>
              <Text style={[styles.retryText, { color: theme.link }]}>{copy.errors.retry}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 2, borderRadius: 14, padding: 14, gap: 10 },
  title: { fontFamily: fonts.title, letterSpacing: 0.5, fontSize: 22, lineHeight: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  check: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#FFFFFF', fontFamily: fonts.bodyBold, fontSize: 16 },
  msg: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, flexShrink: 1 },
  retry: { minHeight: 44, justifyContent: 'center' },
  retryText: { fontFamily: fonts.bodyBold, fontSize: 15 },
});
