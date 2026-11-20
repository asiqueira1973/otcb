import { type ComponentRef, forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Mascot } from '../../components/Mascot';
import { fonts, palette } from '../../components/theme';
import { copy } from '../../lib/copy';
import type { Passaporte } from './api';

type Props = { dados: Passaporte };

// Imagem de compartilhar do Passaporte (8.12, selo Divulgador): a Bolacha comemorando, quantos bares carimbados e os
// selos conquistados. Nunca apelido, localização, nomes de bar ou foto; nenhuma marca de cerveja. Cores fixas (não
// segue o tema), capturada no aparelho com react-native-view-shot. Recebe: dados do Passaporte. Devolve: a View.
export const PassportShareCard = forwardRef<ComponentRef<typeof View>, Props>(function PassportShareCard({ dados }, ref) {
  const selos = dados.selos.filter((s) => s.conquistado).map((s) => copy.seals[s.selo] ?? s.selo);
  return (
    <View ref={ref} collapsable={false} style={styles.card} testID="passport-share-card">
      <Text style={styles.brand}>{copy.brand}</Text>
      <Text style={styles.title}>{copy.passport.shareTitle}</Text>
      <Mascot mood="comemora" size={140} />
      <Text style={styles.total}>{copy.passport.stamped(dados.carimbos.length)}</Text>
      {selos.length > 0 ? <Text style={styles.selos}>{selos.map((s) => `★ ${s}`).join('   ')}</Text> : null}
      <Text style={styles.assinatura}>{copy.colarinho.shareTagline}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { width: 360, padding: 24, backgroundColor: palette.white, borderRadius: 20, borderWidth: 3, borderColor: palette.blue, alignItems: 'center', gap: 8 },
  brand: { fontFamily: fonts.title, fontSize: 28, color: palette.red, letterSpacing: 1 },
  title: { fontFamily: fonts.title, fontSize: 26, color: '#14203A', letterSpacing: 0.5 },
  total: { fontFamily: fonts.title, fontSize: 44, lineHeight: 48, color: palette.blue, textAlign: 'center' },
  selos: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 24, color: '#14203A', textAlign: 'center' },
  assinatura: { fontFamily: fonts.bodyBold, fontSize: 14, color: palette.red, marginTop: 8, textAlign: 'center' },
});
