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

test('i18n: dicionário es está registrado (esqueleto, Etapa 1) — localeValido("es") não cai pro padrão, e t() devolve pt-br pra uma chave sem tradução', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const r = await page.evaluate(() => ({
        localesDisponiveis: window.LzI18n.localesDisponiveis(),
        nomeEs: window.LzI18n.nomeLocale('es'),
        setLocaleResultado: window.LzI18n.setLocale('es'),
        getLocaleDepois: window.LzI18n.getLocale(),
        // Chave inexistente (nunca terá tradução própria em nenhum dicionário)
        // — usada só pra confirmar o fallback pro padrão pt-br passado na chamada.
        valorSemTraducao: window.LzI18n.t('teste.chave.inexistente.es', 'Salvar'),
    }));
    assert(r.localesDisponiveis.includes('es'), 'localesDisponiveis() deveria incluir "es" (dicionário importado no bootstrap de i18n.js)');
    assertEqual(r.nomeEs, 'Español', 'nomeLocale("es") deveria devolver "Español"');
    assertEqual(r.setLocaleResultado, 'es', 'setLocale("es") não deveria cair pro padrão — "es" é um locale válido (tem entrada em DICIONARIOS)');
    assertEqual(r.getLocaleDepois, 'es', 'getLocale() deveria refletir "es" depois do setLocale');
    assertEqual(r.valorSemTraducao, 'Salvar', 'uma chave sem entrada em nenhum dicionário deve continuar caindo pro padrão pt-br passado na chamada');
});

test('i18n: com locale "es" persistido ANTES da carga da página, t() já devolve espanhol nas chaves da Etapa 2 (app.js/app-core.js/pdf-report.js/storage.js/lattes-xml.js)', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.evaluate(() => localStorage.setItem('lz_settings', JSON.stringify({ locale: 'es' })));
    await page.reload();
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => ({
        localeInicial: window.LzI18n.getLocale(),
        htmlLang: document.documentElement.getAttribute('lang'),
        appCoreEmailInvalido: window.LzI18n.t('app_core.email_invalido', 'E-mail inválido.'),
        appRestaurar: window.LzI18n.t('app.restaurar', 'Restaurar'),
        pdfReportAnexos: window.LzI18n.t('pdf_report.anexos', 'Anexos'),
        storagePastaProcessados: window.LzI18n.t('storage.pasta.processados', 'Processados'),
        lattesXmlInvalido: window.LzI18n.t('lattes_xml.invalido', 'XML inválido ou corrompido.'),
    }));
    assertEqual(r.localeInicial, 'es', 'Com locale "es" persistido, i18n.js deveria se inicializar já em "es" (bootstrap síncrono, antes de qualquer setLocale() explícito)');
    assertEqual(r.htmlLang, 'es', '<html lang> deveria refletir "es" já na carga inicial');
    assertEqual(r.appCoreEmailInvalido, 'Correo electrónico inválido.', 'Chave de validação (app-core.js) deveria vir traduzida');
    assertEqual(r.appRestaurar, 'Restaurar', 'Chave de app.js deveria vir traduzida (mesma grafia em es e pt-br, mas vindo do dicionário es)');
    assertEqual(r.pdfReportAnexos, 'Anexos', 'Chave de pdf-report.js deveria vir traduzida (mesma grafia em es e pt-br)');
    assertEqual(r.storagePastaProcessados, 'Procesados', 'Chave de storage.js deveria vir traduzida');
    assertEqual(r.lattesXmlInvalido, 'XML inválido o dañado.', 'Chave de lattes-xml.js deveria vir traduzida');
});

