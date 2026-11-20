import * as Haptics from 'expo-haptics';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { Button } from '../../components/Button';
import { fonts, palette, useTheme } from '../../components/theme';
import { copy } from '../../lib/copy';
import type { BlocoEntrada, ResultadoColarinho } from '../chat/types';
import { compartilharImagem } from '../compartilhar/compartilhar';
import { faixaNota, notaTexto } from './nota';
import { ShareCard } from './ShareCard';

type Props = { bloco: ResultadoColarinho; animar: boolean; onCard?: (b: BlocoEntrada) => void };

const PARCIAIS = ['altura', 'cremosidade', 'copo', 'gelado'] as const;

// Texto do motivo sem carimbo (11.4 e 11.12; 15.8). Recebe: bloco. Devolve: o texto ou null.
export function textoDoCarimbo(b: ResultadoColarinho): string {
  if (b.carimbo_novo) return copy.colarinho.newStamp;
  switch (b.motivo_sem_carimbo) {
    case 'sem_bar':
      return copy.colarinho.noBar;
    case 'nao_confirmou':
      return copy.colarinho.notConfirmed;
    case 'ja_tinha':
      return copy.colarinho.alreadyStamped;
    default:
      return copy.colarinho.stampLimit;
  }
}

// Uma barrinha da nota parcial (A5: cresce em sequência). Recebe: rótulo, nota, ordem e se anima.
function Barra({ rotulo, nota, ordem, animar }: { rotulo: string; nota: number; ordem: number; animar: boolean }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const p = useSharedValue(animar && !reduceMotion ? 0 : 1);
  useEffect(() => {
    if (animar && !reduceMotion) p.value = withDelay(150 + ordem * 150, withTiming(1, { duration: 300 }));
  }, [animar, reduceMotion, ordem, p]);
  const estilo = useAnimatedStyle(() => ({ width: `${nota * 10 * p.value}%` }));
  return (
    <View style={styles.barRow} accessible accessibilityLabel={`${rotulo} ${notaTexto(nota)}`}>
      <Text style={[styles.barLabel, { color: theme.text }]}>{rotulo}</Text>
      <View style={[styles.barTrack, { backgroundColor: theme.border }]}>
        <Animated.View style={[styles.barFill, estilo]} />
      </View>
      <Text style={[styles.barValue, { color: theme.text }]}>{notaTexto(nota)}</Text>
    </View>
  );
}

