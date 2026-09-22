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

test('i18n: <html lang> reflete o locale ativo na carga inicial e é atualizado por setLocale()', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const r = await page.evaluate(() => {
        const inicial = document.documentElement.getAttribute('lang');
        window.LzI18n.setLocale('idioma-inexistente');
        const depoisFallback = document.documentElement.getAttribute('lang');
        return { inicial, depoisFallback };
    });
    assertEqual(r.inicial, 'pt-BR', '<html lang> deveria começar como pt-BR, refletindo o locale padrão (pt-br)');
    assertEqual(r.depoisFallback, 'pt-BR', 'setLocale() para um locale inválido cai pro padrão — <html lang> deveria seguir junto');
});

test('i18n: formatarData() formata data/hora no locale ativo (equivalente a toLocaleDateString/toLocaleString(\'pt-BR\'))', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const r = await page.evaluate(() => {
        const d = new Date('2026-09-21T14:32:10');
        return {
            data: window.LzI18n.formatarData(d),
            dataHora: window.LzI18n.formatarData(d, { dateStyle: 'short', timeStyle: 'medium' }),
        };
    });
    assertEqual(r.data, '21/09/2026', 'formatarData() sem opções deveria formatar como toLocaleDateString(\'pt-BR\')');
    assertEqual(r.dataHora, '21/09/2026, 14:32:10', 'formatarData() com dateStyle/timeStyle deveria formatar como toLocaleString(\'pt-BR\')');
});

test('i18n: formatarNumero() usa vírgula decimal (pt-BR) e não introduz separador de milhar', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const r = await page.evaluate(() => [
        window.LzI18n.formatarNumero(12.5),
        window.LzI18n.formatarNumero(12),
        window.LzI18n.formatarNumero(1234.5),
    ]);
    assertEqual(r, ['12,5', '12', '1234,5'], 'formatarNumero() deveria trocar "." por "," (pt-BR) sem agrupar milhares, igual ao antigo String(n).replace(\'.\', \',\')');
});

test('i18n: compararTexto() ordena texto pelo locale ativo (equivalente a localeCompare(x, \'pt-BR\'))', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const r = await page.evaluate(() => ['Économico', 'água', 'Zebra', 'Ávila'].sort((a, b) => window.LzI18n.compararTexto(a, b)));
    assertEqual(r, ['água', 'Ávila', 'Économico', 'Zebra'], 'compararTexto() deveria ordenar acentos/maiúsculas como localeCompare(x, \'pt-BR\')');
});

// Dicionário en (i18n-en.js): registrado direto em DICIONARIOS (não via
// registrarDicionario), então 'en' já precisa ser um locale válido desde o
// carregamento do módulo — inclusive quando é o locale persistido de quem
// abre o app (ver nota em i18n.js sobre a leitura síncrona de localStorage).
test('i18n: dicionário en existe, cobre chaves de vários módulos, e localeValido("en") não cai pro padrão', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const r = await page.evaluate(() => ({
        localesDisponiveis: window.LzI18n.localesDisponiveis(),
        nomeEn: window.LzI18n.nomeLocale('en'),
        setLocaleResultado: window.LzI18n.setLocale('en'),
        getLocaleDepois: window.LzI18n.getLocale(),
    }));
    assert(r.localesDisponiveis.includes('en'), 'localesDisponiveis() deveria incluir "en" (dicionário importado no bootstrap de i18n.js)');
    assertEqual(r.nomeEn, 'English', 'nomeLocale("en") deveria devolver "English"');
    assertEqual(r.setLocaleResultado, 'en', 'setLocale("en") não deveria cair pro padrão — "en" é um locale válido (tem dicionário)');
    assertEqual(r.getLocaleDepois, 'en', 'getLocale() deveria refletir "en" depois do setLocale');
});

test('i18n: com locale "en" persistido ANTES da carga da página, t() já devolve inglês em chaves de módulos diferentes (taxonomia, abas, core)', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.evaluate(() => localStorage.setItem('lz_settings', JSON.stringify({ locale: 'en' })));
    await page.reload();
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => ({
        localeInicial: window.LzI18n.getLocale(),
        htmlLang: document.documentElement.getAttribute('lang'),
        categoriaDadosGerais: window.LzI18n.t('lattes.categoria.DADOS_GERAIS.label', 'Dados gerais'),
        campoTitulo: window.LzI18n.t('campos.f_titulo.label', 'Título'),
        tabCatalogarSalvar: window.LzI18n.t('tab_catalogar.salvar', 'Salvar'),
        appCoreEmailInvalido: window.LzI18n.t('app_core.email_invalido', 'E-mail inválido.'),
        pastaCaixaEntrada: window.LzI18n.t('lattes.pasta.caixa_entrada', 'Caixa de Entrada'),
    }));
    assertEqual(r.localeInicial, 'en', 'Com locale "en" persistido, i18n.js deveria se inicializar já em "en" (bootstrap síncrono, antes de qualquer setLocale() explícito)');
    assertEqual(r.htmlLang, 'en', '<html lang> deveria refletir "en" já na carga inicial');
    assertEqual(r.categoriaDadosGerais, 'General Data', 'Categoria Lattes (taxonomia) deveria vir traduzida');
    assertEqual(r.campoTitulo, 'Title', 'Campo reutilizado (lattes-types-campos.js) deveria vir traduzido');
    assertEqual(r.tabCatalogarSalvar, 'Save', 'Chave de uma aba (tab-catalogar.js) deveria vir traduzida');
    assertEqual(r.appCoreEmailInvalido, 'Invalid e-mail.', 'Chave de validação (app-core.js) deveria vir traduzida');
    assertEqual(r.pastaCaixaEntrada, 'Inbox', 'Nome de pasta (lattes-types.js) deveria vir traduzido — só afeta pastas NOVAS, criadas com esse locale');
});

test('i18n: tp() com locale "en" escolhe singular/plural em inglês', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const r = await page.evaluate(() => {
        window.LzI18n.setLocale('en');
        return [
            window.LzI18n.tp('tab_linha_tempo.itens_contagem', 1, { um: '{n} item', outros: '{n} itens' }),
            window.LzI18n.tp('tab_linha_tempo.itens_contagem', 5, { um: '{n} item', outros: '{n} itens' }),
        ];
    });
    assertEqual(r, ['1 item', '5 items'], 'tp() em "en" deveria devolver as formas do dicionário en (singular sem "s", plural com "s"), não os padrões pt-BR passados na chamada');
});

test('i18n: resolveLista() em "en" cai pro pt-br (nenhuma lista PAISES/IDIOMAS/SETORES própria de "en" ainda existe)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const r = await page.evaluate(() => {
        window.LzI18n.setLocale('en');
        return window.LzI18n.resolveLista('PAISES').length;
    });
    assert(r > 100, 'resolveLista("PAISES") em "en" deveria cair pra lista pt-br (única existente) em vez de devolver vazio');
});

test('i18n: o seletor de idioma do assistente já oferece "English" (populado dinamicamente a partir de localesDisponiveis())', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const r = await page.evaluate(() => window.AppCore.localesDisponiveis().map(l => window.AppCore.nomeLocale(l)));
    assert(r.includes('English'), 'O seletor de idioma (wizLocale, populado via localesDisponiveis()/nomeLocale()) já deveria listar "English" sem nenhuma mudança de UI adicional');
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
