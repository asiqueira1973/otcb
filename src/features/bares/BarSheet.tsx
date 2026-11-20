import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../../components/Button';
import { fonts, useTheme } from '../../components/theme';
import { copy } from '../../lib/copy';
import { track } from '../../lib/telemetry';
import { minhaOpiniao, type MinhaOpiniao } from '../cards/api';
import type { BlocoEntrada, CardBar } from '../chat/types';
import { apelidoProprio, fetchBar, fetchOpinions, type Opiniao } from './api';
import { barTags } from './BarCard';
import { formatCollar, formatDistance, formatShortDate } from './format';
import { openDirections } from './links';
import { StatusPill, TagPill } from './Pill';

type SheetApi = { openBar: (bar: CardBar | string) => void; onCard?: (b: BlocoEntrada) => void };
const SheetContext = createContext<SheetApi>({ openBar: () => undefined });

// Abre a Ficha de qualquer card do chat e põe cards de entrada no chat. Devolve: { openBar, onCard }.
export function useBarSheet(): SheetApi {
  return useContext(SheetContext);
}

// Provedor da Ficha (T6). Guarda o bar aberto e carrega os detalhes quando só o id é conhecido (mapa, ação).
// Recebe: filhos. Devolve: filhos + o bottom sheet.
export function BarSheetProvider({ children, onCard }: { children: ReactNode; onCard?: (b: BlocoEntrada) => void }) {
  const [bar, setBar] = useState<CardBar | null>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  const openBar = useCallback((b: CardBar | string) => {
    setFailed(false);
    setVisible(true);
    if (typeof b === 'string') {
      setBar(null);
      void fetchBar(b).then((full) => {
        if (full) {
          setBar(full);
          track('otcb_ficha_aberta', { status_bar: full.status });
        } else setFailed(true);
      });
    } else {
      setBar(b);
      track('otcb_ficha_aberta', { status_bar: b.status });
    }
  }, []);

  const api = useMemo(() => ({ openBar, onCard }), [openBar, onCard]);
  return (
    <SheetContext.Provider value={api}>
      {children}
      <BarSheet
        visible={visible}
        bar={bar}
        failed={failed}
        onClose={() => setVisible(false)}
        onCard={onCard ? (b) => { setVisible(false); onCard(b); } : undefined}
      />
    </SheetContext.Provider>
  );
}

type Props = { visible: boolean; bar: CardBar | null; failed: boolean; onClose: () => void; onCard?: (b: BlocoEntrada) => void };