// Card resultado_colarinho (passo 6 da 8.6; 16.4: guardanapo com a nota grande e as quatro parciais).
// A5: a nota sobe de 0 até o valor (~900 ms) e as barrinhas crescem em sequência. A6: carimbo novo "bate"
// com leve tremida e confete âmbar, haptics médio. Com "reduzir movimento", tudo aparece direto.
// Mostra o motivo quando não sai carimbo; "sem bar" oferece sugerir o bar (card do 8.5, "estou no bar").
// "Compartilhar" gera a imagem só com bar, nota e comentário (critério 7). Recebe: bloco, se anima, onCard.
export function ResultCard({ bloco, animar, onCard }: Props) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const anima = animar && !reduceMotion;
  const [mostrada, setMostrada] = useState(anima ? 0 : bloco.nota_colarinho);
  const shareRef = useRef<ComponentRef<typeof View>>(null);
  const carimbo = useSharedValue(anima ? 0 : 1);
  const tremida = useSharedValue(0);

  useEffect(() => {
    if (!anima) return;
    const inicio = Date.now();
    const timer = setInterval(() => {
      const t = Math.min(1, (Date.now() - inicio) / 900);
      setMostrada(Math.round(bloco.nota_colarinho * t * 10) / 10);
      if (t >= 1) clearInterval(timer);
    }, 40);
    if (bloco.carimbo_novo) {
      carimbo.value = withDelay(900, withSpring(1, { damping: 7, stiffness: 220 }));
      tremida.value = withDelay(1000, withSequence(withTiming(6, { duration: 50 }), withTiming(-6, { duration: 50 }), withTiming(0, { duration: 50 })));
      const h = setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 1000);
      return () => {
        clearInterval(timer);
        clearTimeout(h);
      };
    }
    return () => clearInterval(timer);
  }, [anima, bloco.nota_colarinho, bloco.carimbo_novo, carimbo, tremida]);

  const estiloCarimbo = useAnimatedStyle(() => ({
    opacity: carimbo.value,
    transform: [{ scale: 1.8 - 0.8 * carimbo.value }, { rotate: '-12deg' }],
  }));
  const estiloCard = useAnimatedStyle(() => ({ transform: [{ translateX: tremida.value }] }));

  async function compartilhar() {
    await compartilharImagem(shareRef, 'colarinho');
  }

  return (
    <Animated.View testID={`resultado-${bloco.foto_id}`} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, estiloCard]}>
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{copy.colarinho.title}</Text>
      {bloco.nome_bar ? <Text style={[styles.bar, { color: theme.textMuted }]}>{bloco.nome_bar}</Text> : null}
      <Text accessible accessibilityLabel={copy.colarinho.score(notaTexto(bloco.nota_colarinho))} style={[styles.nota, { color: theme.primary }]}>
        {notaTexto(mostrada)}
      </Text>
      <Text style={[styles.faixa, { color: theme.text }]}>{faixaNota(bloco.nota_colarinho)}</Text>
      {PARCIAIS.map((k, i) => (
        <Barra key={k} rotulo={copy.colarinho.partials[k]} nota={bloco[`nota_${k}`]} ordem={i} animar={anima} />
      ))}
      {bloco.comentario_ia ? <Text style={[styles.comentario, { color: theme.text }]}>“{bloco.comentario_ia}”</Text> : null}
      <View style={styles.carimboRow}>
        {bloco.carimbo_novo ? (
          <Animated.View style={[styles.carimbo, { borderColor: palette.red }, estiloCarimbo]} accessibilityElementsHidden>
            <Text style={[styles.carimboText, { color: palette.red }]}>{copy.brand}</Text>
          </Animated.View>
        ) : null}
        {bloco.carimbo_novo && anima ? <Confete /> : null}
        <Text accessibilityLiveRegion="polite" style={[styles.motivo, { color: theme.text }]}>{textoDoCarimbo(bloco)}</Text>
      </View>
      {bloco.motivo_sem_carimbo === 'sem_bar' && onCard ? (
        <Button
          testID="sugerir-bar-foto"
          variant="ghost"
          label={copy.colarinho.suggestBar}
          onPress={() => onCard({ tipo: 'formulario_sugestao_bar', nome: null, endereco: null, bairro: null, usar_localizacao_atual: true })}
        />
      ) : null}
      <Button testID="compartilhar-foto" label={copy.colarinho.share} onPress={() => void compartilhar()} />
      <View style={styles.offscreen} pointerEvents="none">
        <ShareCard ref={shareRef} nomeBar={bloco.nome_bar} nota={bloco.nota_colarinho} comentario={bloco.comentario_ia} />
      </View>
    </Animated.View>
  );
}

// Confete âmbar do carimbo novo (A6, ~1,2 s). Decorativo para o leitor de tela.
function Confete() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: 10 }, (_, i) => <Pedaco key={i} i={i} />)}
    </View>
  );
}

function Pedaco({ i }: { i: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(950, withTiming(1, { duration: 900 }));
  }, [p]);
  const ang = (i / 10) * Math.PI * 2;
  const estilo = useAnimatedStyle(() => ({
    opacity: 1 - p.value,
    transform: [{ translateX: Math.cos(ang) * 70 * p.value }, { translateY: Math.sin(ang) * 50 * p.value - 20 * p.value }],
  }));
  return <Animated.View style={[styles.pedaco, { backgroundColor: i % 2 ? palette.amber : palette.amberDeep }, estilo]} />;
}

const styles = StyleSheet.create({
  card: { borderWidth: 2, borderRadius: 14, padding: 16, gap: 8, borderStyle: 'dashed' },
  title: { fontFamily: fonts.title, fontSize: 24, letterSpacing: 0.5 },
  bar: { fontFamily: fonts.body, fontSize: 15 },
  nota: { fontFamily: fonts.title, fontSize: 72, lineHeight: 76, alignSelf: 'center' },
  faixa: { fontFamily: fonts.title, fontSize: 30, letterSpacing: 0.5, alignSelf: 'center', marginTop: -4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { fontFamily: fonts.body, fontSize: 14, width: 96 },
  barTrack: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5, backgroundColor: palette.amber },
  barValue: { fontFamily: fonts.bodyBold, fontSize: 14, width: 32, textAlign: 'right' },
  comentario: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, fontStyle: 'italic' },
  carimboRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  carimbo: { width: 64, height: 64, borderRadius: 32, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  carimboText: { fontFamily: fonts.title, fontSize: 18 },
  motivo: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 21 },
  pedaco: { position: 'absolute', left: 32, top: 28, width: 8, height: 8, borderRadius: 2 },
  offscreen: { position: 'absolute', left: -10000, top: 0 },
});