test('i18n: com locale "es" persistido ANTES da carga da página, t() já devolve espanhol nas chaves da Etapa 3 (taxonomia Lattes — lattes-types*.js)', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.evaluate(() => localStorage.setItem('lz_settings', JSON.stringify({ locale: 'es' })));
    await page.reload();
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => ({
        localeInicial: window.LzI18n.getLocale(),
        campoTitulo: window.LzI18n.t('campos.f_titulo.label', 'Título'),
        categoriaDadosGerais: window.LzI18n.t('lattes.categoria.DADOS_GERAIS.label', 'Dados gerais'),
        pastaCaixaEntrada: window.LzI18n.t('lattes.pasta.caixa_entrada', 'Caixa de Entrada'),
        tipoIdentificacao: window.LzI18n.t('lattes.tipo.IDENTIFICACAO.campo.cor_raca.label', 'Cor ou raça'),
        tipoFormacao: window.LzI18n.t('lattes.tipo.FORMACAO_ACADEMICA.label', 'Formação acadêmica/titulação'),
        tipoAtuacao: window.LzI18n.t('lattes.tipo.ATIV_ENSINO.label', 'Ensino'),
        tipoArtigo: window.LzI18n.t('lattes.tipo.ARTIGO_PERIODICO.label', 'Artigos completos publicados em periódicos'),
        tipoSoftware: window.LzI18n.t('lattes.tipo.SOFTWARE_SEM_REGISTRO.label', 'Programa de computador sem registro'),
        tipoArtesCenicas: window.LzI18n.t('lattes.tipo.ARTES_CENICAS.label', 'Artes cênicas'),
        tipoPatente: window.LzI18n.t('lattes.tipo.PATENTE.label', 'Patente'),
        tipoOrientacao: window.LzI18n.t('lattes.tipo.ORIENTACAO_CONCLUIDA.label', 'Orientações e supervisões concluídas'),
        tipoBanca: window.LzI18n.t('lattes.tipo.BANCA_JULGADORA.label', 'Participação em bancas de comissões julgadoras'),
        tipoAlemLattes: window.LzI18n.t('lattes.tipo.AL_LEITURA.label', 'Leituras e clubes do livro'),
        tipoRegistro: window.LzI18n.t('lattes.tipo.CONEXAO_SOCIAL.label', 'Redes sociais'),
    }));
    assertEqual(r.localeInicial, 'es', 'Com locale "es" persistido, i18n.js deveria se inicializar já em "es"');
    assertEqual(r.campoTitulo, 'Título', 'Chave de lattes-types-campos.js deveria vir traduzida (mesma grafia em es e pt-br)');
    assertEqual(r.categoriaDadosGerais, 'Datos generales', 'Categoria de lattes-types.js deveria vir traduzida');
    assertEqual(r.pastaCaixaEntrada, 'Bandeja de Entrada', 'Nome de pasta (lattes.pasta.*, definido em lattes-types.js) deveria vir traduzido nesta etapa');
    assertEqual(r.tipoIdentificacao, 'Color o raza', 'Chave de lattes-types-01-dados-gerais.js deveria vir traduzida');
    assertEqual(r.tipoFormacao, 'Formación académica/titulación', 'Chave de lattes-types-02-formacao.js deveria vir traduzida');
    assertEqual(r.tipoAtuacao, 'Docencia', 'Chave de lattes-types-03-atuacao.js deveria vir traduzida');
    assertEqual(r.tipoArtigo, 'Artículos completos publicados en revistas', 'Chave de lattes-types-05-producao-bibliografica.js deveria vir traduzida');
    assertEqual(r.tipoSoftware, 'Programa de computación sin registro', 'Chave de lattes-types-05-producao-tecnica.js deveria vir traduzida');
    assertEqual(r.tipoArtesCenicas, 'Artes escénicas', 'Chave de lattes-types-05-producao-artistica.js deveria vir traduzida');
    assertEqual(r.tipoPatente, 'Patente', 'Chave de lattes-types-06-07-patentes-registros.js deveria vir traduzida (mesma grafia)');
    assertEqual(r.tipoOrientacao, 'Direcciones y supervisiones concluidas', 'Chave de lattes-types-10-orientacoes.js deveria vir traduzida');
    assertEqual(r.tipoBanca, 'Participación en tribunales de comisiones evaluadoras', 'Chave de lattes-types-11-bancas.js deveria vir traduzida');
    assertEqual(r.tipoAlemLattes, 'Lecturas y clubes de lectura', 'Chave de lattes-types-12-15-alem-lattes.js deveria vir traduzida');
    assertEqual(r.tipoRegistro, 'Redes sociales', 'Chave de lattes-types-20-registros.js deveria vir traduzida');
});

