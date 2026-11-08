import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../../components/Button';
import { fonts, palette, useTheme } from '../../components/theme';
import { copy } from '../../lib/copy';
import { track } from '../../lib/telemetry';
import { opinar } from './api';
import { CardShell } from './CardShell';
import { estadoDaFalha } from './mensagens';
import { useCardSubmit } from './useCardSubmit';

type Props = { chave: string; barId: string; nomeBar: string; textoAtual: string | null; notaAtual: number | null };

// Texto válido da opinião (regra 11.7): 10 a 500 caracteres, sem contar espaços nas pontas.
export function opiniaoValida(texto: string): boolean {
  const n = texto.trim().length;
  return n >= 10 && n <= 500;
}

// Card formulario_opiniao (8.5; 13.2): nota 1–5 opcional e texto 10–500 (critério 3: fora disso o botão
// não habilita). Já vem com a opinião atual quando a pessoa já opinou (critério 5: edição). Grava pela
// otcb-opinioes (moderação 11.7): recusa → 15.7 e nada gravado (critério 4); IA fora → 15.9.
// Recebe: chave, bar e opinião atual. Devolve: o card.
export function OpinionForm({ chave, barId, nomeBar, textoAtual, notaAtual }: Props) {
  const theme = useTheme();
  const { estado, enviar } = useCardSubmit(chave);
  const [texto, setTexto] = useState(textoAtual ?? '');
  const [nota, setNota] = useState<number | null>(notaAtual);
  const editavel = estado.fase === 'editando' || estado.fase === 'erro' || estado.fase === 'recusado';
  const tamanho = texto.trim().length;

  function publicar() {
    void enviar(async () => {
      const r = await opinar(barId, texto.trim(), nota);
      if (r.ok) {
        track('otcb_card_registrado', { tipo_card: 'formulario_opiniao' });
        return { fase: 'registrado', mensagem: copy.cards.published };
      }
      return estadoDaFalha(r.falha);
    });
  }

  return (
    <CardShell testID={`card-opiniao-${chave}`} titulo={copy.cards.opinionTitle(nomeBar)} estado={estado} onRetry={publicar}>
      {editavel || estado.fase === 'enviando' ? (
        <>
          <Text style={[styles.label, { color: theme.textMuted }]}>{copy.cards.ratingLabel}</Text>
          <View style={styles.stars} accessibilityRole="radiogroup">
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                testID={`estrela-${n}`}
                accessibilityRole="radio"
                accessibilityLabel={copy.cards.star(n)}
                accessibilityState={{ selected: nota === n }}
                onPress={() => setNota(nota === n ? null : n)}
                hitSlop={6}
                style={styles.star}
              >
                <Text style={[styles.starText, { color: nota !== null && n <= nota ? palette.amber : theme.border }]}>★</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            testID="opiniao-texto"
            value={texto}
            onChangeText={setTexto}
            multiline
            editable={editavel}
            placeholder={copy.cards.opinionPlaceholder}
            placeholderTextColor={theme.textMuted}
            accessibilityLabel={copy.cards.opinionTitle(nomeBar)}
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
          />
          <Text style={[styles.counter, { color: tamanho > 500 ? theme.error : theme.textMuted }]}>
            {tamanho > 0 && tamanho < 10 ? `${copy.cards.minChars} ` : ''}{copy.cards.counter(tamanho)}
          </Text>
          <Button
            testID="publicar-opiniao"
            label={copy.cards.publish}
            disabled={!opiniaoValida(texto)}
            loading={estado.fase === 'enviando'}
            onPress={publicar}
          />
        </>
      ) : null}
    </CardShell>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.body, fontSize: 14 },
  stars: { flexDirection: 'row', gap: 4 },
  star: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  starText: { fontSize: 30 },
  input: { minHeight: 96, borderWidth: 2, borderRadius: 12, padding: 12, fontFamily: fonts.body, fontSize: 16, textAlignVertical: 'top' },
  counter: { fontFamily: fonts.body, fontSize: 13, textAlign: 'right' },
});
