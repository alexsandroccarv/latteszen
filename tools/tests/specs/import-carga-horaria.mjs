/* ==========================================================================
   Regressão: Importar "Carga Horária: Consolidada" (PDF Unifesp) —
   Configurações → Importar.
   --------------------------------------------------------------------------
   A Unifesp só disponibiliza esse relatório em PDF (nunca XML/JSON) — o
   importador lê o texto do PDF (pdf.js) e reconstrói as tabelas por posição
   (ver src/js/import-carga-horaria.js, algoritmo validado linha a linha
   contra um relatório real de 37 linhas antes de escrever o código). Os
   testes aqui mockam window.ImportCargaHoraria.parsePdf (não dependem de um
   PDF real) — o parsing em si já foi validado à parte; o que estes testes
   cobrem é o fluxo de revisão → seleção → importação → catálogo, igual ao
   já coberto para "Currículo Lattes (XML)" em config-xml-lattes.mjs.

   Os candidatos viram itens NORMAIS do catálogo Lattes (mesmos typeKeys de
   lattes-types-*.js) — pedido do Alexsandro: nenhuma pasta/aba exclusiva de
   TAE ou Docente, sempre o catálogo genérico.
   ========================================================================== */
import { test, assert, assertEqual, seedCatalog, makeItem } from '../harness.mjs';

async function abrirImportarCargaHoraria(page, baseUrl, items) {
    await seedCatalog(page, baseUrl, items || []);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
    await page.click('[data-cfg-page-link="grp-importar"]');
    await page.waitForTimeout(150);
}

// Candidato de exemplo (mesmo formato devolvido por ImportCargaHoraria.parsePdf)
// — um CURSO_MINISTRADO (Extensão) + um PARTICIPACAO_EVENTO, cobrindo os 2
// perfis mapeados (a lista completa de heurísticas já foi validada contra o
// relatório real, ver comentários em import-carga-horaria.js).
function candidatosExemplo() {
    return {
        secoes: [{ nome: 'Extensão e Cultura', perfil: 'eventos', colunas: [], linhas: [] }],
        candidatos: [
            {
                secao: 'Extensão e Cultura', typeKeySugerido: 'CURSO_MINISTRADO', typeKeyOpcoes: ['CURSO_MINISTRADO', 'PARTICIPACAO_EVENTO'],
                titulo: 'CICLO DE ESTUDOS PARA FORMAÇÃO DE CONSELHEIRAS E CONSELHEIROS', avisos: [],
                fields: { nivel: 'Extensão', titulo: 'CICLO DE ESTUDOS PARA FORMAÇÃO DE CONSELHEIRAS E CONSELHEIROS', ano: '12032021', instituicao: 'Unifesp', participacaoAutores: 'Organizador', cargaHoraria: 24, unidade: 'h' },
                extras: {},
            },
            {
                secao: 'Extensão e Cultura', typeKeySugerido: 'PARTICIPACAO_EVENTO', typeKeyOpcoes: ['PARTICIPACAO_EVENTO', 'ORGANIZACAO_EVENTO'],
                titulo: '1º TECH TALKS STI-UNIFESP', avisos: ['Natureza do evento não vem no relatório — revise antes de importar.'],
                fields: { titulo: '1º TECH TALKS STI-UNIFESP', natureza: 'Outra', formaParticipacao: 'Participante', tipoParticipacao: '', ano: '20022024', cargaHoraria: 8 },
                extras: {},
            },
        ],
    };
}

async function mockParsePdf(page, resultado) {
    await page.evaluate((res) => {
        window.ImportCargaHoraria.parsePdf = async () => res;
    }, resultado);
}

test('Configurações → Importar: seção "Carga Horária (PDF Unifesp)" existe, com input de arquivo', async ({ page, baseUrl }) => {
    await abrirImportarCargaHoraria(page, baseUrl);
    assertEqual(await page.locator('#cargaHorariaInput').count(), 1, 'O input de arquivo da Carga Horária deveria existir');
    const visivel = await page.$eval('#cargaHorariaInput', (el) => el.offsetParent !== null);
    assert(visivel, 'O input de arquivo deveria estar visível');
    const secaoTexto = await page.$eval('#importXmlSection', (el) => el.textContent);
    assert(/Carga Horária/i.test(secaoTexto), 'O card "Carga Horária (PDF Unifesp)" deveria aparecer na página Importar');
});

