import { StyleSheet, Text, View } from 'react-native';

// Tela provisória do esqueleto (épico 8.0); será substituída pelo fluxo de primeiro acesso do épico 8.1.
// Recebe: nada. Devolve: uma tela com o nome do app.
export default function Index() {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header">OTCB</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
