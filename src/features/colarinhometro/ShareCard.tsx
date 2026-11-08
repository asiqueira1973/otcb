import { type ComponentRef, forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fonts, palette } from '../../components/theme';
import { copy } from '../../lib/copy';
import { notaTexto } from './nota';

type Props = { nomeBar: string | null; nota: number; comentario: string | null };

// Imagem de "Compartilhar" (passo 6 da 8.6; critério 7): só nome do bar, nota e comentário — nunca
// localização, apelido ou foto. É capturada no próprio aparelho (react-native-view-shot).
export const ShareCard = forwardRef<ComponentRef<typeof View>, Props>(function ShareCard({ nomeBar, nota, comentario }, ref) {
  return (
    <View ref={ref} collapsable={false} style={styles.card} testID="share-card">
      <Text style={styles.brand}>{copy.brand}</Text>
      <Text style={styles.title}>{copy.colarinho.title}</Text>
      <Text style={styles.nota}>{notaTexto(nota)}</Text>
      {nomeBar ? <Text style={styles.bar}>{nomeBar}</Text> : null}
      {comentario ? <Text style={styles.comentario}>{comentario}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { width: 360, padding: 24, backgroundColor: palette.white, borderRadius: 20, borderWidth: 3, borderColor: palette.blue, alignItems: 'center', gap: 6 },
  brand: { fontFamily: fonts.title, fontSize: 28, color: palette.red, letterSpacing: 1 },
  title: { fontFamily: fonts.title, fontSize: 22, color: '#14203A', letterSpacing: 0.5 },
  nota: { fontFamily: fonts.title, fontSize: 96, lineHeight: 100, color: palette.blue },
  bar: { fontFamily: fonts.title, fontSize: 26, color: '#14203A', letterSpacing: 0.5, textAlign: 'center' },
  comentario: { fontFamily: fonts.body, fontSize: 17, lineHeight: 23, color: '#14203A', textAlign: 'center' },
});