test('Selecionar um PDF reconhece os candidatos e mostra a lista de revisão (com tipo Lattes editável)', async ({ page, baseUrl }) => {
    await abrirImportarCargaHoraria(page, baseUrl);
    await mockParsePdf(page, candidatosExemplo());
    await page.setInputFiles('#cargaHorariaInput', { name: 'carga-horaria.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-fake') });
    await page.waitForTimeout(200);

    const texto = await page.locator('#cargaHorariaResult').innerText();
    assert(/2 atividades reconhecidas/i.test(texto), `Deveria mostrar o total de candidatos reconhecidos — obtido: ${texto}`);
    assert(/CICLO DE ESTUDOS/i.test(texto), 'Deveria listar o título do 1º candidato');
    assert(/1º TECH TALKS/i.test(texto), 'Deveria listar o título do 2º candidato');

    const checkboxes = await page.locator('.chchk').count();
    assertEqual(checkboxes, 2, 'Deveria ter uma checkbox por candidato');
    const tipos = await page.locator('.chtipo').count();
    assertEqual(tipos, 2, 'Deveria ter um seletor de tipo Lattes por candidato (revisão antes de importar)');
});

test('"Importar selecionados" cria os itens no catálogo com os typeKeys corretos e anexa o PDF como evidência', async ({ page, baseUrl }) => {
    await abrirImportarCargaHoraria(page, baseUrl);
    await page.evaluate(() => {
        window.Storage.hasDirectory = () => true;
        window.Storage.writeJson = async () => {};
        window.__attachSaves = [];
        window.Storage.writeAttachment = async (basename, file, subdir, ext) => { window.__attachSaves.push({ basename, subdir, ext, nome: file.name }); };
    });
    await mockParsePdf(page, candidatosExemplo());
    await page.setInputFiles('#cargaHorariaInput', { name: 'carga-horaria.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-fake') });
    await page.waitForTimeout(200);

    await page.click('#btnChImport');
    await page.waitForTimeout(300);

    const items = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    assertEqual(items.length, 2, 'Os 2 candidatos (marcados por padrão) deveriam virar itens do catálogo');
    const curso = items.find((i) => i.typeKey === 'CURSO_MINISTRADO');
    assert(curso, 'Deveria ter criado um item CURSO_MINISTRADO');
    assertEqual(curso.fields.nivel, 'Extensão', 'O nível do curso deveria ser "Extensão"');
    assertEqual(curso.fields.titulo, 'CICLO DE ESTUDOS PARA FORMAÇÃO DE CONSELHEIRAS E CONSELHEIROS', 'O título deveria vir do PDF');
    const evento = items.find((i) => i.typeKey === 'PARTICIPACAO_EVENTO');
    assert(evento, 'Deveria ter criado um item PARTICIPACAO_EVENTO');

    const saves = await page.evaluate(() => window.__attachSaves);
    assertEqual(saves.length, 2, 'O PDF de origem deveria ser anexado como evidência de cada item importado');
    assert(saves.every((s) => s.nome === 'carga-horaria.pdf'), 'A evidência anexada deveria ser o próprio PDF selecionado');

    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((tx) => tx.startsWith('2 item')), `Deveria confirmar quantos itens foram importados — toasts: ${JSON.stringify(toasts)}`);
});

/* -------- Evidência coletiva: não pública → ícone âmbar em Conformidade --
   O mesmo PDF vira evidência de VÁRIOS itens de uma vez (prova coletiva do
   relatório da Unifesp, não um comprovante dedicado a cada item) — por
   isso é gravada com `publica: false`. Isso já é suficiente pra fazer o
   ícone de evidência aparecer em âmbar (não verde) em Conformidade, já
   que evidenceIconsHtml() colore só pela presença de alguma evidência
   `publica: true` — nenhuma lógica nova precisou ser criada lá, ver
   tab-conformidade.js. */
