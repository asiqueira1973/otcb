import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Mascot } from '../../components/Mascot';
import { fonts, useTheme } from '../../components/theme';
import { copy } from '../../lib/copy';
import { Blocks } from './Blocks';
import { Entering } from './Entering';
import type { ChatMessage } from './types';

type Props = { message: ChatMessage; animate: boolean; onRetry: (id: string) => void };

// Uma mensagem do chat (T5; 16.4: bolhas arredondadas, o assistente fala com a Bolacha ao lado — A9).
// Mensagem do usuário não enviada mostra o erro da 15.9 e "Tentar de novo". Entra com A2.
// Recebe: mensagem, se anima e a ação de reenviar. Devolve: a linha.
export function MessageRow({ message, animate, onRetry }: Props) {
  const theme = useTheme();
  const mine = message.papel === 'usuario';
  const failed = message.estado === 'nao_enviada';

  if (mine) {
    return (
      <Entering animate={animate} style={styles.mineWrap}>
        <View
          style={[styles.bubble, styles.mine, { backgroundColor: theme.primary, opacity: message.estado === 'enviando' ? 0.85 : 1 }]}
        >
          <Text style={[styles.text, { color: theme.onPrimary }]}>{message.conteudo}</Text>
        </View>
        {failed ? (
          <View style={styles.failRow} testID={`nao-enviada-${message.id}`}>
            <Mascot mood="triste" size={32} />
            <Text style={[styles.failText, { color: theme.error }]}>
              {copy.chat.notSent} · {message.motivo === 'sem_rede' ? copy.errors.noNetwork : copy.errors.aiDown}
            </Text>
            <Pressable
              testID={`tentar-de-novo-${message.id}`}
              accessibilityRole="button"
              accessibilityLabel={copy.errors.retry}
              onPress={() => onRetry(message.id)}
              hitSlop={12}
              style={styles.retry}
            >
              <Text style={[styles.retryText, { color: theme.accent }]}>{copy.errors.retry}</Text>
            </Pressable>
          </View>
        ) : null}
      </Entering>
    );
  }

  return (
    <Entering animate={animate} style={styles.theirsWrap}>
      <View style={styles.avatar}>
        <Mascot mood={message.erro ? 'triste' : 'feliz'} size={40} />
      </View>
      <View style={styles.theirsCol}>
        {message.conteudo ? (
          <View style={[styles.bubble, styles.theirs, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.text, { color: theme.text }]}>{message.conteudo.replace(/\*\*(.+?)\*\*/g, '$1')}</Text>
          </View>
        ) : null}
        {message.blocos.length > 0 ? <Blocks blocos={message.blocos} /> : null}
      </View>
    </Entering>
  );
}

const styles = StyleSheet.create({
  mineWrap: { alignItems: 'flex-end', gap: 4 },
  theirsWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  theirsCol: { flex: 1, gap: 10 },
  avatar: { width: 40, paddingTop: 2 },
  bubble: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, maxWidth: '88%' },
  mine: { borderBottomRightRadius: 6 },
  theirs: { borderWidth: 2, borderTopLeftRadius: 6, alignSelf: 'flex-start', maxWidth: '100%' },
  text: { fontFamily: fonts.body, fontSize: 17, lineHeight: 24 },
  failRow: { alignItems: 'flex-end', gap: 2, maxWidth: '88%' },
  failText: { fontFamily: fonts.body, fontSize: 13, textAlign: 'right' },
  retry: { minHeight: 32, justifyContent: 'center' },
  retryText: { fontFamily: fonts.bodyBold, fontSize: 15 },
});
