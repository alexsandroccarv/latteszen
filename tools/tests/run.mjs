/* ==========================================================================
   lattesZen — executa a suíte de testes de regressão (Playwright)
   Uso:  node tools/tests/run.mjs   (ou "npm test")
   ========================================================================== */
import { runAll } from './harness.mjs';

import './specs/campo-na.mjs';
import './specs/conformidade.mjs';
import './specs/visibilidade.mjs';
import './specs/lixeira.mjs';
import './specs/sincronizacao.mjs';
import './specs/rsc-datas.mjs';
import './specs/resumo-conformidade.mjs';
import './specs/atalhos-teclado.mjs';
import './specs/datas-agrupadas.mjs';
import './specs/importar-orcid.mjs';
import './specs/crossref-doi.mjs';
import './specs/importar-bibtex-ris.mjs';
import './specs/exportar-bibtex-ris.mjs';
import './specs/gdrive.mjs';
import './specs/publicar.mjs';
import './specs/inicio.mjs';
import './specs/rsc.mjs';
import './specs/rsc-filtro-criterio.mjs';

console.log('Rodando suíte de testes de regressão (Playwright)...\n');
await runAll();