test('A evidência da Carga Horária é gravada como NÃO pública (ícone âmbar em Conformidade, não verde)', async ({ page, baseUrl }) => {
    await abrirImportarCargaHoraria(page, baseUrl);
    await page.evaluate(() => {
        window.Storage.hasDirectory = () => true;
        window.Storage.writeJson = async () => {};
        window.Storage.writeAttachment = async () => {};
    });
    await mockParsePdf(page, candidatosExemplo());
    await page.setInputFiles('#cargaHorariaInput', { name: 'carga-horaria.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-fake') });
    await page.waitForTimeout(200);
    await page.click('#btnChImport');
    await page.waitForTimeout(300);

    const items = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    assertEqual(items.length, 2, 'Os 2 candidatos deveriam virar itens do catálogo');
    assert(items.every((i) => i.evidencias.length === 1 && i.evidencias[0].publica === false), 'A evidência da Carga Horária deveria ser gravada como NÃO pública em todo item importado');

    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(300);
    for (const item of items) {
        const btn = page.locator(`button[data-act="pdf"][data-id="${item.id}"]`);
        assertEqual(await btn.count(), 1, `O ícone de evidência do item ${item.id} deveria existir em Conformidade`);
        const classe = await btn.getAttribute('class');
        assert(classe.includes('text-amber-600'), `O ícone de evidência deveria estar em âmbar (não pública) — classe obtida: ${classe}`);
        assert(!classe.includes('text-green-600'), `O ícone de evidência NÃO deveria estar verde — classe obtida: ${classe}`);
    }
});

test('Sem diretório de armazenamento configurado, os itens são criados mas sem evidência anexada (avisa)', async ({ page, baseUrl }) => {
    await abrirImportarCargaHoraria(page, baseUrl);
    await page.evaluate(() => { window.Storage.hasDirectory = () => false; });
    await mockParsePdf(page, candidatosExemplo());
    await page.setInputFiles('#cargaHorariaInput', { name: 'carga-horaria.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-fake') });
    await page.waitForTimeout(200);

    await page.click('#btnChImport');
    await page.waitForTimeout(300);

    const items = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    assertEqual(items.length, 2, 'Os itens deveriam ser criados mesmo sem diretório configurado');
    assert(items.every((i) => !i.hasPdf && i.evidencias.length === 0), 'Sem diretório, nenhum item deveria ter evidência registrada');

    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((tx) => /sem evidência anexada/i.test(tx)), 'Deveria avisar que os itens ficaram sem evidência anexada');
});

test('Um candidato que já existe no catálogo (mesma assinatura) aparece como "já catalogado", desmarcado, e não duplica ao importar', async ({ page, baseUrl }) => {
    const existente = makeItem('CURSO_MINISTRADO', 'PRODUCOES', { nivel: 'Extensão', titulo: 'CICLO DE ESTUDOS PARA FORMAÇÃO DE CONSELHEIRAS E CONSELHEIROS', ano: '12032021' });
    await abrirImportarCargaHoraria(page, baseUrl, [existente]);
    await mockParsePdf(page, candidatosExemplo());
    await page.setInputFiles('#cargaHorariaInput', { name: 'carga-horaria.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-fake') });
    await page.waitForTimeout(200);

    const texto = await page.locator('#cargaHorariaResult').innerText();
    assert(/já catalogado/i.test(texto), 'O candidato já existente deveria ser marcado como "já catalogado"');
    assert(/1 nova/i.test(texto), `Só o 2º candidato deveria contar como novo — obtido: ${texto}`);

    // Força marcar o já-catalogado também (checkbox começa desmarcada) e importa os 2.
    await page.evaluate(() => { document.querySelectorAll('.chchk').forEach((c) => { c.checked = true; }); });
    await page.click('#btnChImport');
    await page.waitForTimeout(300);

    const items = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    assertEqual(items.length, 2, 'O candidato duplicado NÃO deveria criar um 2º item — só o item pré-existente + o novo (PARTICIPACAO_EVENTO)');
    const cursos = items.filter((i) => i.typeKey === 'CURSO_MINISTRADO');
    assertEqual(cursos.length, 1, 'Não deveria duplicar o CURSO_MINISTRADO já existente');
});

