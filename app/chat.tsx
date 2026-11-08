import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Mascot } from '../src/components/Mascot';
import { fonts, useTheme } from '../src/components/theme';
import { BarSheetProvider } from '../src/features/bares/BarSheet';
import { enviarFila } from '../src/features/colarinhometro/enviar';
import { ouvirResultados } from '../src/features/colarinhometro/resultados';
import { MessageRow } from '../src/features/chat/MessageRow';
import { TypingIndicator } from '../src/features/chat/Typing';
import { useChat } from '../src/features/chat/useChat';
import { copy } from '../src/lib/copy';

// T5 — Chat (épico 8.4; seção 13.1; princípio 2: uma conversa, não um app de telas). Histórico, sugestões
// da 15.4 com o chat vazio, campo 15.13, botão de câmera fixo (Colarinhômetro chega no 8.6) e atalhos para
// Passaporte (8.7) e Perfil. Recebe: nada. Devolve: a tela.
export default function Chat() {
  const theme = useTheme();
  const { messages, typing, loaded, send, retry, reload, addLocalCard, addLocalMessage } = useChat();
  const [text, setText] = useState('');
  const list = useRef<FlatList>(null);
  // Mensagens que já estavam na tela ao carregar não animam; só as novas entram com A2.
  const initialIds = useRef<Set<string> | null>(null);

  // Recarrega ao voltar para a tela (ex.: depois de "Limpar conversa" no Perfil).
  // Na volta à tela também recebe resultados do Colarinhômetro e envia a fila offline de fotos (8.6).
  useFocusEffect(
    useCallback(() => {
      initialIds.current = null;
      ouvirResultados(addLocalMessage);
      void reload().then(() => enviarFila());
      // 12.5: reprocessa a fila a cada minuto enquanto o chat está aberto; e ao voltar ao app (12.4).
      const timer = setInterval(() => void enviarFila(), 60_000);
      const sub = AppState.addEventListener('change', (estado) => {
        if (estado === 'active') void enviarFila();
      });
      return () => {
        ouvirResultados(null);
        clearInterval(timer);
        sub.remove();
      };
    }, [reload, addLocalMessage]),
  );
  useEffect(() => {
    if (loaded && initialIds.current === null) initialIds.current = new Set(messages.map((m) => m.id));
  }, [loaded, messages]);

  function submit(value: string) {
    if (!value.trim() || typing) return;
    setText('');
    void send(value);
  }

  const empty = loaded && messages.length === 0;

  return (
    <BarSheetProvider onCard={addLocalCard}>
      <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[styles.brand, { color: theme.accent }]}>{copy.brand}</Text>
          <View style={styles.shortcuts}>
            <Pressable testID="atalho-passaporte" accessibilityRole="button" accessibilityLabel={copy.chat.passport} onPress={() => router.push('/passaporte')} style={styles.shortcut}>
              <Text style={[styles.shortcutText, { color: theme.link }]}>{copy.chat.passport}</Text>
            </Pressable>
            <Pressable testID="atalho-perfil" accessibilityRole="button" accessibilityLabel={copy.chat.profile} onPress={() => router.push('/perfil')} style={styles.shortcut}>
              <Text style={[styles.shortcutText, { color: theme.link }]}>{copy.chat.profile}</Text>
            </Pressable>
          </View>
        </View>

        <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {empty ? (
            <View style={styles.empty}>
              <Mascot mood="feliz" size={140} />
              <View style={styles.suggestions}>
                {copy.chat.suggestions.map((s) => (
                  <Pressable
                    key={s}
                    testID={`sugestao-${s}`}
                    accessibilityRole="button"
                    accessibilityLabel={s}
                    onPress={() => submit(s)}
                    style={[styles.chip, { borderColor: theme.primary, backgroundColor: theme.card }]}
                  >
                    <Text style={[styles.chipText, { color: theme.text }]}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <FlatList
              ref={list}
              data={messages}
              keyExtractor={(m) => m.id}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
              renderItem={({ item }) => (
                <MessageRow message={item} animate={!!initialIds.current && !initialIds.current.has(item.id)} onRetry={(id) => void retry(id)} />
              )}
              ListFooterComponent={typing ? <TypingIndicator /> : undefined}
            />
          )}

          <View style={[styles.inputRow, { borderTopColor: theme.border }]}>
            <Pressable
              testID="botao-camera"
              accessibilityRole="button"
              accessibilityLabel={copy.chat.camera}
              onPress={() => router.push('/camera')}
              style={[styles.round, styles.camera, { backgroundColor: theme.card, borderColor: theme.primary }]}
            >
              <Text style={styles.roundIcon}>📷</Text>
            </Pressable>
            <TextInput
              testID="campo-chat"
              value={text}
              onChangeText={setText}
              placeholder={copy.chat.inputPlaceholder}
              placeholderTextColor={theme.textMuted}
              accessibilityLabel={copy.chat.inputPlaceholder}
              maxLength={1000}
              multiline
              onSubmitEditing={() => submit(text)}
              style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            />
            <Pressable
              testID="enviar"
              accessibilityRole="button"
              accessibilityLabel={copy.chat.send}
              accessibilityState={{ disabled: !text.trim() || typing }}
              disabled={!text.trim() || typing}
              onPress={() => submit(text)}
              style={[styles.round, { backgroundColor: theme.primary, opacity: !text.trim() || typing ? 0.5 : 1 }]}
            >
              <Text style={[styles.roundIcon, { color: theme.onPrimary }]}>➤</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </BarSheetProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 6 },
  brand: { fontFamily: fonts.title, letterSpacing: 0.5, fontSize: 31 },
  shortcuts: { flexDirection: 'row', gap: 4 },
  shortcut: { minHeight: 44, minWidth: 44, paddingHorizontal: 10, justifyContent: 'center' },
  shortcutText: { fontFamily: fonts.bodyBold, fontSize: 15 },
  empty: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 24 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  chip: { borderWidth: 2, borderRadius: 999, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center' },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 15 },
  list: { padding: 16, gap: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1 },
  round: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  roundIcon: { fontSize: 20, color: '#FFFFFF' },
  camera: { borderWidth: 2 },
  input: { flex: 1, minHeight: 48, maxHeight: 120, borderRadius: 24, borderWidth: 2, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12, fontFamily: fonts.body, fontSize: 17 },
});
