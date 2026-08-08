/* ==========================================================================
   lattesZen — build simples (sem dependências)
   --------------------------------------------------------------------------
   Gera um index.html AUTOSSUFICIENTE na raiz, embutindo o CSS local e todos
   os módulos JS a partir de src/. Assim o usuário pode baixar UM único
   arquivo e abri-lo direto no navegador (as CDNs de Tailwind/Font Awesome
   continuam sendo carregadas de forma assíncrona e tolerante a falha).

   Uso:  node build.mjs
   ========================================================================== */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');

// Ordem de carga dos módulos (a mesma dos <script> no template)
const JS_FILES = ['js/config.js', 'js/lattes-types.js', 'js/storage.js', 'js/lattes-xml.js', 'js/app.js'];

let html = readFileSync(join(src, 'index.html'), 'utf8');

// 1) Inlinar o CSS local
const css = readFileSync(join(src, 'css/styles.css'), 'utf8');
html = html.replace(
    /<link rel="stylesheet" href="css\/styles\.css">/,
    `<style>\n${css}\n</style>`
);

// 2) Inlinar os módulos JS (substitui o bloco de <script src="js/..."> por scripts embutidos)
const inlineScripts = JS_FILES.map(f => {
    const code = readFileSync(join(src, f), 'utf8');
    return `<script>\n/* ===== ${f} ===== */\n${code}\n</script>`;
}).join('\n');

// Remove as tags <script src="js/..."> individuais e injeta o bloco embutido no lugar da primeira
const scriptTagRe = /<script src="js\/[^"]+"><\/script>\s*/g;
let firstReplaced = false;
html = html.replace(scriptTagRe, () => {
    if (!firstReplaced) { firstReplaced = true; return inlineScripts + '\n    '; }
    return '';
});

// 3) Marca como arquivo gerado (comentário no topo)
html = html.replace(
    /<!DOCTYPE html>/i,
    '<!DOCTYPE html>\n<!-- ARQUIVO GERADO por build.mjs a partir de src/. NÃO edite aqui; edite em src/ e rode: node build.mjs -->'
);

writeFileSync(join(root, 'index.html'), html, 'utf8');
console.log('OK: index.html autossuficiente gerado na raiz (' + html.length + ' bytes).');
