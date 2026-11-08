import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

// Épico 8.11 (critério 1; nota sobre a marca): nenhum texto da loja nem a configuração do app citam a marca.
// Reforça o hook guard-store-brand.sh, que só age quando o Claude Code roda a partir desta pasta.

const ROOT = join(__dirname, '..');
const MARCA = /brahma/i;

// Recebe: uma pasta. Devolve: os arquivos de texto dentro dela (recursivo), sem imagens.
function textFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return textFiles(path);
    return /\.(md|txt|json|ts)$/i.test(name) ? [path] : [];
  });
}

it('store/ não contém a marca', () => {
  const files = textFiles(join(ROOT, 'store'));
  expect(files.length).toBeGreaterThan(0);
  for (const f of files) expect({ f, marca: MARCA.test(readFileSync(f, 'utf8')) }).toEqual({ f, marca: false });
});

it('app.config.ts e eas.json não contêm a marca e o nome é OTCB', () => {
  for (const f of ['app.config.ts', 'eas.json']) expect(MARCA.test(readFileSync(join(ROOT, f), 'utf8'))).toBe(false);
  expect(readFileSync(join(ROOT, 'app.config.ts'), 'utf8')).toMatch(/name: 'OTCB'/);
});
