import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { fonts, palette, useTheme } from '../../components/theme';
import { copy } from '../../lib/copy';

// A4: enviando foto ao Colarinhômetro — copo enchendo de chopp até formar o colarinho, até a resposta.
// Com "reduzir movimento", o copo aparece cheio e só pulsa de leve na opacidade. Recebe: nada.
export function Pour() {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const nivel = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    nivel.value = reduceMotion
      ? withRepeat(withSequence(withTiming(0.6, { duration: 600 }), withTiming(1, { duration: 600 })), -1)
      : withRepeat(withSequence(withTiming(1, { duration: 1400 }), withTiming(1, { duration: 400 }), withTiming(0, { duration: 0 })), -1);
  }, [reduceMotion, nivel]);
  const chopp = useAnimatedStyle(() => (reduceMotion ? { height: '78%', opacity: nivel.value } : { height: `${nivel.value * 78}%` }));
  const espuma = useAnimatedStyle(() => (reduceMotion ? { bottom: '78%', opacity: nivel.value } : { bottom: `${nivel.value * 78}%`, opacity: nivel.value > 0.6 ? 1 : 0 }));
  return (
    <View style={styles.wrap} accessible accessibilityLabel={copy.colarinho.sending} accessibilityLiveRegion="polite" testID="enviando-foto">
      <View style={[styles.copo, { borderColor: theme.text }]}>
        <Animated.View style={[styles.chopp, chopp]} />
        <Animated.View style={[styles.espuma, espuma]} />
      </View>
      <Text style={[styles.texto, { color: theme.text }]}>{copy.colarinho.sending}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 16 },
  copo: { width: 90, height: 130, borderWidth: 4, borderTopWidth: 0, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, overflow: 'hidden', justifyContent: 'flex-end' },
  chopp: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: palette.amber },
  espuma: { position: 'absolute', left: 0, right: 0, height: 22, backgroundColor: '#FFFFFF' },
  texto: { fontFamily: fonts.bodyBold, fontSize: 18 },
});
