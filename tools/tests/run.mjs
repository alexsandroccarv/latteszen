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

console.log('Rodando suíte de testes de regressão (Playwright)...\n');
await runAll();
