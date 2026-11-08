import { useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';

import { Button } from '../../components/Button';
import { fonts, useTheme } from '../../components/theme';
import { copy } from '../../lib/copy';
import { track } from '../../lib/telemetry';
import { denunciar } from './api';
import { CardShell } from './CardShell';
import { estadoDaFalha } from './mensagens';
import { useCardSubmit } from './useCardSubmit';

// Card formulario_denuncia (8.5; 13.2; regra 11.7): motivo opcional; grava em otcb_denuncias (1 por
// opinião; com 3 denúncias o trigger oculta). Recebe: chave e opinião. Devolve: o card.
export function ReportForm({ chave, opiniaoId }: { chave: string; opiniaoId: string }) {
  const theme = useTheme();
  const { estado, enviar } = useCardSubmit(chave);
  const [motivo, setMotivo] = useState('');
  const editavel = estado.fase === 'editando' || estado.fase === 'erro';

  function enviarDenuncia() {
    void enviar(async () => {
      const r = await denunciar(opiniaoId, motivo);
      if (r.ok) {
        track('otcb_card_registrado', { tipo_card: 'formulario_denuncia' });
        return { fase: 'registrado', mensagem: copy.cards.reported };
      }
      return estadoDaFalha(r.falha);
    });
  }

  return (
    <CardShell testID={`card-denuncia-${chave}`} titulo={copy.cards.reportTitle} estado={estado} onRetry={enviarDenuncia}>
      {editavel || estado.fase === 'enviando' ? (
        <>
          <Text style={[styles.label, { color: theme.textMuted }]}>{copy.cards.reason}</Text>
          <TextInput
            testID="denuncia-motivo"
            value={motivo}
            onChangeText={setMotivo}
            maxLength={300}
            multiline
            accessibilityLabel={copy.cards.reason}
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
          />
          <Button testID="enviar-denuncia" label={copy.sheet.report} loading={estado.fase === 'enviando'} onPress={enviarDenuncia} />
        </>
      ) : null}
    </CardShell>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.body, fontSize: 14 },
  input: { minHeight: 64, borderWidth: 2, borderRadius: 12, padding: 12, fontFamily: fonts.body, fontSize: 16, textAlignVertical: 'top' },
});