test('i18n: com locale "es" persistido ANTES da carga da página, t() já devolve espanhol nas chaves da Etapa 4 (abas do app — tab-*.js, exceto RSC/Súmula)', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.evaluate(() => localStorage.setItem('lz_settings', JSON.stringify({ locale: 'es' })));
    await page.reload();
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => ({
        localeInicial: window.LzI18n.getLocale(),
        tabCatalogarSalvar: window.LzI18n.t('tab_catalogar.salvar', 'Salvar'),
        tabCatalogarCadastradosSubir: window.LzI18n.t('tab_catalogar_cadastrados.subir', 'Subir'),
        tabCatalogarEvidenciasRemover: window.LzI18n.t('tab_catalogar_evidencias.remover', 'Remover'),
        tabConfigTemaTitulo: window.LzI18n.t('tab_config.tema_titulo', 'Tema'),
        tabConfigSharedRscAjudaAria: window.LzI18n.t('tab_rsc.ajuda_aria', 'Ajuda'),
        tabConfigXmlTitulo: window.LzI18n.t('tab_config_xml.titulo', 'Lattes (XML)'),
        tabConfigOrcidTitulo: window.LzI18n.t('tab_config_orcid.titulo', 'ORCID (online)'),
        tabConfigBibtexTodos: window.LzI18n.t('tab_config_bibtex.todos', 'Todos'),
        tabConformidadeConformidade: window.LzI18n.t('tab_conformidade.conformidade', 'Conformidade'),
        tabLinhaTempoMais: window.LzI18n.t('tab_linha_tempo.mais', 'Mais'),
        tabPublicarGoogleDrive: window.LzI18n.t('tab_publicar.google_drive', 'Google Drive'),
        tabInicioCopiado: window.LzI18n.t('tab_inicio.copiado', 'Copiado!'),
    }));
    assertEqual(r.localeInicial, 'es', 'Com locale "es" persistido, i18n.js deveria se inicializar já em "es"');
    assertEqual(r.tabCatalogarSalvar, 'Guardar', 'Chave de tab-catalogar.js deveria vir traduzida');
    assertEqual(r.tabCatalogarCadastradosSubir, 'Subir', 'Chave de tab-catalogar-cadastrados.js deveria vir traduzida (mesma grafia em es e pt-br)');
    assertEqual(r.tabCatalogarEvidenciasRemover, 'Quitar', 'Chave de tab-catalogar-evidencias.js deveria vir traduzida');
    assertEqual(r.tabConfigTemaTitulo, 'Tema', 'Chave de tab-config.js deveria vir traduzida (mesma grafia em es e pt-br)');
    assertEqual(r.tabConfigSharedRscAjudaAria, 'Ayuda', 'Chave compartilhada (tab_rsc.ajuda_aria, usada em tab-config-shared.js) deveria vir traduzida');
    assertEqual(r.tabConfigXmlTitulo, 'Lattes (XML)', 'Chave de tab-config-xml.js deveria vir traduzida (mesma grafia em es e pt-br)');
    assertEqual(r.tabConfigOrcidTitulo, 'ORCID (en línea)', 'Chave de tab-config-orcid.js deveria vir traduzida');
    assertEqual(r.tabConfigBibtexTodos, 'Todos', 'Chave de tab-config-bibtex.js deveria vir traduzida (mesma grafia em es e pt-br)');
    assertEqual(r.tabConformidadeConformidade, 'Conformidad', 'Chave de tab-conformidade.js deveria vir traduzida');
    assertEqual(r.tabLinhaTempoMais, 'Más', 'Chave de tab-linha-tempo.js deveria vir traduzida');
    assertEqual(r.tabPublicarGoogleDrive, 'Google Drive', 'Chave de tab-publicar.js deveria vir traduzida (mesma grafia em es e pt-br)');
    assertEqual(r.tabInicioCopiado, '¡Copiado!', 'Chave de tab-inicio.js deveria vir traduzida');
});