/* --------- Mapeamento organizador/palestrante (lógica pura) --------------
   Regra confirmada pelo Alexsandro: Coordenador/Vice-coordenador/Comissão
   científica/Supervisor → ORGANIZACAO_EVENTO; Palestrante →
   APRESENTACAO ("Apresentação de trabalho e palestra"). Uma linha com AS
   DUAS anotações lança nos DOIS lugares (2 candidatos), não só um. */
function linha(envolvimento) {
    return { indice: 1, valores: ['1', '20/02/2024', 'EVENTO', '12345', 'TÍTULO DE EXEMPLO', 'TAE', envolvimento, '8'] };
}
async function candidatosPara(page, envolvimento) {
    return page.evaluate((l) => window.ImportCargaHoraria.candidatosDeLinhaEventos(l), linha(envolvimento));
}

test('Envolvimento só com papel de organização (Coordenador/Vice-coordenador/Comissão científica/Supervisor) vira só ORGANIZACAO_EVENTO', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    for (const envolvimento of ['COORDENADOR/A', 'VICE-COORDENADOR(A)', 'COMISSÃO CIENTÍFICA', 'SUPERVISOR(A) (RESPONSÁVEL TÉCNICO-CIENTÍFICO)']) {
        const cands = await candidatosPara(page, envolvimento);
        assertEqual(cands.map((c) => c.typeKeySugerido), ['ORGANIZACAO_EVENTO'], `Envolvimento "${envolvimento}" deveria virar só ORGANIZACAO_EVENTO — obtido: ${JSON.stringify(cands.map((c) => c.typeKeySugerido))}`);
    }
});

test('Envolvimento só com "Palestrante" vira só APRESENTACAO (Apresentação de trabalho e palestra)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const cands = await candidatosPara(page, 'PALESTRANTE');
    assertEqual(cands.map((c) => c.typeKeySugerido), ['APRESENTACAO'], `"PALESTRANTE" sozinho deveria virar só APRESENTACAO — obtido: ${JSON.stringify(cands.map((c) => c.typeKeySugerido))}`);
    assertEqual(cands[0].fields.natureza, 'Conferência ou palestra', 'A natureza sugerida deveria ser "Conferência ou palestra"');
});

test('Envolvimento com organização E palestra na mesma linha (ex.: "COORDENADOR/A, PALESTRANTE") lança nos DOIS lugares', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const cands = await candidatosPara(page, 'COORDENADOR / A (RESPONSÁVEL TÉCNICO-CIENTÍFICO), PALESTRANTE');
    assertEqual(cands.length, 2, 'Uma linha com organizador E palestrante deveria virar 2 candidatos, um de cada tipo');
    const tipos = cands.map((c) => c.typeKeySugerido).sort();
    assertEqual(tipos, ['APRESENTACAO', 'ORGANIZACAO_EVENTO'], `Deveria ter exatamente ORGANIZACAO_EVENTO + APRESENTACAO — obtido: ${JSON.stringify(tipos)}`);
});

test('Envolvimento sem palavra-chave de organização nem "Palestrante" (ex.: "MODERADOR(A)") também vira ORGANIZACAO_EVENTO — neste relatório, tudo que não é palestra é organização', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const cands = await candidatosPara(page, 'MODERADOR(A)');
    assertEqual(cands.map((c) => c.typeKeySugerido), ['ORGANIZACAO_EVENTO'], `"MODERADOR(A)" sozinho deveria sugerir ORGANIZACAO_EVENTO (pedido do Alexsandro: "neste documento sempre é organização") — obtido: ${JSON.stringify(cands.map((c) => c.typeKeySugerido))}`);
    assertEqual(cands[0].typeKeyOpcoes, ['ORGANIZACAO_EVENTO', 'PARTICIPACAO_EVENTO'], 'PARTICIPACAO_EVENTO deveria continuar disponível como alternativa manual na revisão');
});

