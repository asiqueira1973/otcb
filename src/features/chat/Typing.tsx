import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { palette, useTheme } from '../../components/theme';
import { copy } from '../../lib/copy';

// Uma bolha de espuma subindo dentro do copo, em loop, com atraso. Recebe: atraso e posição. Devolve: a bolha.
function Bubble({ delay, left }: { delay: number; left: number }) {
  const reduceMotion = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(delay, withRepeat(withTiming(1, { duration: reduceMotion ? 1200 : 900 }), -1, false));
  }, [delay, reduceMotion, y]);
  const style = useAnimatedStyle(() =>
    reduceMotion ? { opacity: 0.4 + 0.6 * y.value } : { opacity: 1 - y.value * 0.7, transform: [{ translateY: -y.value * 26 }] },
  );
  return <Animated.View style={[styles.bubble, { left }, style]} />;
}

// A1: agente "digitando" — três bolhas de espuma subindo dentro de um copinho, em loop (16.6).
// Leitor de tela anuncia "Pensando na resposta…". Recebe: nada. Devolve: o copinho animado.
export function TypingIndicator() {
  const theme = useTheme();
  return (
    <View testID="digitando" accessible accessibilityLabel={copy.chat.typing} accessibilityLiveRegion="polite" style={styles.row}>
      <View style={[styles.glass, { borderColor: theme.text }]}>
        <View style={styles.beer} />
        <View style={styles.foam} />
        <Bubble delay={0} left={6} />
        <Bubble delay={250} left={15} />
        <Bubble delay={500} left={24} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 6, paddingLeft: 8 },
  glass: { width: 36, height: 44, borderWidth: 2.5, borderTopWidth: 0, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, overflow: 'hidden', transform: [{ perspective: 200 }] },
  beer: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 30, backgroundColor: palette.amber },
  foam: { position: 'absolute', left: 0, right: 0, bottom: 30, height: 8, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: palette.amberDeep },
  bubble: { position: 'absolute', bottom: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: palette.foam },
});