test('i18n: com locale "es" persistido ANTES da carga da página, t() já devolve espanhol nas chaves da Etapa 5 (integrações — deploy/gdrive/cookie-consent/publish)', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.evaluate(() => localStorage.setItem('lz_settings', JSON.stringify({ locale: 'es' })));
    await page.reload();
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => ({
        localeInicial: window.LzI18n.getLocale(),
        deployGithubErroSemToken: window.LzI18n.t('deploy_github.erro_sem_token', 'Informe um token de acesso do GitHub.'),
        deployNetlifyErroSemToken: window.LzI18n.t('deploy_netlify.erro_sem_token', 'Informe um token de acesso do Netlify.'),
        gdriveDrivesCompartilhados: window.LzI18n.t('gdrive.picker_label_drives_compartilhados', 'Drives compartilhados'),
        cookiesAceitar: window.LzI18n.t('cookies.aceitar', 'Aceitar'),
        publishTituloPadrao: window.LzI18n.t('publish.titulo_padrao', 'Currículo'),
        publishTemaModerno: window.LzI18n.t('publish.tema.moderno.label', 'Moderno'),
    }));
    assertEqual(r.localeInicial, 'es', 'Com locale "es" persistido, i18n.js deveria se inicializar já em "es"');
    assertEqual(r.deployGithubErroSemToken, 'Indique un token de acceso de GitHub.', 'Chave de deploy-github.js deveria vir traduzida');
    assertEqual(r.deployNetlifyErroSemToken, 'Indique un token de acceso de Netlify.', 'Chave de deploy-netlify.js deveria vir traduzida');
    assertEqual(r.gdriveDrivesCompartilhados, 'Unidades compartidas', 'Chave de gdrive-client.js deveria vir traduzida');
    assertEqual(r.cookiesAceitar, 'Aceptar', 'Chave de cookie-consent.js deveria vir traduzida');
    assertEqual(r.publishTituloPadrao, 'Currículum', 'Chave de publish.js deveria vir traduzida ("Currículo" sozinho nunca é usado — regra do projeto)');
    assertEqual(r.publishTemaModerno, 'Moderno', 'Chave dinâmica de tema (publish.tema.${style}.label) deveria vir traduzida');
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

test('i18n: window.PAISES/IDIOMAS/SETORES são {value,label} — value sempre em português, label vem traduzido quando "en" já está persistido antes da carga', async ({ page, baseUrl }) => {
    // Mesma natureza do nome de pasta (ver wizard-idioma-reload.mjs):
    // window.PAISES/IDIOMAS/SETORES são computados UMA VEZ, no carregamento
    // de paises.js/idiomas.js/cnae.js (opcoes() chama t() então) — uma
    // troca de locale AO VIVO (setLocale() sem reload) não muda os labels
    // já calculados. Por isso o teste persiste "en" ANTES de carregar a
    // página (como o teste anterior, "com locale en persistido..."), em
    // vez de chamar setLocale('en') depois.
    await page.goto(baseUrl + '/index.html');
    const rPt = await page.evaluate(() => ({
        paisValor: window.PAISES[0].value, paisLabel: window.PAISES[0].label,
        idiomaValor: window.IDIOMAS.find(o => o.value === 'Inglês').value,
        setorLabel: window.SETORES[0].label,
        tamanhos: [window.PAISES.length, window.IDIOMAS.length, window.SETORES.length],
    }));
    assert(rPt.tamanhos[0] > 100, 'window.PAISES deveria ter mais de 100 países');
    assert(rPt.tamanhos[1] > 100, 'window.IDIOMAS deveria ter mais de 100 idiomas');
    assert(rPt.tamanhos[2] > 50, 'window.SETORES deveria ter mais de 50 setores');
    assertEqual(rPt.paisLabel, rPt.paisValor, 'em pt-br (sem dicionário próprio), o label deveria cair pro próprio valor (padrão de t())');

    await page.evaluate(() => localStorage.setItem('lz_settings', JSON.stringify({ locale: 'en' })));
    await page.reload();
    await page.waitForTimeout(500);
    const rEn = await page.evaluate(() => ({
        paisValor: window.PAISES[0].value, paisLabel: window.PAISES[0].label,
        idiomaValor: window.IDIOMAS.find(o => o.value === 'Inglês').value,
        setorLabel: window.SETORES[0].label,
    }));
    assertEqual(rEn.paisValor, rPt.paisValor, 'o VALOR do país não deveria mudar com o locale (mesma string em português, pra manter compatibilidade com o XML Lattes)');
    assertEqual(rEn.idiomaValor, rPt.idiomaValor, 'o VALOR do idioma não deveria mudar com o locale');
    assertEqual(rEn.paisLabel, 'Germany', 'o LABEL do 1º país (Alemanha) deveria vir traduzido em "en"');
    assertEqual(rEn.setorLabel, 'Public administration, defense and social security', 'o LABEL do 1º setor deveria vir traduzido em "en"');
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
