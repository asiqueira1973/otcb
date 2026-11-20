import { router } from 'expo-router';
import { type ComponentRef, useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../src/components/Button';
import { Mascot } from '../src/components/Mascot';
import { fonts, palette, useTheme } from '../src/components/theme';
import { BarSheetProvider, useBarSheet } from '../src/features/bares/BarSheet';
import { guardarLocal } from '../src/features/chat/localMessages';
import type { BlocoEntrada } from '../src/features/chat/types';
import { compartilharImagem } from '../src/features/compartilhar/compartilhar';
import { carregarPassaporte, type Passaporte as Dados, selosNovos } from '../src/features/passaporte/api';
import { PassportShareCard } from '../src/features/passaporte/PassportShareCard';
import { SealBadge } from '../src/features/passaporte/SealBadge';
import { Stamp } from '../src/features/passaporte/Stamp';
import { copy } from '../src/lib/copy';

// T8 — Passaporte do Chopp (épico 8.7; regra 11.11). Mostra só o que otcb_meu_passaporte devolve: bares
// carimbados, grade de carimbos (tocar abre a Ficha), coleções por bairro, Clássicos (só com curadoria, 25.5)
// e selos (A7 no selo novo). Puxar para atualizar mostra a Bolacha girando (A11). Vazio → 15.5. Nenhum número
// conta chopp ou fotos (princípio 3). Sem rede, mostra o último carregado. 8.12: "Compartilhar" gera a imagem do
// Passaporte, registra o compartilhamento (selo Divulgador) e recarrega para animar o selo. Recebe: nada. Devolve: a tela.
export default function PassaporteScreen() {
  // Cards da Ficha aberta daqui (Dar opinião, Tem Brahma?) voltam para o chat, guardados no aparelho.
  const onCard = useCallback((b: BlocoEntrada) => {
    void guardarLocal({ id: `card-${Date.now()}`, papel: 'assistente', conteudo: '', blocos: [b], criado_em: new Date().toISOString() }).then(() =>
      router.back(),
    );
  }, []);
  return (
    <BarSheetProvider onCard={onCard}>
      <Conteudo />
    </BarSheetProvider>
  );
}

// Conteúdo do Passaporte (precisa ficar dentro do BarSheetProvider para abrir a Ficha pelo carimbo). Carrega
// os dados, detecta selo novo e mostra vazio, erro sem rede (15.9) ou a coleção. Recebe: nada.
function Conteudo() {
  const theme = useTheme();
  const { openBar } = useBarSheet();
  const [dados, setDados] = useState<Dados | null>(null);
  const [doCache, setDoCache] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [novos, setNovos] = useState<string[]>([]);
  const [falhou, setFalhou] = useState(false);
  const shareRef = useRef<ComponentRef<typeof View>>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const r = await carregarPassaporte();
    setFalhou(!r);
    if (r) {
      setDados(r.dados);
      setDoCache(r.doCache);
      if (!r.doCache) setNovos(await selosNovos(r.dados.selos));
    }
    setCarregando(false);
  }, []);

  // Compartilhar (8.12): na volta da folha do sistema, recarrega para o selo Divulgador aparecer e animar (A7).
  const compartilhar = useCallback(async () => {
    if (await compartilharImagem(shareRef, 'passaporte')) await carregar();
  }, [carregar]);

  useEffect(() => {
    void carregar(); // eslint-disable-line react-hooks/set-state-in-effect -- carga inicial da tela
  }, [carregar]);

  // 11.11: todos os bairros com bares ativos; conquistados e com progresso primeiro.
  const bairros = [...(dados?.colecoes_bairro ?? [])]
    .sort((a, b) => Number(b.conquistado) - Number(a.conquistado) || b.carimbos / b.total_bares - a.carimbos / a.total_bares);
  const vazio = !!dados && dados.carimbos.length === 0;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.titulo, { color: theme.accent }]}>{copy.passport.title}</Text>
        <Button testID="voltar-passaporte" variant="ghost" label={copy.passport.back} onPress={() => router.back()} />
      </View>
      {carregando && !dados ? <Girando /> : null}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => void carregar()} tintColor="transparent" colors={['transparent']} />}
      >
        {carregando && dados ? <Girando /> : null}
        {doCache ? <Text style={[styles.aviso, { color: theme.textMuted }]}>{copy.passport.offline}</Text> : null}
        {falhou && !dados && !carregando ? (
          <View style={styles.vazio} testID="passaporte-erro">
            <Mascot mood="triste" size={120} />
            <Text style={[styles.corpo, { color: theme.text }]}>{copy.errors.noNetwork}</Text>
            <Button testID="passaporte-tentar" label={copy.errors.retry} onPress={() => void carregar()} />
          </View>
        ) : null}
        {vazio ? (
          <View style={styles.vazio} testID="passaporte-vazio">
            <Mascot mood="gentil" size={140} />
            <Text style={[styles.corpo, { color: theme.text }]}>{copy.passport.empty}</Text>
            <Button testID="abrir-colarinhometro" label={copy.passport.openCamera} onPress={() => router.push('/camera')} />
          </View>
        ) : null}
        {dados && !vazio ? (
          <>
            <Text testID="total-carimbados" style={[styles.total, { color: theme.text }]}>{copy.passport.stamped(dados.carimbos.length)}</Text>
            <Button testID="compartilhar-passaporte" label={copy.passport.share} onPress={() => void compartilhar()} />
            {/* Imagem de compartilhar fora da tela, escondida do leitor de tela. */}
            <View style={styles.offscreen} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <PassportShareCard ref={shareRef} dados={dados} />
            </View>

            <Text accessibilityRole="header" style={[styles.secao, { color: theme.text }]}>{copy.passport.stamps}</Text>
            <View style={styles.grade}>
              {dados.carimbos.map((c) => <Stamp key={c.carimbo_id} carimbo={c} onPress={() => openBar(c.bar_id)} />)}
            </View>

            {/* Selos antes dos bairros (pedido do Alexandre, 13/11/2026). */}
            <Text accessibilityRole="header" style={[styles.secao, { color: theme.text }]}>{copy.passport.seals}</Text>
            {novos.length > 0 ? (
              <Text accessibilityLiveRegion="polite" style={[styles.novo, { color: palette.confirmed }]}>
                {novos.map((s) => copy.passport.newSeal(copy.seals[s] ?? s)).join(' ')}
              </Text>
            ) : null}
            {dados.selos.map((s) => <SealBadge key={s.selo} selo={s} novo={novos.includes(s.selo)} />)}

            <Text accessibilityRole="header" style={[styles.secao, { color: theme.text }]}>{copy.passport.neighborhoods}</Text>
            {bairros.map((c) => (
              <View key={c.bairro} testID={`bairro-${c.bairro}`} accessible accessibilityLabel={copy.passport.neighborhoodLabel(c.bairro, c.carimbos, c.total_bares)} style={styles.colecao}>
                <View style={styles.colecaoTopo}>
                  <Text style={[styles.colecaoNome, { color: theme.text }]}>{c.bairro}</Text>
                  <Text style={[styles.colecaoNum, { color: c.conquistado ? palette.confirmed : theme.textMuted }]}>
                    {c.conquistado ? `✓ ${copy.passport.conquered}` : copy.passport.progress(c.carimbos, c.total_bares)}
                  </Text>
                </View>
                <View style={[styles.trilho, { backgroundColor: theme.border }]}>
                  <View style={[styles.preenchido, { width: `${Math.min(100, (c.carimbos / Math.max(1, c.total_bares)) * 100)}%`, backgroundColor: c.conquistado ? palette.confirmed : theme.primary }]} />
                </View>
              </View>
            ))}

            {dados.colecao_classicos.total > 0 ? (
              <View testID="colecao-classicos" style={styles.colecao}>
                <Text accessibilityRole="header" style={[styles.secao, { color: theme.text }]}>{copy.passport.classics}</Text>
                <Text style={[styles.colecaoNum, { color: theme.textMuted }]}>{copy.passport.progress(dados.colecao_classicos.carimbos, dados.colecao_classicos.total)}</Text>
              </View>
            ) : null}

          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// A11: Bolacha girando enquanto o Passaporte carrega; com "reduzir movimento", parada.
function Girando() {
  const reduceMotion = useReducedMotion();
  const giro = useSharedValue(0);
  useEffect(() => {
    if (!reduceMotion) giro.value = withRepeat(withTiming(1, { duration: 900 }), -1, false);
    return () => cancelAnimation(giro);
  }, [reduceMotion, giro]);
  const estilo = useAnimatedStyle(() => ({ transform: [{ rotate: `${giro.value * 360}deg` }] }));
  return (
    <Animated.View testID="passaporte-carregando" style={[styles.girando, estilo]}>
      <Mascot mood="feliz" size={56} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, gap: 12 },
  titulo: { fontFamily: fonts.title, fontSize: 40, letterSpacing: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  aviso: { fontFamily: fonts.body, fontSize: 14 },
  vazio: { alignItems: 'center', gap: 20, paddingTop: 40 },
  corpo: { fontFamily: fonts.body, fontSize: 18, lineHeight: 26, textAlign: 'center' },
  total: { fontFamily: fonts.title, fontSize: 34, letterSpacing: 0.5 },
  secao: { fontFamily: fonts.title, fontSize: 26, letterSpacing: 0.5, marginTop: 12 },
  grade: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: 4 },
  colecao: { gap: 6 },
  colecaoTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  colecaoNome: { fontFamily: fonts.bodyBold, fontSize: 16 },
  colecaoNum: { fontFamily: fonts.bodyBold, fontSize: 14 },
  trilho: { height: 10, borderRadius: 5, overflow: 'hidden' },
  preenchido: { height: 10, borderRadius: 5 },
  novo: { fontFamily: fonts.bodyBold, fontSize: 16 },
  girando: { alignSelf: 'center', marginVertical: 8 },
  offscreen: { position: 'absolute', left: -10000, top: 0 },
});
