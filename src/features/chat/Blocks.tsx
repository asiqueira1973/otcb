import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { fonts, useTheme } from '../../components/theme';
import { copy } from '../../lib/copy';
import { BarCard } from '../bares/BarCard';
import { useBarSheet } from '../bares/BarSheet';
import { formatKickoff } from '../bares/format';
import { openDirections } from '../bares/links';
import { MiniMap } from '../bares/MiniMap';
import { ConfirmationCard } from '../cards/ConfirmationCard';
import { OpinionForm } from '../cards/OpinionForm';
import { ReportForm } from '../cards/ReportForm';
import { SuggestionForm } from '../cards/SuggestionForm';
import { ResultCard } from '../colarinhometro/ResultCard';
import { showComingSoon } from './comingSoon';
import type { Bloco, CardBar } from './types';

type Props = { blocos: Bloco[]; messageId?: string; animar?: boolean };

// Bares conhecidos na mensagem (para as ações rota/Uber/ficha acharem as coordenadas). Recebe: blocos. Devolve: mapa id→bar.
function knownBars(blocos: Bloco[]): Map<string, Pick<CardBar, 'bar_id' | 'nome' | 'latitude' | 'longitude'>> {
  const m = new Map<string, Pick<CardBar, 'bar_id' | 'nome' | 'latitude' | 'longitude'>>();
  for (const b of blocos) {
    if (b.tipo === 'lista_bares') b.bares.forEach((x) => m.set(x.bar_id, x));
    if (b.tipo === 'card_bar') m.set(b.bar.bar_id, b.bar);
    if (b.tipo === 'mapa') b.pontos.forEach((x) => m.set(x.bar_id, x));
  }
  return m;
}

// Renderiza os blocos da 13.2 numa resposta: os de exibição (8.4) e os de entrada (8.5), cada card de
// entrada com chave própria (mensagem + posição) para guardar o estado "registrado". Tipo desconhecido é
// ignorado. Recebe: blocos e id da mensagem. Devolve: a pilha de cards.
export function Blocks({ blocos, messageId = "local", animar = false }: Props) {
  const theme = useTheme();
  const { openBar, onCard } = useBarSheet();
  const bars = knownBars(blocos);
  const acoes = blocos.filter((b): b is Extract<Bloco, { tipo: 'acao' }> => b.tipo === 'acao');

  function runAction(a: Extract<Bloco, { tipo: 'acao' }>) {
    const bar = a.bar_id ? bars.get(a.bar_id) : undefined;
    if (a.acao === 'abrir_ficha' && a.bar_id) openBar(a.bar_id);
    else if (a.acao === 'abrir_rota' && bar) void openDirections('mapas', bar);
    else if (a.acao === 'chamar_uber' && bar) void openDirections('uber', bar);
    else if (a.acao === 'abrir_camera') router.push('/camera');
    else if (a.acao === 'abrir_passaporte') router.push('/passaporte');
    else showComingSoon();
  }

  return (
    <View style={styles.stack}>
      {blocos.map((b, i) => {
        switch (b.tipo) {
          case 'lista_bares':
            return (
              <View key={i} style={styles.stack} testID="bloco-lista-bares">
                <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{b.titulo}</Text>
                {b.bares.map((bar) => <BarCard key={bar.bar_id} bar={bar} onOpen={openBar} compact />)}
              </View>
            );
          case 'card_bar':
            return <BarCard key={i} bar={b.bar} onOpen={openBar} />;
          case 'mapa':
            return <MiniMap key={i} pontos={b.pontos} onOpen={openBar} />;
          case 'jogos':
            return (
              <View key={i} testID="bloco-jogos" style={[styles.box, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>⚽ {copy.blocks.games}</Text>
                {b.jogos.length === 0 ? (
                  <Text style={[styles.body, { color: theme.textMuted }]}>{copy.blocks.noGames}</Text>
                ) : (
                  b.jogos.map((j) => (
                    <Text key={j.jogo_id} style={[styles.body, { color: theme.text }]}>
                      {formatKickoff(j.inicio)} · {j.mandante} × {j.visitante}
                      <Text style={{ color: theme.textMuted }}> ({j.competicao})</Text>
                    </Text>
                  ))
                )}
              </View>
            );
          case 'passaporte':
            return (
              <Pressable
                key={i}
                testID="bloco-passaporte"
                accessibilityRole="button"
                onPress={() => router.push('/passaporte')}
                style={[styles.box, { backgroundColor: theme.card, borderColor: theme.border }]}
              >
                <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{copy.blocks.passport}</Text>
                <Text style={[styles.body, { color: theme.text }]}>{copy.blocks.stamps(b.total_carimbos)}</Text>
                <Text style={[styles.body, { color: theme.text }]}>{copy.blocks.neighborhoods(b.bairros_conquistados)}</Text>
                {b.ultimo_selo ? (
                  <Text style={[styles.body, { color: theme.text }]}>{copy.blocks.lastSeal(copy.seals[b.ultimo_selo] ?? b.ultimo_selo)}</Text>
                ) : null}
              </Pressable>
            );
          case 'pergunta_confirmacao':
            return <ConfirmationCard key={i} chave={`${messageId}:${i}`} barId={b.bar_id} assunto={b.assunto} pergunta={b.pergunta} />;
          case 'formulario_opiniao':
            return <OpinionForm key={i} chave={`${messageId}:${i}`} barId={b.bar_id} nomeBar={b.nome_bar} textoAtual={b.texto_atual} notaAtual={b.nota_atual} />;
          case 'formulario_sugestao_bar':
            return <SuggestionForm key={i} chave={`${messageId}:${i}`} nome={b.nome} endereco={b.endereco} bairro={b.bairro} usarLocalizacaoAtual={b.usar_localizacao_atual} />;
          case 'formulario_denuncia':
            return <ReportForm key={i} chave={`${messageId}:${i}`} opiniaoId={b.opiniao_id} />;
          case 'resultado_colarinho':
            return <ResultCard key={i} bloco={b} animar={animar} onCard={onCard} />;
          default:
            return null;
        }
      })}
      {acoes.length > 0 ? (
        <View style={styles.actions}>
          {acoes.map((a, i) => (
            <View key={i} style={styles.action}>
              <Button testID={`acao-${a.acao}`} variant={i === 0 ? 'primary' : 'ghost'} label={a.rotulo} onPress={() => runAction(a)} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 10 },
  box: { borderWidth: 2, borderRadius: 14, padding: 14, gap: 6 },
  title: { fontFamily: fonts.title, letterSpacing: 0.5, fontSize: 22, lineHeight: 24 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  actions: { gap: 8 },
  action: {},
});
