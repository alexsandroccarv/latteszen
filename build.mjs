/* ==========================================================================
   lattesZen — build (site multi-arquivo)
   --------------------------------------------------------------------------
   A aplicação deixou de ser um único index.html autossuficiente. Agora ela é
   composta por vários arquivos (index.html + css/ + js/ + imagens), para
   reduzir a complexidade/tamanho de cada arquivo. Por isso, NÃO funciona mais
   abrindo só o index.html "solto": é preciso o diretório inteiro.

   Este build apenas MONTA a pasta dist/ (o que vai para o servidor) copiando
   fielmente os arquivos de src/ — sem embutir/inlinar nada. Todo o site
   (index.html, páginas de apoio, favicon, manifest, css/, js/) já vive
   dentro de src/, então este passo único é suficiente.

   Uso:  node build.mjs
   ========================================================================== */
import { cpSync, rmSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');
const dist = join(root, 'dist');

// 1) Recria dist/ do zero
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// 2) Copia TODO o conteúdo de src/ (index.html, css/, js/, images/…) para dist/
cpSync(src, dist, { recursive: true });

console.log('OK: dist/ montado (site multi-arquivo).');
console.log('Conteúdo de dist/: ' + readdirSync(dist).join('  '));
