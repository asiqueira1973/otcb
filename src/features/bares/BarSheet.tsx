import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../../components/Button';
import { fonts, useTheme } from '../../components/theme';
import { copy } from '../../lib/copy';
import { track } from '../../lib/telemetry';
import type { CardBar } from '../chat/types';
import { fetchBar, fetchOpinions, type Opiniao } from './api';
import { barTags } from './BarCard';
import { formatDistance, formatScore, formatShortDate } from './format';
import { openDirections } from './links';
import { StatusPill, TagPill } from './Pill';

type SheetApi = { openBar: (bar: CardBar | string) => void };
const SheetContext = createContext<SheetApi>({ openBar: () => undefined });

// Abre a Ficha de qualquer card do chat. Devolve: { openBar } (aceita o CardBar ou só o id).
export function useBarSheet(): SheetApi {
  return useContext(SheetContext);
}

// Provedor da Ficha (T6). Guarda o bar aberto e carrega os detalhes quando só o id é conhecido (mapa, ação).
// Recebe: filhos. Devolve: filhos + o bottom sheet.
export function BarSheetProvider({ children }: { children: ReactNode }) {
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

  const api = useMemo(() => ({ openBar }), [openBar]);
  return (
    <SheetContext.Provider value={api}>
      {children}
      <BarSheet visible={visible} bar={bar} failed={failed} onClose={() => setVisible(false)} />
    </SheetContext.Provider>
  );
}

type Props = { visible: boolean; bar: CardBar | null; failed: boolean; onClose: () => void };

// Ficha do bar (T6) em bottom sheet que sobe com mola (A10, ~300 ms; com "reduzir movimento", só opacidade).
// Mostra nome, bairro, endereço, status, etiquetas, nota do colarinho, última confirmação, resumo e opiniões
// (15.16 quando vazio), com "Como chegar" e "Chamar Uber". Dar opinião / Tem Brahma? / Denunciar: épico 8.5.
// Recebe: visibilidade, bar, falha e fechar. Devolve: o modal.
export function BarSheet({ visible, bar, failed, onClose }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  // Opiniões guardadas com o id do bar: enquanto o id não bate com o aberto, a lista está carregando.
  const [loadedOpinions, setLoadedOpinions] = useState<{ barId: string; list: Opiniao[] } | null>(null);

  useEffect(() => {
    progress.value = visible
      ? reduceMotion ? withTiming(1, { duration: 200 }) : withSpring(1, { damping: 18, stiffness: 180 })
      : 0;
  }, [visible, reduceMotion, progress]);

  const barId = bar?.bar_id;
  useEffect(() => {
    if (!barId) return;
    let alive = true;
    fetchOpinions(barId)
      .then((list) => alive && setLoadedOpinions({ barId, list }))
      .catch(() => alive && setLoadedOpinions({ barId, list: [] }));
    return () => {
      alive = false;
    };
  }, [barId]);

  const opinions = loadedOpinions && loadedOpinions.barId === barId ? loadedOpinions.list : null;

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
              🍺 {bar.nota_colarinho_media !== null ? copy.bar.collar(formatScore(bar.nota_colarinho_media)) : copy.bar.noCollar}
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
            {bar.resumo_opinioes ? (
              <>
                <Text accessibilityRole="header" style={[styles.section, { color: theme.text }]}>{copy.sheet.summary}</Text>
                <Text style={[styles.body, { color: theme.text }]}>{bar.resumo_opinioes}</Text>
              </>
            ) : null}
            <Text accessibilityRole="header" style={[styles.section, { color: theme.text }]}>{copy.sheet.opinions}</Text>
            {opinions === null ? (
              <ActivityIndicator color={theme.primary} />
            ) : opinions.length === 0 ? (
              <Text style={[styles.body, { color: theme.textMuted }]}>{copy.sheet.noOpinions}</Text>
            ) : (
              opinions.map((o) => (
                <View key={o.opiniao_id} style={[styles.opinion, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={[styles.opinionHead, { color: theme.text }]}>
                    {o.apelido}{o.nota !== null ? ` · ${'★'.repeat(o.nota)}` : ''} · {formatShortDate(o.criado_em)}
                  </Text>
                  <Text style={[styles.body, { color: theme.text }]}>{o.texto}</Text>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10 },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginBottom: 8 },
  content: { paddingHorizontal: 20, gap: 10, paddingBottom: 12 },
  title: { fontFamily: fonts.title, fontSize: 28, lineHeight: 34 },
  section: { fontFamily: fonts.title, fontSize: 20, marginTop: 8 },
  meta: { fontFamily: fonts.body, fontSize: 15 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  action: { flex: 1 },
  opinion: { borderWidth: 1.5, borderRadius: 12, padding: 12, gap: 4 },
  opinionHead: { fontFamily: fonts.bodyBold, fontSize: 14 },
});