// Ficha do bar (T6) em bottom sheet que sobe com mola (A10, ~300 ms; com "reduzir movimento", só opacidade).
// Mostra nome, bairro, endereço, status, etiquetas, nota do colarinho, última confirmação, resumo e opiniões
// (15.16 quando vazio; 10 por página com "Ver mais", 8.8; a própria opinião à parte, mesmo oculta, com a 15.17),
// com "Como chegar" e "Chamar Uber". "Dar opinião" (já preenchido com a opinião atual,
// critério 5), "Tem Brahma?" e "Denunciar" (menos na própria opinião) fecham a ficha e abrem o card no chat (8.5).
// Recebe: visibilidade, bar, falha e fechar. Devolve: o modal.
export function BarSheet({ visible, bar, failed, onClose, onCard }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  // Opiniões guardadas com o id do bar: enquanto o id não bate com o aberto, a lista está carregando.
  // 8.8: 10 por página ("Ver mais") e a opinião da própria pessoa à parte, de qualquer status.
  const [loadedOpinions, setLoadedOpinions] = useState<
    { barId: string; list: Opiniao[]; pagina: number; temMais: boolean; propria: MinhaOpiniao | null } | null
  >(null);

  useEffect(() => {
    progress.value = visible
      ? reduceMotion ? withTiming(1, { duration: 200 }) : withSpring(1, { damping: 18, stiffness: 180 })
      : 0;
  }, [visible, reduceMotion, progress]);

  const barId = bar?.bar_id;
  useEffect(() => {
    if (!barId) return;
    let alive = true;
    Promise.all([fetchOpinions(barId, 0).catch(() => [] as Opiniao[]), onCard ? minhaOpiniao(barId).catch(() => null) : Promise.resolve(null)])
      .then(([list, propria]) => alive && setLoadedOpinions({ barId, list, pagina: 0, temMais: list.length === 10, propria }));
    return () => {
      alive = false;
    };
  }, [barId, onCard]);

  const atual = loadedOpinions && loadedOpinions.barId === barId ? loadedOpinions : null;
  const propria = atual?.propria ?? null;
  // A própria aparece à parte (sem "Denunciar"); fora dela, a lista pública (só publicadas, otcb_opinioes_do_bar).
  const opinions = atual ? atual.list.filter((o) => o.opiniao_id !== propria?.id) : null;
  // Também pelo apelido (problema 5 do verifier no 8.5): nunca oferecer "Denunciar" na própria opinião.
  const [meuApelido, setMeuApelido] = useState<string | null>(null);
  useEffect(() => {
    if (onCard && visible && meuApelido === null) void apelidoProprio().then(setMeuApelido);
  }, [onCard, visible, meuApelido]);

  // "Ver mais" (8.8): busca a próxima página de 10, uma de cada vez (toque duplo não repete a página).
  const [carregandoMais, setCarregandoMais] = useState(false);
  async function verMais() {
    if (!atual || !barId || carregandoMais) return;
    setCarregandoMais(true);
    const pagina = atual.pagina + 1;
    const mais = await fetchOpinions(barId, pagina).catch(() => [] as Opiniao[]);
    setLoadedOpinions({ ...atual, list: [...atual.list, ...mais], pagina, temMais: mais.length === 10 });
    setCarregandoMais(false);
  }

  async function darOpiniao(b: CardBar) {
    const atual = await minhaOpiniao(b.bar_id).catch(() => null);
    onCard?.({ tipo: 'formulario_opiniao', bar_id: b.bar_id, nome_bar: b.nome, texto_atual: atual?.texto ?? null, nota_atual: atual?.nota ?? null });
  }

  const sheetStyle = useAnimatedStyle(() =>
    reduceMotion ? { opacity: progress.value } : { transform: [{ translateY: (1 - progress.value) * 600 }] },
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={copy.sheet.close} />
      <Animated.View
        testID="ficha-bar"
        style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + 16 }, sheetStyle]}
      >
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        {/* Botão Fechar (relato do Alexandre, 13/11/2026: a Ficha só fechava tocando fora dela). */}
        <Pressable
          testID="ficha-fechar"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={copy.sheet.close}
          hitSlop={12}
          style={styles.fechar}
        >
          <Text style={[styles.fecharTexto, { color: theme.textMuted }]}>✕</Text>
        </Pressable>
        {!bar ? (
          failed ? (
            <Text style={[styles.body, { color: theme.text }]}>{copy.sheet.loadError}</Text>
          ) : (
            <ActivityIndicator color={theme.primary} style={{ marginVertical: 40 }} />
          )
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{bar.nome}</Text>
            <Text style={[styles.meta, { color: theme.textMuted }]}>
              {[bar.bairro, formatDistance(bar.distancia_metros)].filter(Boolean).join(' · ')}
            </Text>
            <Text style={[styles.body, { color: theme.text }]}>{bar.endereco}</Text>
            <View style={styles.pills}>
              <StatusPill status={bar.status} />
              {barTags(bar).map((t) => <TagPill key={t} label={t} />)}
            </View>
            <Text style={[styles.body, { color: theme.text }]}>
              🍺 {bar.nota_colarinho_media !== null ? formatCollar(bar.nota_colarinho_media) : copy.bar.noCollar}
            </Text>
            <Text style={[styles.meta, { color: theme.textMuted }]}>
              {bar.ultima_confirmacao_em ? copy.bar.lastConfirmation(formatShortDate(bar.ultima_confirmacao_em)) : copy.bar.noConfirmation}
            </Text>
            <View style={styles.actions}>
              <View style={styles.action}>
                <Button testID="ficha-rota" label={copy.sheet.route} onPress={() => void openDirections('mapas', bar)} />
              </View>
              <View style={styles.action}>
                <Button testID="ficha-uber" variant="ghost" label={copy.sheet.uber} onPress={() => void openDirections('uber', bar)} />
              </View>
            </View>
            {onCard ? (
              <View style={styles.actions}>
                <View style={styles.action}>
                  <Button testID="ficha-dar-opiniao" variant="ghost" label={copy.sheet.giveOpinion} onPress={() => void darOpiniao(bar)} />
                </View>
                <View style={styles.action}>
                  <Button
                    testID="ficha-tem-brahma"
                    variant="ghost"
                    label={copy.sheet.hasBrahma}
                    onPress={() => onCard({ tipo: 'pergunta_confirmacao', bar_id: bar.bar_id, nome_bar: bar.nome, assunto: 'tem_brahma', pergunta: copy.cards.askHasBrahma(bar.nome) })}
                  />
                </View>
              </View>
            ) : null}
            {bar.resumo_opinioes ? (
              <>
                <Text accessibilityRole="header" style={[styles.section, { color: theme.text }]}>{copy.sheet.summary}</Text>
                <Text style={[styles.body, { color: theme.text }]}>{bar.resumo_opinioes}</Text>
              </>
            ) : null}
            <Text accessibilityRole="header" style={[styles.section, { color: theme.text }]}>{copy.sheet.opinions}</Text>
            {propria ? (
              <View testID="minha-opiniao" style={[styles.opinion, { backgroundColor: theme.card, borderColor: theme.primary }]}>
                <Text style={[styles.opinionHead, { color: theme.text }]}>
                  {copy.sheet.yours}{propria.nota !== null ? ` · ${'★'.repeat(propria.nota)}` : ''} · {formatShortDate(propria.criado_em)}
                </Text>
                {propria.status !== 'publicada' ? (
                  <Text testID="minha-opiniao-oculta" style={[styles.opinionHead, { color: theme.error }]}>{copy.sheet.yoursHidden}</Text>
                ) : null}
                <Text style={[styles.body, { color: theme.text, opacity: propria.status !== 'publicada' ? 0.7 : 1 }]}>{propria.texto}</Text>
              </View>
            ) : null}
            {opinions === null ? (
              <ActivityIndicator color={theme.primary} />
            ) : opinions.length === 0 && !propria ? (
              <Text style={[styles.body, { color: theme.textMuted }]}>{copy.sheet.noOpinions}</Text>
            ) : (
              opinions.map((o) => (
                <View key={o.opiniao_id} style={[styles.opinion, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={[styles.opinionHead, { color: theme.text }]}>
                    {o.apelido}{o.nota !== null ? ` · ${'★'.repeat(o.nota)}` : ''} · {formatShortDate(o.criado_em)}
                  </Text>
                  <Text style={[styles.body, { color: theme.text }]}>{o.texto}</Text>
                  {onCard && o.apelido !== meuApelido ? (
                    <Pressable
                      testID={`denunciar-${o.opiniao_id}`}
                      accessibilityRole="button"
                      accessibilityLabel={copy.sheet.report}
                      onPress={() => onCard({ tipo: 'formulario_denuncia', opiniao_id: o.opiniao_id })}
                      hitSlop={10}
                      style={styles.report}
                    >
                      <Text style={[styles.reportText, { color: theme.textMuted }]}>{copy.sheet.report}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))
            )}
            {atual?.temMais ? (
              <Button testID="ficha-ver-mais" variant="ghost" label={copy.sheet.more} loading={carregandoMais} onPress={() => void verMais()} />
            ) : null}
          </ScrollView>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10 },
  fechar: { position: 'absolute', top: 12, right: 16, zIndex: 2, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  fecharTexto: { fontSize: 22, fontWeight: '600' },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginBottom: 8 },
  content: { paddingHorizontal: 20, gap: 10, paddingBottom: 12 },
  title: { fontFamily: fonts.title, letterSpacing: 0.5, fontSize: 34, lineHeight: 37, paddingRight: 40 },
  section: { fontFamily: fonts.title, letterSpacing: 0.5, fontSize: 24, marginTop: 8 },
  meta: { fontFamily: fonts.body, fontSize: 15 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  action: { flex: 1 },
  opinion: { borderWidth: 1.5, borderRadius: 12, padding: 12, gap: 4 },
  opinionHead: { fontFamily: fonts.bodyBold, fontSize: 14 },
  report: { alignSelf: 'flex-end', minHeight: 32, justifyContent: 'center' },
  reportText: { fontFamily: fonts.bodyBold, fontSize: 13, textDecorationLine: 'underline' },
});
