import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { fonts, palette, useTheme } from '../../components/theme';
import { copy } from '../../lib/copy';
import type { Selo } from './api';

// Um selo da 11.11: nome, como se ganha, progresso (Explorador com nível). Não conquistado fica cinza.
// A7 (selo novo): gira de lado e pousa, com brilho, ~1 s, haptics médio; com "reduzir movimento", só opacidade.
// Recebe: selo e se é novo. Devolve: o selo.
export function SealBadge({ selo, novo }: { selo: Selo; novo: boolean }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const giro = useSharedValue(novo && !reduceMotion ? 1 : 0);
  const brilho = useSharedValue(0);
  const opac = useSharedValue(novo && reduceMotion ? 0 : 1);

  useEffect(() => {
    if (!novo) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (reduceMotion) {
      opac.value = withTiming(1, { duration: 200 });
      return;
    }
    giro.value = withSpring(0, { damping: 9, stiffness: 120 });
    brilho.value = withSequence(withTiming(1, { duration: 400 }), withTiming(0, { duration: 600 }));
  }, [novo, reduceMotion, giro, brilho, opac]);

  const medalha = useAnimatedStyle(() => ({
    opacity: opac.value,
    transform: [{ perspective: 400 }, { rotateY: `${giro.value * 540}deg` }, { scale: 1 + brilho.value * 0.15 }],
  }));
  const halo = useAnimatedStyle(() => ({ opacity: brilho.value * 0.8 }));

  const nome = copy.seals[selo.selo] ?? selo.selo;
  const cor = selo.conquistado ? palette.amber : theme.border;
  return (
    <View
      testID={`selo-${selo.selo}`}
      accessible
      accessibilityLabel={`${nome}, ${selo.conquistado ? copy.passport.conquered : copy.passport.progress(selo.progresso, selo.meta)}`}
      style={[styles.row, { borderColor: theme.border, backgroundColor: theme.card }]}
    >
      <View>
        <Animated.View style={[styles.halo, halo]} />
        <Animated.View style={[styles.medalha, { borderColor: cor, backgroundColor: selo.conquistado ? palette.blue : theme.background }, medalha]}>
          <Text style={[styles.icone, { color: selo.conquistado ? palette.amber : theme.textMuted }]}>★</Text>
        </Animated.View>
      </View>
      <View style={styles.texto}>
        <Text style={[styles.nome, { color: selo.conquistado ? theme.text : theme.textMuted }]}>
          {nome}{selo.nivel ? ` · ${copy.passport.level(selo.nivel)}` : ''}
        </Text>
        <Text style={[styles.como, { color: theme.textMuted }]}>{copy.passport.sealHow[selo.selo]}</Text>
      </View>
      <Text style={[styles.progresso, { color: selo.conquistado ? palette.confirmed : theme.textMuted }]}>
        {selo.conquistado && (selo.nivel === undefined || selo.nivel === 3) ? '✓' : copy.passport.progress(Math.min(selo.progresso, selo.meta), selo.meta)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderRadius: 14, padding: 12 },
  halo: { position: 'absolute', left: -8, top: -8, width: 64, height: 64, borderRadius: 32, backgroundColor: palette.amber },
  medalha: { width: 48, height: 48, borderRadius: 24, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  icone: { fontSize: 22 },
  texto: { flex: 1, gap: 2 },
  nome: { fontFamily: fonts.title, fontSize: 20, letterSpacing: 0.5 },
  como: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19 },
  progresso: { fontFamily: fonts.bodyBold, fontSize: 15 },
});
