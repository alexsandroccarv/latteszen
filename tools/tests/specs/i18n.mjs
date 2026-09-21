/* ==========================================================================
   Regressão: infraestrutura de internacionalização (i18n.js)
   --------------------------------------------------------------------------
   Fase de preparação (o app continua só em português) — cobre o
   comportamento de t()/tp() em si: fallback pro texto embutido na chamada
   quando não há dicionário carregado, prioridade do dicionário quando
   registrado, interpolação de variáveis, plural (singular/"outros") e o
   fallback de setLocale() para um locale sem dicionário.
   ========================================================================== */
import { test, assert, assertEqual, seedCatalog } from '../harness.mjs';

test('i18n: t() devolve o texto padrão (pt-BR) quando não há dicionário carregado pra aquela chave', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const r = await page.evaluate(() => window.LzI18n.t('teste.chave.inexistente', 'Texto padrão em português'));
    assertEqual(r, 'Texto padrão em português', 'Sem dicionário carregado, t() deveria devolver o texto padrão embutido na chamada');
});

test('i18n: t() interpola variáveis via {nome}, sem depender de template string prévia', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const r = await page.evaluate(() => window.LzI18n.t('teste.saudacao', 'Olá, {nome}! Você tem {n} itens.', { nome: 'Ana', n: 3 }));
    assertEqual(r, 'Olá, Ana! Você tem 3 itens.', 'A interpolação {var} deveria substituir pelos valores passados em vars');
});

test('i18n: t() deixa uma variável não encontrada visível no texto (não some silenciosamente)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const r = await page.evaluate(() => window.LzI18n.t('teste.faltando', 'Valor: {y}', {}));
    assertEqual(r, 'Valor: {y}', 'Uma variável esperada e não passada deveria continuar visível no texto, como sinalização');
});

test('i18n: registrarDicionario() faz uma chave carregada ter prioridade sobre o texto padrão da chamada', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const r = await page.evaluate(() => {
        window.LzI18n.registrarDicionario('pt-br', { 'teste.prioridade': 'Texto do dicionário' });
        return window.LzI18n.t('teste.prioridade', 'Texto padrão da chamada');
    });
    assertEqual(r, 'Texto do dicionário', 'Uma entrada carregada no dicionário deveria vencer o texto padrão embutido na chamada');
});

test('i18n: registrarDicionario() faz merge — chamadas sucessivas não apagam chaves já carregadas', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const r = await page.evaluate(() => {
        window.LzI18n.registrarDicionario('pt-br', { 'teste.merge.a': 'A' });
        window.LzI18n.registrarDicionario('pt-br', { 'teste.merge.b': 'B' });
        return [window.LzI18n.t('teste.merge.a', 'padrao-a'), window.LzI18n.t('teste.merge.b', 'padrao-b')];
    });
    assertEqual(r, ['A', 'B'], 'Chaves de chamadas anteriores de registrarDicionario() não deveriam ser apagadas por uma chamada nova');
});

test('i18n: tp() escolhe a forma singular ("um") com n=1 e "outros" caso contrário', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const formas = { um: '{n} item', outros: '{n} itens' };
    const r = await page.evaluate((formas) => [
        window.LzI18n.tp('teste.plural', 1, formas),
        window.LzI18n.tp('teste.plural', 0, formas),
        window.LzI18n.tp('teste.plural', 2, formas),
        window.LzI18n.tp('teste.plural', -1, formas),
    ], formas);
    assertEqual(r, ['1 item', '0 itens', '2 itens', '-1 item'], 'tp() deveria usar "um" só quando |n| === 1, "outros" nos demais casos');
});

test('i18n: setLocale() cai pro padrão (pt-br) ao pedir um locale sem dicionário carregado', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const r = await page.evaluate(() => {
        const antes = window.LzI18n.getLocale();
        const resultado = window.LzI18n.setLocale('idioma-inexistente');
        const depois = window.LzI18n.getLocale();
        return { antes, resultado, depois };
    });
    assertEqual(r.antes, 'pt-br', 'O locale inicial deveria ser pt-br');
    assertEqual(r.resultado, 'pt-br', 'setLocale() para um locale sem dicionário deveria cair pro padrão (pt-br)');
    assertEqual(r.depois, 'pt-br', 'getLocale() deveria refletir o fallback pro padrão');
});

test('i18n: window.AppCore.t/tp existem e se comportam como window.LzI18n.t/tp (mesma instância, módulos de aba usam por aqui)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const r = await page.evaluate(() => ({
        tExiste: typeof window.AppCore.t === 'function',
        tpExiste: typeof window.AppCore.tp === 'function',
        valor: window.AppCore.t('teste.appcore', 'Texto via AppCore'),
    }));
    assert(r.tExiste, 'window.AppCore.t deveria existir (ponte pra i18n.js, mesmo padrão de state/esc/toast)');
    assert(r.tpExiste, 'window.AppCore.tp deveria existir');
    assertEqual(r.valor, 'Texto via AppCore', 'window.AppCore.t deveria se comportar como window.LzI18n.t');
});
