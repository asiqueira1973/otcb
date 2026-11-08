import { StyleSheet, View } from 'react-native';

import { Button } from '../../components/Button';
import { copy } from '../../lib/copy';
import { track } from '../../lib/telemetry';
import type { Assunto } from '../chat/types';
import { confirmar } from './api';
import { CardShell } from './CardShell';
import { estadoDaFalha } from './mensagens';
import { useCardSubmit } from './useCardSubmit';

type Props = { chave: string; barId: string; assunto: Assunto; pergunta: string };

// Card pergunta_confirmacao (8.5; 13.2): um toque grava a evidência confirmacao_usuario via
// otcb_confirmar_bar (critério 1). Botões da tabela da 8.5: "Tem sim" / "Não tem mais" / "Fechou" para
// Brahma e funcionamento; "Passa" / "Não passa" para jogos. Repetida no dia → 15.8 (critério 2).
// Recebe: chave do card, bar, assunto e a pergunta (montada pelo servidor). Devolve: o card.
export function ConfirmationCard({ chave, barId, assunto, pergunta }: Props) {
  const { estado, enviar } = useCardSubmit(chave);
  const travado = estado.fase !== 'editando' && estado.fase !== 'erro';

  const opcoes: { rotulo: string; assunto: Assunto; sinal: 'positivo' | 'negativo' | 'fechado' }[] =
    assunto === 'transmite_jogos'
      ? [
          { rotulo: copy.cards.shows, assunto, sinal: 'positivo' },
          { rotulo: copy.cards.doesntShow, assunto, sinal: 'negativo' },
        ]
      : [
          { rotulo: copy.cards.yes, assunto: 'tem_brahma', sinal: 'positivo' },
          { rotulo: copy.cards.noMore, assunto: 'tem_brahma', sinal: 'negativo' },
          { rotulo: copy.cards.closed, assunto: 'funcionamento', sinal: 'fechado' },
        ];

  function responder(o: (typeof opcoes)[number]) {
    void enviar(async () => {
      const r = await confirmar(barId, o.assunto, o.sinal);
      if (r.ok) {
        track('otcb_card_registrado', { tipo_card: 'pergunta_confirmacao' });
        return { fase: 'registrado', mensagem: copy.cards.registered };
      }
      return estadoDaFalha(r.falha);
    });
  }

  return (
    <CardShell testID={`card-confirmacao-${chave}`} titulo={pergunta} estado={estado}>
      {travado && estado.fase !== 'enviando' ? null : (
        <View style={styles.buttons}>
          {opcoes.map((o, i) => (
            <View key={o.rotulo} style={styles.button}>
              <Button
                testID={`confirmar-${o.assunto}-${o.sinal}`}
                variant={i === 0 ? 'primary' : 'ghost'}
                label={o.rotulo}
                loading={estado.fase === 'enviando' && i === 0}
                disabled={estado.fase === 'enviando'}
                onPress={() => responder(o)}
              />
            </View>
          ))}
        </View>
      )}
    </CardShell>
  );
}

const styles = StyleSheet.create({
  buttons: { gap: 8 },
  button: {},
});
