import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, useTheme } from '../../components/theme';
import { copy } from '../../lib/copy';
import type { CardBar } from '../chat/types';
import { formatDistance, formatScore } from './format';
import { StatusPill, TagPill } from './Pill';

type Props = { bar: CardBar; onOpen: (bar: CardBar) => void; compact?: boolean };

// Etiquetas do bar em pílula (16.4). Recebe: bar. Devolve: rótulos das etiquetas verdadeiras.
export function barTags(bar: Pick<CardBar, 'tem_balcao' | 'transmite_jogos' | 'classico'>): string[] {
  const tags: string[] = [];
  if (bar.tem_balcao) tags.push(copy.bar.counter);
  if (bar.transmite_jogos) tags.push(copy.bar.games);
  if (bar.classico) tags.push(copy.bar.classic);
  return tags;
}

// Card de bar como comanda (16.4; bloco card_bar e itens de lista_bares, 13.2): nome em destaque, pílulas
// de status e etiquetas, nota do colarinho com copo e distância. Tocar abre a Ficha (T6).
// Recebe: bar, ação de abrir e modo compacto (na lista). Devolve: o card acessível.
export function BarCard({ bar, onOpen, compact }: Props) {
  const theme = useTheme();
  const distance = formatDistance(bar.distancia_metros);
  const collar = bar.nota_colarinho_media !== null ? copy.bar.collar(formatScore(bar.nota_colarinho_media)) : copy.bar.noCollar;
  const tags = barTags(bar);
  const a11y = [bar.nome, copy.bar.status[bar.status], bar.bairro, distance, ...tags, collar].filter(Boolean).join(', ');

  return (
    <Pressable
      testID={`card-bar-${bar.bar_id}`}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint={copy.bar.open(bar.nome)}
      onPress={() => onOpen(bar)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
        compact && styles.compact,
      ]}
    >
      <View style={[styles.perforation, { borderColor: theme.border }]} />
      <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>{bar.nome}</Text>
      <Text style={[styles.meta, { color: theme.textMuted }]} numberOfLines={1}>
        {[bar.bairro, distance].filter(Boolean).join(' · ')}
      </Text>
      <View style={styles.pills}>
        <StatusPill status={bar.status} />
        {tags.map((t) => <TagPill key={t} label={t} />)}
      </View>
      <Text style={[styles.collar, { color: theme.text }]}>🍺 {collar}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 2, borderRadius: 14, padding: 14, paddingTop: 18, gap: 6, minHeight: 44 },
  compact: { paddingVertical: 12 },
  perforation: { position: 'absolute', top: 8, left: 14, right: 14, borderTopWidth: 2, borderStyle: 'dashed' },
  name: { fontFamily: fonts.title, letterSpacing: 0.5, fontSize: 24, lineHeight: 26 },
  meta: { fontFamily: fonts.body, fontSize: 14 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  collar: { fontFamily: fonts.body, fontSize: 14 },
});
