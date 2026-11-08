import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../src/components/Button';
import { fonts, palette, useTheme } from '../src/components/theme';
import { enviarFoto, prepararFoto, type Confirmacao } from '../src/features/colarinhometro/api';
import { mensagemDaFalha, registrarTelemetria } from '../src/features/colarinhometro/enviar';
import { enfileirar } from '../src/features/colarinhometro/fila';
import { Pour } from '../src/features/colarinhometro/Pour';
import { publicarResultado } from '../src/features/colarinhometro/resultados';
import { copy } from '../src/lib/copy';
import { getCurrentCoords } from '../src/lib/location';

type Fase = { tipo: 'camera' } | { tipo: 'pergunta'; uri: string; capturadaEm: string } | { tipo: 'enviando' } | { tipo: 'erro'; mensagem: string };

// T7 — Câmera do Colarinhômetro (épico 8.6). Foto só pela câmera do app, nunca da galeria (11.4). Guia de
// enquadramento com a dica 15.15; depois da foto, "É chopp Brahma?" (Sim / Não / Não sei); redimensiona
// (1280 px, JPEG 0,7), envia com a localização do momento e mostra o A4. O resultado vai para o chat; sem
// rede, a foto entra na fila do aparelho (até 24 h). Recebe: nada. Devolve: a tela.
export default function Camera() {
  const theme = useTheme();
  const [permissao, pedirPermissao] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [fase, setFase] = useState<Fase>({ tipo: 'camera' });

  async function fotografar() {
    const foto = await camera.current?.takePictureAsync({ quality: 0.9, skipProcessing: false });
    if (!foto) return;
    const uri = await prepararFoto(foto.uri, foto.width, foto.height);
    setFase({ tipo: 'pergunta', uri, capturadaEm: new Date().toISOString() });
  }

  async function responder(uri: string, capturadaEm: string, confirmou: Confirmacao) {
    setFase({ tipo: 'enviando' });
    const coords = await getCurrentCoords();
    const r = await enviarFoto(uri, coords, confirmou, capturadaEm);
    registrarTelemetria(r);
    if (r.ok) {
      await publicarResultado(r.bloco);
      router.back();
      return;
    }
    if (r.falha === 'rede') await enfileirar(uri, coords, confirmou, capturadaEm);
    setFase({ tipo: 'erro', mensagem: mensagemDaFalha(r.falha) });
  }

  if (!permissao) return <View style={[styles.root, { backgroundColor: theme.background }]} />;

  if (!permissao.granted) {
    return (
      <SafeAreaView style={[styles.root, styles.center, { backgroundColor: theme.background }]}>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{copy.colarinho.permissionTitle}</Text>
        <Text style={[styles.body, { color: theme.text }]}>{copy.colarinho.permissionText}</Text>
        <View style={styles.actions}>
          {permissao.canAskAgain ? (
            <Button testID="permitir-camera" label={copy.colarinho.allow} onPress={() => void pedirPermissao()} />
          ) : (
            <Button testID="abrir-ajustes" label={copy.colarinho.openSettings} onPress={() => void Linking.openSettings()} />
          )}
          <Button testID="fechar-camera" variant="ghost" label={copy.colarinho.close} onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  if (fase.tipo === 'pergunta') {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]}>
        <Image source={{ uri: fase.uri }} style={styles.preview} resizeMode="cover" accessibilityIgnoresInvertColors />
        <View style={styles.pergunta}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{copy.colarinho.question}</Text>
          {([['sim', copy.colarinho.yes], ['nao', copy.colarinho.no], ['nao_sei', copy.colarinho.dontKnow]] as const).map(([v, rotulo], i) => (
            <Button key={v} testID={`foto-${v}`} variant={i === 0 ? 'primary' : 'ghost'} label={rotulo} onPress={() => void responder(fase.uri, fase.capturadaEm, v)} />
          ))}
          <Button testID="tirar-outra" variant="ghost" label={copy.colarinho.retake} onPress={() => setFase({ tipo: 'camera' })} />
        </View>
      </SafeAreaView>
    );
  }

  if (fase.tipo === 'enviando') {
    return (
      <SafeAreaView style={[styles.root, styles.center, { backgroundColor: theme.background }]}>
        <Pour />
      </SafeAreaView>
    );
  }

  if (fase.tipo === 'erro') {
    return (
      <SafeAreaView style={[styles.root, styles.center, { backgroundColor: theme.background }]}>
        <Text accessibilityLiveRegion="polite" style={[styles.body, { color: theme.text }]}>{fase.mensagem}</Text>
        <View style={styles.actions}>
          <Button testID="tentar-outra-foto" label={copy.colarinho.retake} onPress={() => setFase({ tipo: 'camera' })} />
          <Button testID="voltar-chat" variant="ghost" label={copy.colarinho.close} onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" testID="camera-view" />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <Text style={styles.hint}>{copy.colarinho.hint}</Text>
        <View style={styles.guia} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        <View style={styles.actions}>
          <Button testID="tirar-foto" label={copy.colarinho.takePhoto} onPress={() => void fotografar()} />
          <Button testID="fechar-camera" variant="ghost" label={copy.colarinho.close} onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  center: { justifyContent: 'center', padding: 24, gap: 16 },
  overlay: { flex: 1, justifyContent: 'space-between', padding: 24 },
  hint: { fontFamily: fonts.bodyBold, fontSize: 18, color: '#FFFFFF', textAlign: 'center', textShadowColor: '#000000', textShadowRadius: 6 },
  guia: { alignSelf: 'center', width: '62%', aspectRatio: 0.62, borderWidth: 3, borderColor: palette.amber, borderRadius: 24, borderStyle: 'dashed' },
  actions: { gap: 10 },
  title: { fontFamily: fonts.title, fontSize: 32, letterSpacing: 0.5 },
  body: { fontFamily: fonts.body, fontSize: 17, lineHeight: 24 },
  preview: { width: '100%', height: '50%' },
  pergunta: { padding: 24, gap: 10 },
});
