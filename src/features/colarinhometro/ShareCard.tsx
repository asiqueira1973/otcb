import { type ComponentRef, forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fonts, palette } from '../../components/theme';
import { copy } from '../../lib/copy';
import { faixaNota, notaTexto } from './nota';

type Props = { nomeBar: string | null; nota: number; comentario: string | null };

// Imagem de "Compartilhar" (passo 6 da 8.6; critério 7): só nome do bar, nota e comentário — nunca
// localização, apelido ou foto. É capturada no próprio aparelho (react-native-view-shot). 8.12: a faixa da nota em
// destaque e a assinatura do app; nenhuma marca de cerveja na imagem.
export const ShareCard = forwardRef<ComponentRef<typeof View>, Props>(function ShareCard({ nomeBar, nota, comentario }, ref) {
  return (
    <View ref={ref} collapsable={false} style={styles.card} testID="share-card">
      <Text style={styles.brand}>{copy.brand}</Text>
      <Text style={styles.title}>{copy.colarinho.title}</Text>
      <Text style={styles.faixa}>{faixaNota(nota)}</Text>
      <Text style={styles.nota}>{notaTexto(nota)}</Text>
      {nomeBar ? <Text style={styles.bar}>{nomeBar}</Text> : null}
      {comentario ? <Text style={styles.comentario}>{comentario}</Text> : null}
      <Text style={styles.assinatura}>{copy.colarinho.shareTagline}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { width: 360, padding: 24, backgroundColor: palette.white, borderRadius: 20, borderWidth: 3, borderColor: palette.blue, alignItems: 'center', gap: 6 },
  brand: { fontFamily: fonts.title, fontSize: 28, color: palette.red, letterSpacing: 1 },
  title: { fontFamily: fonts.title, fontSize: 22, color: '#14203A', letterSpacing: 0.5 },
  faixa: { fontFamily: fonts.title, fontSize: 40, lineHeight: 44, color: palette.blue, letterSpacing: 0.5, textAlign: 'center' },
  nota: { fontFamily: fonts.title, fontSize: 64, lineHeight: 68, color: palette.blue },
  bar: { fontFamily: fonts.title, fontSize: 26, color: '#14203A', letterSpacing: 0.5, textAlign: 'center' },
  comentario: { fontFamily: fonts.body, fontSize: 17, lineHeight: 23, color: '#14203A', textAlign: 'center' },
  assinatura: { fontFamily: fonts.bodyBold, fontSize: 14, color: palette.red, marginTop: 8, textAlign: 'center' },
});
