import { StyleSheet, Text, View } from 'react-native';

import { fonts, palette, useTheme } from '../../components/theme';
import { copy } from '../../lib/copy';
import type { BarStatus } from '../chat/types';

const STATUS_COLOR: Record<BarStatus, string> = {
  confirmado: palette.confirmed,
  provavel: palette.probable,
  incerto: palette.unconfirmed,
};

// Pílula de status (16.2 semântica; critério 4 do 8.4: incerto aparece como "a confirmar").
// Recebe: status. Devolve: a pílula colorida com texto (a cor nunca é a única informação, seção 17).
export function StatusPill({ status }: { status: BarStatus }) {
  return (
    <View style={[styles.pill, { backgroundColor: STATUS_COLOR[status] }]}>
      <Text style={[styles.text, { color: '#FFFFFF' }]}>{copy.bar.status[status]}</Text>
    </View>
  );
}

// Pílula de etiqueta (balcão, passa jogo, clássico; 16.4). Recebe: rótulo. Devolve: a pílula neutra.
export function TagPill({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.pill, { borderWidth: 1.5, borderColor: theme.border }]}>
      <Text style={[styles.text, { color: theme.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  text: { fontFamily: fonts.bodyBold, fontSize: 13 },
});
