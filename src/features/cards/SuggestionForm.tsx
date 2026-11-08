import * as Location from 'expo-location';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Button } from '../../components/Button';
import { fonts, useTheme } from '../../components/theme';
import { copy } from '../../lib/copy';
import { getCurrentCoords } from '../../lib/location';
import { track } from '../../lib/telemetry';
import { sugerir } from './api';
import { CardShell } from './CardShell';
import { estadoDaFalha } from './mensagens';
import { useCardSubmit } from './useCardSubmit';

type Props = { chave: string; nome: string | null; endereco: string | null; bairro: string | null; usarLocalizacaoAtual: boolean };

// Coordenadas da sugestão: a posição do momento quando a pessoa está no bar, senão o geocodificador do
// sistema (iOS/Android, sem chave) com endereço + bairro + São Paulo. Devolve: coordenadas ou null.
export async function coordenadasDaSugestao(estouNoBar: boolean, endereco: string, bairro: string) {
  if (estouNoBar) return getCurrentCoords();
  try {
    const r = await Location.geocodeAsync(`${endereco}, ${bairro}, São Paulo, SP`);
    return r[0] ? { latitude: r[0].latitude, longitude: r[0].longitude } : null;
  } catch {
    return null;
  }
}

// Card formulario_sugestao_bar (8.5; 13.2): nome, endereço, bairro, "Estou no bar agora" e "Tem chopp
// Brahma?" (Tem sim / Não sei). "Não sei" não grava nada (decisão do Alexandre, plano 8.5). "Tem sim"
// chama otcb_sugerir_bar: bar a até 80 m com nome parecido não é criado e o card mostra 15.18 (critério 6).
// Recebe: chave e o que o agente pré-preencheu. Devolve: o card.
export function SuggestionForm({ chave, nome, endereco, bairro, usarLocalizacaoAtual }: Props) {
  const theme = useTheme();
  const { estado, enviar } = useCardSubmit(chave);
  const [campos, setCampos] = useState({ nome: nome ?? '', endereco: endereco ?? '', bairro: bairro ?? '' });
  const [estouNoBar, setEstouNoBar] = useState(usarLocalizacaoAtual);
  const [temBrahma, setTemBrahma] = useState<'sim' | 'nao_sei' | null>(null);
  const editavel = estado.fase === 'editando' || estado.fase === 'erro';
  const completo = campos.nome.trim() && campos.endereco.trim() && campos.bairro.trim() && temBrahma;

  function enviarSugestao() {
    void enviar(async () => {
      if (temBrahma === 'nao_sei') return { fase: 'aviso', mensagem: copy.cards.dontKnowNotice };
      const coords = await coordenadasDaSugestao(estouNoBar, campos.endereco.trim(), campos.bairro.trim());
      if (!coords) return { fase: 'erro', mensagem: estouNoBar ? copy.cards.noLocation : copy.cards.addressNotFound };
      const r = await sugerir({ nome: campos.nome.trim(), endereco: campos.endereco.trim(), bairro: campos.bairro.trim(), ...coords });
      if (r.ok) {
        track('otcb_card_registrado', { tipo_card: 'formulario_sugestao_bar' });
        return { fase: 'registrado', mensagem: r.valor.criado ? copy.cards.suggested : copy.cards.alreadyExisted };
      }
      return estadoDaFalha(r.falha);
    });
  }

  const campo = (k: keyof typeof campos, rotulo: string) => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.textMuted }]}>{rotulo}</Text>
      <TextInput
        testID={`sugestao-${k}`}
        value={campos[k]}
        editable={editavel}
        onChangeText={(v) => setCampos((c) => ({ ...c, [k]: v }))}
        accessibilityLabel={rotulo}
        maxLength={k === 'endereco' ? 200 : k === 'nome' ? 120 : 80}
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
      />
    </View>
  );

  return (
    <CardShell testID={`card-sugestao-${chave}`} titulo={copy.cards.suggestionTitle} estado={estado} onRetry={enviarSugestao}>
      {editavel || estado.fase === 'enviando' ? (
        <>
          {campo('nome', copy.cards.barName)}
          {campo('endereco', copy.cards.address)}
          {campo('bairro', copy.cards.neighborhood)}
          <View style={styles.switchRow}>
            <Text style={[styles.body, { color: theme.text }]}>{copy.cards.hereNow}</Text>
            <Switch testID="estou-no-bar" value={estouNoBar} onValueChange={setEstouNoBar} accessibilityLabel={copy.cards.hereNow} />
          </View>
          <Text style={[styles.label, { color: theme.textMuted }]}>{copy.cards.hasBrahmaQuestion}</Text>
          <View style={styles.choices} accessibilityRole="radiogroup">
            {([['sim', copy.cards.yes], ['nao_sei', copy.cards.dontKnow]] as const).map(([valor, rotulo]) => (
              <Pressable
                key={valor}
                testID={`tem-brahma-${valor}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: temBrahma === valor }}
                onPress={() => setTemBrahma(valor)}
                style={[styles.choice, { borderColor: theme.primary, backgroundColor: temBrahma === valor ? theme.primary : 'transparent' }]}
              >
                <Text style={[styles.choiceText, { color: temBrahma === valor ? theme.onPrimary : theme.text }]}>{rotulo}</Text>
              </Pressable>
            ))}
          </View>
          <Button testID="enviar-sugestao" label={copy.cards.suggest} disabled={!completo} loading={estado.fase === 'enviando'} onPress={enviarSugestao} />
        </>
      ) : null}
    </CardShell>
  );
}

const styles = StyleSheet.create({
  field: { gap: 4 },
  label: { fontFamily: fonts.body, fontSize: 14 },
  body: { fontFamily: fonts.body, fontSize: 16 },
  input: { minHeight: 44, borderWidth: 2, borderRadius: 12, paddingHorizontal: 12, fontFamily: fonts.body, fontSize: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  choices: { flexDirection: 'row', gap: 8 },
  choice: { flex: 1, minHeight: 44, borderWidth: 2, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  choiceText: { fontFamily: fonts.bodyBold, fontSize: 15 },
});
