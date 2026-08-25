/* ==========================================================================
   Regressão: "Gerar prompt (IA)" na aba RSC — baixa um .md com um prompt
   master (instruções do Art. 13 do Decreto nº 13.048/2026: 4.000-10.000
   caracteres, primeira pessoa, sem dados pessoais sensíveis) seguido dos
   dados categorizados do catálogo RSC (contexto profissional + atividades
   por requisito), pronto para colar numa IA externa e gerar a narrativa de
   Trajetória Profissional do Memorial Descritivo.
   ========================================================================== */
import { test, assert } from '../harness.mjs';
import { readFileSync } from 'node:fs';

async function habilitarRsc(page, cfg) {
    await page.evaluate((c) => {
        const s = JSON.parse(localStorage.getItem('lz_settings') || '{}');
        s.rscEnabled = true;
        s.rsc = Object.assign({ escolaridade: 'medio' }, c);
        localStorage.setItem('lz_settings', JSON.stringify(s));
    }, cfg || {});
    await page.reload();
    await page.waitForTimeout(500);
}

test('Gerar prompt (IA) baixa um .md com o prompt master e os dados categorizados, sem dados sensíveis', async ({ page, baseUrl }) => {
    const items = [
        {
            id: 'it-ident', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), source: 'local',
            lattesItem: false, typeKey: 'IDENTIFICACAO', categoryKey: 'DADOS_GERAIS',
            fields: { titulo: 'Fulano de Tal Teste' }, evidencias: [], hasPdf: false, pdfName: null, fileExt: null, lattesRef: null,
        },
        {
            id: 'it-rsc', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), source: 'local',
            lattesItem: false, typeKey: 'FORMACAO_COMPLEMENTAR', categoryKey: 'FORMACAO',
            fields: { titulo: 'Curso RSC Prompt', instituicao: 'X', anoFim: '2024' }, evidencias: [], hasPdf: false, pdfName: null, fileExt: null, lattesRef: null,
            rsc: { conta: true, criterio: '1.3', jaUsado: false, justificativa: 'Participei como membro do núcleo de acessibilidade.' },
        },
    ];
    await page.goto(baseUrl + '/index.html');
    await page.evaluate((its) => localStorage.setItem('lz_catalog', JSON.stringify(its)), items);
    await page.reload();
    await page.waitForTimeout(500);
    await habilitarRsc(page, {
        cargo: 'Assistente em Administração', nivelClassificacao: 'D', lotacao: 'Reitoria', telefoneEmail: 'fulano@ife.gov.br', saldoAnterior: '2,5',
    });
    await page.click('[data-tab="rsc"]');
    await page.waitForTimeout(300);

    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('#btnRscPromptIA'),
    ]);
    assert(/\.md$/.test(download.suggestedFilename()), `Nome do arquivo deveria terminar em .md — obtido "${download.suggestedFilename()}"`);

    const conteudo = readFileSync(await download.path(), 'utf-8');
    assert(/4\.000 e 10\.000 caracteres/.test(conteudo), 'O prompt deveria mencionar o limite de 4.000-10.000 caracteres do Art. 13');
    assert(/Decreto nº 13\.048\/2026/.test(conteudo), 'O prompt deveria citar o Decreto nº 13.048/2026');
    assert(/dados pessoais sensíveis/.test(conteudo), 'O prompt deveria instruir a não incluir dados pessoais sensíveis');
    assert(conteudo.includes('Curso RSC Prompt'), 'Os dados categorizados deveriam incluir o item marcado para o RSC');
    assert(conteudo.includes('Participei como membro do núcleo de acessibilidade'), 'A justificativa do item deveria aparecer nos dados');
    assert(conteudo.includes('Assistente em Administração'), 'O cargo configurado deveria aparecer no contexto profissional');
    assert(conteudo.includes('Reitoria'), 'A lotação configurada deveria aparecer no contexto profissional');

    assert(!conteudo.includes('Fulano de Tal Teste'), 'O nome do servidor NÃO deveria ser enviado no prompt (minimizar dados pessoais)');
    assert(!conteudo.includes('fulano@ife.gov.br'), 'O e-mail configurado NÃO deveria aparecer no prompt');
    assert(!conteudo.includes('2,5'), 'O saldo de pontuação anterior NÃO deveria aparecer no prompt');
});