/* --------------- Reconstrução de tabela (lógica pura) --------------------
   Fixture sintética (posições x/y no mesmo formato devolvido por pdf.js —
   conteúdo genérico, NÃO os dados reais de ninguém) reproduzindo os 2 bugs
   reais encontrados ao validar o algoritmo contra um relatório real:
   1) o rodapé fixo de cada página ("Carga Horária"/"Código de
      autenticação:..."/"Unifesp, ...") vazando pra dentro da última linha
      da página (corrigido filtrando y < 45 antes de tudo);
   2) título quebrado em 2 linhas de PDF com hífen de fim de palavra virando
      "PALAVRA- CONTINUAÇÃO" (com espaço a mais) em vez de
      "PALAVRA-CONTINUAÇÃO" (corrigido em juntarLinhasCelula). */
test('Reconstrução de tabela: filtra o rodapé da página e junta títulos quebrados com hífen sem espaço extra', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const pagina = [
        // cabeçalho da tabela "eventos"
        { str: '#', x: 44, y: 359 }, { str: 'Data', x: 65, y: 359 }, { str: 'Descrição', x: 128, y: 359 },
        { str: 'Código', x: 213, y: 359 }, { str: 'Título', x: 253, y: 359 }, { str: 'Vínculo', x: 522, y: 359 },
        { str: 'Envolvimento', x: 565, y: 359 }, { str: 'CH', x: 772, y: 359 },
        // linha 1: título quebrado em 2 linhas com hífen de fim de palavra
        { str: '1', x: 46, y: 334 }, { str: '12/03/2021', x: 67, y: 334 }, { str: 'EVENTO', x: 131, y: 334 },
        { str: '11111', x: 216, y: 334 }, { str: 'TÍTULO DE EXEMPLO COM QUEBRA DE', x: 256, y: 340 }, { str: 'LINHA-', x: 256, y: 328 }, { str: 'CONTINUAÇÃO', x: 300, y: 328 },
        { str: 'TAE', x: 525, y: 334 }, { str: 'PALESTRANTE', x: 568, y: 334 }, { str: '4', x: 775, y: 334 },
        // rodapé fixo da página (deve ser IGNORADO, não vazar pra linha 1 acima)
        { str: 'Carga Horária', x: 43, y: 30 }, { str: 'Código de autenticação: FAKE:0000', x: 307, y: 30 }, { str: 'Unifesp, 01/01/2026 00:00:00, página: 1 de 1', x: 584, y: 30 },
    ];
    const secoes = await page.evaluate((pag) => window.ImportCargaHoraria.parsePaginas([pag]), pagina);
    assertEqual(secoes.length, 1, 'Deveria reconhecer exatamente 1 seção nesta página sintética');
    assertEqual(secoes[0].linhas.length, 1, 'Deveria reconstruir exatamente 1 linha de dados');
    const linha = secoes[0].linhas[0];
    assertEqual(linha.valores[0], '1', 'O índice da linha não deveria ter absorvido texto do rodapé');
    assertEqual(linha.valores[4], 'TÍTULO DE EXEMPLO COM QUEBRA DE LINHA-CONTINUAÇÃO', 'A quebra com hífen deveria juntar sem espaço extra, e o rodapé não deveria vazar pro título');
});

test('"Limpar catálogo" também zera a prévia de importação da Carga Horária (PDF)', async ({ page, baseUrl }) => {
    await abrirImportarCargaHoraria(page, baseUrl);
    await mockParsePdf(page, candidatosExemplo());
    await page.setInputFiles('#cargaHorariaInput', { name: 'carga-horaria.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-fake') });
    await page.waitForTimeout(200);

    await page.click('[data-cfg-page-link="grp-risco"]');
    await page.waitForTimeout(150);
    await page.click('#btnClear');
    await page.waitForTimeout(200);

    const previa = await page.evaluate(() => window.AppCore.state.importacoes.cargaHoraria);
    assert(!previa, '"Limpar catálogo" deveria zerar state.importacoes.cargaHoraria');
});
