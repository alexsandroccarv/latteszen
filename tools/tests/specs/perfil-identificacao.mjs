/* ==========================================================================
   lattesZen — Identificação (perfil): "Nome em citações bibliográficas" como
   lista, migração do valor antigo (texto livre) e demais ajustes da auditoria
   contra docs/mapeamento-campos-lattes.md.
   --------------------------------------------------------------------------
   Identificação (e os demais tipos de "Dados gerais/perfil") deixaram de ter
   uma tela própria em Configurações — mesclados no fluxo normal de
   Catalogar, como qualquer outro item (a pedido do usuário). Estes testes
   passaram a abrir o item pelo formulário do Catalogar em vez do antigo
   `#perfilSection`/`form[data-perfil-form="..."]`.
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

async function abrirEdicao(page, item) {
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.evaluate((it) => window.AppCore.buildForm(window.AppCore.state.items.find((i) => i.id === it.id)), item);
    await page.waitForTimeout(200);
}

test('Nome em citações bibliográficas: valor antigo (texto livre) migra para lista, e dá para adicionar mais variações', async ({ page, baseUrl }) => {
    const items = [
        makeItem('IDENTIFICACAO', 'DADOS_GERAIS', {
            titulo: 'Alexsandro Cardoso Carvalho',
            citacoes: 'CARVALHO, Alexsandro Cardoso\nCARVALHO, Alexsandro',
        }),
    ];
    await seedCatalog(page, baseUrl, items);
    await abrirEdicao(page, items[0]);

    const linhasMigradas = await page.locator('[data-repeater-list="citacoes"] li').allTextContents();
    assertEqual(linhasMigradas.map((t) => t.trim()), ['CARVALHO, Alexsandro Cardoso', 'CARVALHO, Alexsandro'],
        `As 2 variações do texto antigo deveriam aparecer como linhas da lista — obtidas: ${JSON.stringify(linhasMigradas)}`);

    await page.fill('[data-repeater-input="citacoes:nome"]', 'Carvalho, A. C.');
    await page.click('[data-repeater-add="citacoes"]');
    await page.waitForTimeout(200);

    const linhasComNova = await page.locator('[data-repeater-list="citacoes"] li').allTextContents();
    assert(linhasComNova.some((t) => t.trim() === 'Carvalho, A. C.'), `A nova variação adicionada deveria aparecer na lista — obtidas: ${JSON.stringify(linhasComNova)}`);

    await page.click('#camposPanel button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const ident = salvo.find((i) => i.typeKey === 'IDENTIFICACAO');
    assertEqual(ident.fields.citacoes, [
        { nome: 'CARVALHO, Alexsandro Cardoso' },
        { nome: 'CARVALHO, Alexsandro' },
        { nome: 'Carvalho, A. C.' },
    ], 'citacoes deveria ser salvo como lista (array de {nome}), incluindo a variação nova');
});

test('Cor ou raça inclui a opção "Amarela"', async ({ page, baseUrl }) => {
    const items = [makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulana de Tal' })];
    await seedCatalog(page, baseUrl, items);
    await abrirEdicao(page, items[0]);

    const opcoes = await page.locator('#dynFields select[name="corRaca"] option').allTextContents();
    assert(opcoes.map((o) => o.trim()).includes('Amarela'), `"Amarela" deveria estar entre as opções de Cor ou raça — obtidas: ${JSON.stringify(opcoes)}`);
});

test('Foto de perfil não tem mais os campos "Ano de início"/"Ano de fim" (não existem na tela real do Lattes)', async ({ page, baseUrl }) => {
    const items = [makeItem('FOTO_PERFIL', 'DADOS_GERAIS', { titulo: 'Foto oficial' })];
    await seedCatalog(page, baseUrl, items);
    await abrirEdicao(page, items[0]);

    const camposAno = await page.locator('#dynFields input[name="ano"], #dynFields input[name="anoFim"]').count();
    assert(camposAno === 0, 'O formulário de Foto de perfil não deveria mais ter campos de ano/anoFim');
});

test('Identificação, Endereço, Texto inicial, Outras informações, Foto de perfil e Área de atuação aparecem no Tipo do item de "01. Dados gerais"', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'DADOS_GERAIS');
    await page.waitForTimeout(150);

    const opcoes = await page.$eval('#selTipo', (sel) => Array.from(sel.options).map((o) => o.value));
    for (const tk of ['IDENTIFICACAO', 'ENDERECO', 'RESUMO_CV', 'OUTRAS_INFO', 'FOTO_PERFIL', 'DOCUMENTO_PESSOAL']) {
        assert(opcoes.includes(tk), `"${tk}" deveria aparecer no Tipo do item de "01. Dados gerais" — obtidas: ${JSON.stringify(opcoes)}`);
    }
    // Identidade (RG) e Passaporte saíram da lista principal (a pedido do
    // usuário) — continuam definidos em TYPES pra não quebrar itens já
    // cadastrados, só não são mais opção pra criar um item novo.
    for (const tk of ['DOC_IDENTIDADE', 'DOC_PASSAPORTE']) {
        assert(!opcoes.includes(tk), `"${tk}" não deveria mais aparecer no Tipo do item de "01. Dados gerais" — obtidas: ${JSON.stringify(opcoes)}`);
    }

    await page.selectOption('#selCategoria', 'ATUACAO');
    await page.waitForTimeout(150);
    const opcoesAtuacao = await page.$eval('#selTipo', (sel) => Array.from(sel.options).map((o) => o.value));
    assert(opcoesAtuacao.includes('AREA_ATUACAO'), `"AREA_ATUACAO" deveria aparecer no Tipo do item de "03. Atuação" — obtidas: ${JSON.stringify(opcoesAtuacao)}`);
});

test('Dados gerais: Texto inicial e Outras informações ficam ao final da lista', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'DADOS_GERAIS');
    await page.waitForTimeout(150);

    const opcoes = await page.$eval('#selTipo', (sel) => Array.from(sel.options).map((o) => o.value).filter(Boolean));
    assert(opcoes[opcoes.length - 2] === 'RESUMO_CV' && opcoes[opcoes.length - 1] === 'OUTRAS_INFO',
        `"Texto inicial do Currículo Lattes" e "Outras informações" deveriam ser os 2 últimos itens da lista — obtida: ${JSON.stringify(opcoes)}`);
});

test('Identificação: escolher o Tipo pela caixa de seleção (sem clicar em "Editar") mostra os dados já salvos, não em branco', async ({ page, baseUrl }) => {
    const items = [
        makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulana de Tal' }),
    ];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    // Abre um item novo em branco (não via link "Editar"), simulando o
    // relato do usuário: escolher Categoria/Tipo pelas caixas de seleção.
    await page.evaluate(() => window.AppCore.buildForm(undefined, { focus: true }));
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'DADOS_GERAIS');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'IDENTIFICACAO');
    await page.waitForTimeout(150);

    const nome = await page.locator('#dynFields input[name="titulo"]').inputValue();
    assertEqual(nome, 'Fulana de Tal', 'O campo Nome completo deveria vir preenchido com o valor já salvo de Identificação, não em branco');
});

test('Endereço: Tipo não tem opção em branco — só Residencial e Profissional (2 opções, sem "—")', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'DADOS_GERAIS');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'ENDERECO');
    await page.waitForTimeout(150);

    const opcoes = await page.$eval('#dynFields select[name="tipo"]', (sel) => Array.from(sel.options).map((o) => o.value));
    assertEqual(opcoes, ['Residencial', 'Profissional'], 'O Tipo do Endereço deveria ter só 2 opções, sem "—" em branco');
});

test('Endereço: 2 registros persistentes (1 Residencial + 1 Profissional) — abrir a tela já mostra o Tipo/dados salvos (mesmo comportamento de Identificação), sem ficar em branco', async ({ page, baseUrl }) => {
    const items = [
        makeItem('ENDERECO', 'DADOS_GERAIS', { tipo: 'Residencial', titulo: 'Rua Teste, 123' }),
    ];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.evaluate(() => window.AppCore.buildForm(undefined, { focus: true }));
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'DADOS_GERAIS');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'ENDERECO');
    await page.waitForTimeout(150);

    // Só existe 1 endereço salvo — abrir a tela já deveria mostrar o Tipo e
    // os dados dele, sem precisar escolher de novo (senão parece que o
    // cadastro não persistiu — mesmo problema já resolvido pra Identificação).
    const tipoInicial = await page.locator('#dynFields select[name="tipo"]').inputValue();
    assertEqual(tipoInicial, 'Residencial', 'Com só 1 endereço salvo, o Tipo já deveria vir selecionado sozinho');
    const tituloInicial = await page.locator('#dynFields input[name="titulo"]').inputValue();
    assertEqual(tituloInicial, 'Rua Teste, 123', 'O endereço já salvo deveria aparecer, sem precisar reescolher o Tipo');

    await page.selectOption('#dynFields select[name="tipo"]', 'Profissional');
    await page.waitForTimeout(150);
    const profissional = await page.locator('#dynFields input[name="titulo"]').inputValue();
    assertEqual(profissional, '', 'Escolher "Profissional" (sem endereço salvo ainda) deveria ficar em branco, sem herdar o do Residencial');

    await page.selectOption('#dynFields select[name="tipo"]', 'Residencial');
    await page.waitForTimeout(150);
    const residencial = await page.locator('#dynFields input[name="titulo"]').inputValue();
    assertEqual(residencial, 'Rua Teste, 123', 'Voltar pra "Residencial" deveria recarregar o endereço já salvo');
});

test('Endereço: salvar Residencial e depois Profissional mantém os 2 persistentes; salvar de novo o mesmo Tipo atualiza em vez de duplicar', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'DADOS_GERAIS');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'ENDERECO');
    await page.waitForTimeout(150);

    await page.selectOption('#dynFields select[name="tipo"]', 'Residencial');
    await page.waitForTimeout(150);
    await page.fill('#dynFields input[name="titulo"]', 'Rua A, 100');
    await page.click('#camposPanel button[type="submit"]');
    await page.waitForTimeout(300);

    await page.evaluate(() => window.AppCore.buildForm(undefined, { focus: true }));
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'DADOS_GERAIS');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'ENDERECO');
    await page.waitForTimeout(150);
    await page.selectOption('#dynFields select[name="tipo"]', 'Profissional');
    await page.waitForTimeout(150);
    await page.fill('#dynFields input[name="titulo"]', 'Av. B, 200');
    await page.click('#camposPanel button[type="submit"]');
    await page.waitForTimeout(300);

    let salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]').filter((i) => i.typeKey === 'ENDERECO'));
    assertEqual(salvo.length, 2, 'Deveriam existir 2 itens de Endereço (Residencial + Profissional)');

    // Reabre o Residencial e reescreve — deve ATUALIZAR o existente, não criar um 3º
    await page.evaluate(() => window.AppCore.buildForm(undefined, { focus: true }));
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'DADOS_GERAIS');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'ENDERECO');
    await page.waitForTimeout(150);
    await page.selectOption('#dynFields select[name="tipo"]', 'Residencial');
    await page.waitForTimeout(150);
    await page.fill('#dynFields input[name="titulo"]', 'Rua A, 100 - Apto 2');
    await page.click('#camposPanel button[type="submit"]');
    await page.waitForTimeout(300);

    salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]').filter((i) => i.typeKey === 'ENDERECO'));
    assertEqual(salvo.length, 2, 'Continuam só 2 itens de Endereço após reescrever o Residencial (atualiza, não duplica)');
    const resid = salvo.find((i) => i.fields.tipo === 'Residencial');
    assertEqual(resid && resid.fields.titulo, 'Rua A, 100 - Apto 2', 'O Residencial deveria estar atualizado');
    const prof = salvo.find((i) => i.fields.tipo === 'Profissional');
    assertEqual(prof && prof.fields.titulo, 'Av. B, 200', 'O Profissional não deveria ter sido afetado');
});

test('Foto de perfil usa o bloco padrão de evidências (upload de imagem), não mais um widget próprio', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'DADOS_GERAIS');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'FOTO_PERFIL');
    await page.waitForTimeout(150);

    const evidenceVisivel = await page.locator('#evidenceBlock').evaluate((el) => getComputedStyle(el).display !== 'none');
    assert(evidenceVisivel, 'O bloco padrão de evidências deveria aparecer para Foto de perfil');
    const accept = await page.locator('#pdfInput').getAttribute('accept');
    assertEqual(accept, 'image/jpeg,image/png', 'O input de arquivo deveria continuar restrito a JPEG/PNG');
});

test('Foto de perfil não tem mais o campo Descrição', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'DADOS_GERAIS');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'FOTO_PERFIL');
    await page.waitForTimeout(150);

    const camposTexto = await page.$eval('#dynFields', (el) => el.textContent.trim());
    assertEqual(camposTexto, '', 'Foto de perfil não deveria ter nenhum campo de texto (só a evidência/imagem)');
    assertEqual(await page.locator('#dynFields [name="titulo"]').count(), 0, 'O campo Descrição (titulo) não deveria mais existir em Foto de perfil');
});

test('Documentos pessoais: "Tipo de documento" inclui a opção Passaporte', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'DADOS_GERAIS');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'DOCUMENTO_PESSOAL');
    await page.waitForTimeout(150);

    const opcoes = await page.$eval('#dynFields select[name="tipoDoc"]', (sel) => Array.from(sel.options).map((o) => o.value));
    assert(opcoes.includes('Passaporte'), 'A lista de Tipo de documento deveria incluir "Passaporte"');
});

test('Outras informações relevantes: o campo Descrição não é obrigatório', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'DADOS_GERAIS');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'OUTRAS_INFO');
    await page.waitForTimeout(150);

    // Descrição fica em branco de propósito — se o campo ainda fosse
    // obrigatório, validateItemFields bloquearia o salvamento (nada iria
    // pro localStorage); confirmamos que ele passa direto.
    await page.click('#camposPanel button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]').find((i) => i.typeKey === 'OUTRAS_INFO'));
    assert(!!salvo, 'O item de Outras informações deveria ter sido salvo mesmo com Descrição em branco');
    assertEqual(salvo.fields.descricao, '', 'Descrição salva deveria ser uma string vazia');
});
