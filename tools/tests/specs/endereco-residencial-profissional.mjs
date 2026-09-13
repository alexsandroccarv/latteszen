/* ==========================================================================
   Regressão: "01. Dados gerais → Endereço" são 2 entradas únicas e exclusivas
   (1 Residencial + 1 Profissional, no total). Bug: depois de salvar um
   endereço, a tela reabre nele (`buildForm(item, ...)`) — o listener que troca
   os dados ao mudar o campo "Tipo" (wireSingletonScope) só era ligado quando
   NÃO havia um item explícito em edição, então nesse fluxo mais comum (acabou
   de salvar o Residencial e quer cadastrar/ver o Profissional em seguida, sem
   sair da tela) o campo Tipo mudava mas os dados continuavam do registro
   anterior — e salvar em seguida CORROMPIA esse registro (convertia o
   Residencial em Profissional) em vez de criar/editar o segundo registro.
   ========================================================================== */
import { test, assert, assertEqual, seedCatalog } from '../harness.mjs';

async function abrirEndereco(page) {
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'DADOS_GERAIS');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'ENDERECO');
    await page.waitForTimeout(150);
}

async function salvar(page) {
    await page.click('#camposPanel button[type="submit"]');
    await page.waitForTimeout(300);
}

test('Endereço: Tipo default é "Residencial", sem opção em branco', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirEndereco(page);
    const opcoes = await page.$eval('#dynFields select[name="tipo"]', (sel) => Array.from(sel.options).map((o) => o.value));
    assertEqual(opcoes, ['Residencial', 'Profissional'], 'Deveria ter só as 2 opções, sem "—" em branco');
    const valorInicial = await page.$eval('#dynFields select[name="tipo"]', (el) => el.value);
    assertEqual(valorInicial, 'Residencial', 'O valor inicial deveria ser Residencial');
});

test('Endereço: salvar Residencial e depois Profissional (trocando o Tipo, sem sair da tela) cria 2 registros distintos, sem corromper o 1º', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirEndereco(page);

    await page.fill('#dynFields input[name="titulo"]', 'Rua A, 100');
    await salvar(page);

    // A tela reabre no item recém-salvo (Residencial) — trocar o Tipo aqui,
    // SEM navegar pra outra categoria/tipo antes, é o fluxo real do usuário.
    await page.selectOption('#dynFields select[name="tipo"]', 'Profissional');
    await page.waitForTimeout(150);
    const tituloAoTrocar = await page.$eval('#dynFields input[name="titulo"]', (el) => el.value);
    assertEqual(tituloAoTrocar, '', 'Ao trocar pra Profissional (ainda sem registro), o formulário deveria ficar em branco');

    await page.fill('#dynFields input[name="titulo"]', 'Av. B, 200');
    await salvar(page);

    const catalogo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const enderecos = catalogo.filter((i) => i.typeKey === 'ENDERECO');
    assertEqual(enderecos.length, 2, 'Deveriam existir exatamente 2 registros de Endereço (Residencial + Profissional)');
    const residencial = enderecos.find((i) => i.fields.tipo === 'Residencial');
    const profissional = enderecos.find((i) => i.fields.tipo === 'Profissional');
    assert(residencial, 'O registro Residencial deveria continuar existindo');
    assert(profissional, 'O registro Profissional deveria ter sido criado');
    assertEqual(residencial.fields.titulo, 'Rua A, 100', 'O Residencial não deveria ter sido alterado/corrompido');
    assertEqual(profissional.fields.titulo, 'Av. B, 200', 'O Profissional deveria ter o endereço digitado');
});

test('Endereço: reabrir a tela do zero mostra o registro mais recente; trocar o Tipo alterna entre os dois já salvos', async ({ page, baseUrl }) => {
    const now = Date.now();
    const items = [
        { id: 'end-resid', createdAt: new Date(now - 2000).toISOString(), updatedAt: new Date(now - 2000).toISOString(), source: 'local',
          lattesItem: true, typeKey: 'ENDERECO', categoryKey: 'DADOS_GERAIS', fields: { tipo: 'Residencial', titulo: 'Rua A, 100' },
          evidencias: [], hasPdf: false, pdfName: null, fileExt: null, lattesRef: null },
        { id: 'end-prof', createdAt: new Date(now - 1000).toISOString(), updatedAt: new Date(now - 1000).toISOString(), source: 'local',
          lattesItem: true, typeKey: 'ENDERECO', categoryKey: 'DADOS_GERAIS', fields: { tipo: 'Profissional', titulo: 'Av. B, 200' },
          evidencias: [], hasPdf: false, pdfName: null, fileExt: null, lattesRef: null },
    ];
    await seedCatalog(page, baseUrl, items);
    await abrirEndereco(page);

    const tipoAoAbrir = await page.$eval('#dynFields select[name="tipo"]', (el) => el.value);
    const tituloAoAbrir = await page.$eval('#dynFields input[name="titulo"]', (el) => el.value);
    assertEqual(tipoAoAbrir, 'Profissional', 'Deveria abrir mostrando o registro mais recentemente atualizado (Profissional)');
    assertEqual(tituloAoAbrir, 'Av. B, 200', 'Deveria trazer os dados do Profissional');

    await page.selectOption('#dynFields select[name="tipo"]', 'Residencial');
    await page.waitForTimeout(150);
    assertEqual(await page.$eval('#dynFields input[name="titulo"]', (el) => el.value), 'Rua A, 100', 'Trocar pra Residencial deveria trazer o endereço já salvo dele');

    await page.selectOption('#dynFields select[name="tipo"]', 'Profissional');
    await page.waitForTimeout(150);
    assertEqual(await page.$eval('#dynFields input[name="titulo"]', (el) => el.value), 'Av. B, 200', 'Trocar de volta pra Profissional deveria trazer o endereço dele novamente');
});

test('Endereço: a evidência (comprovante) é por Tipo — trocar entre Residencial/Profissional troca a evidência exibida', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirEndereco(page);

    // Residencial: anexa um comprovante por link e salva.
    await page.fill('#dynFields input[name="titulo"]', 'Rua A, 100');
    await page.click('#btnEvUrl');
    await page.fill('#evUrlInput', 'https://exemplo.org/comprovante-residencial.pdf');
    await page.click('#evUrlAdd');
    await page.waitForTimeout(100);
    await salvar(page);

    const qtdEvEditing = () => page.evaluate(() => window.AppCore.state.evEditing.length);

    // Ainda no Residencial (tela reaberta): a evidência deveria continuar visível.
    assert((await qtdEvEditing()) >= 1, 'O comprovante do Residencial deveria continuar visível após salvar');

    // Troca pra Profissional: sem evidência ainda.
    await page.selectOption('#dynFields select[name="tipo"]', 'Profissional');
    await page.waitForTimeout(150);
    assertEqual(await qtdEvEditing(), 0, 'O Profissional (ainda não cadastrado) não deveria mostrar a evidência do Residencial');

    await page.fill('#dynFields input[name="titulo"]', 'Av. B, 200');
    await salvar(page);

    // Volta pro Residencial: a evidência dele deveria reaparecer.
    await page.selectOption('#dynFields select[name="tipo"]', 'Residencial');
    await page.waitForTimeout(150);
    assert((await qtdEvEditing()) >= 1, 'Voltar pro Residencial deveria mostrar a evidência dele de novo');
});
