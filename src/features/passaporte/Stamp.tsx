import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, palette } from '../../components/theme';
import { copy } from '../../lib/copy';
import { formatShortDate } from '../bares/format';
import type { Carimbo } from './api';

// Carimbo de borracha (16.4): levemente torto, borda dupla com "tinta falhada", nome do bar e data. O ângulo
// vem do id (estável entre aberturas). Tocar abre a Ficha (8.7). Recebe: carimbo e ação. Devolve: o carimbo.
export function Stamp({ carimbo, onPress }: { carimbo: Carimbo; onPress: () => void }) {
  const giro = ((carimbo.carimbo_id.charCodeAt(0) + carimbo.carimbo_id.charCodeAt(1)) % 13) - 6;
  const data = formatShortDate(carimbo.criado_em);
  return (
    <Pressable
      testID={`carimbo-${carimbo.bar_id}`}
      accessibilityRole="button"
      accessibilityLabel={copy.passport.stampLabel(carimbo.nome_bar, data)}
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, { opacity: pressed ? 0.7 : 1, transform: [{ rotate: `${giro}deg` }] }]}
    >
      <View style={styles.borda}>
        <View style={styles.bordaInterna}>
          <Text style={styles.nome} numberOfLines={2}>{carimbo.nome_bar}</Text>
          <View style={styles.falha} />
          <Text style={styles.data}>{data}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '31%', aspectRatio: 1, padding: 4 },
  borda: { flex: 1, borderWidth: 3, borderColor: palette.red, borderRadius: 999, padding: 3, opacity: 0.88 },
  bordaInterna: { flex: 1, borderWidth: 1.5, borderColor: palette.red, borderStyle: 'dashed', borderRadius: 999, alignItems: 'center', justifyContent: 'center', padding: 6 },
  nome: { fontFamily: fonts.title, fontSize: 15, lineHeight: 16, color: palette.red, textAlign: 'center', letterSpacing: 0.5 },
  falha: { width: '60%', height: 2, backgroundColor: palette.red, opacity: 0.5, marginVertical: 3 },
  data: { fontFamily: fonts.bodyBold, fontSize: 11, color: palette.red },
});
