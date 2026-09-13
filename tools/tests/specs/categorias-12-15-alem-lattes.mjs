/* ==========================================================================
   Regressão: "12. Desenvolvimento Pessoal e Habilidades", "13. Engajamento
   Comunitário e Cidadania", "14. Saúde, Esporte e Bem-Estar" e "15.
   Interesses, Cultura e Lazer" — listas de Tipo de item revisadas a pedido
   do usuário (só os tipos listados, em ordem alfabética dentro de cada
   categoria).
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog, abrirItens } from '../harness.mjs';

async function abrirCategoria(page, catKey) {
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', catKey);
    await page.waitForTimeout(150);
}

async function tiposDe(page, catKey) {
    await abrirCategoria(page, catKey);
    return page.$eval('#selTipo', (sel) => Array.from(sel.options).filter((o) => o.value).map((o) => o.textContent.trim()));
}

test('12. Desenvolvimento Pessoal e Habilidades: só os 3 tipos pedidos, em ordem alfabética', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const opcoes = await tiposDe(page, 'AL_DESENVOLVIMENTO');
    assertEqual(opcoes, ['Cursos livres e oficinas', 'Mentorias e grupos de estudos', 'Projetos pessoais e autoaprendizagem']);
});

test('13. Engajamento Comunitário e Cidadania: só os 4 tipos pedidos, em ordem alfabética', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const opcoes = await tiposDe(page, 'AL_ENGAJAMENTO');
    assertEqual(opcoes, ['Ativismo, conselhos e comitês', 'Atuação comunitária e associativa', 'Organização de iniciativas comunitárias', 'Voluntariado e ação social']);
});

test('14. Saúde, Esporte e Bem-Estar: só os 4 tipos pedidos, em ordem alfabética', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const opcoes = await tiposDe(page, 'AL_SAUDE_ESPORTE');
    assertEqual(opcoes, ['Atividades ao ar livre e ecoturismo', 'Competições e torneios amadores', 'Prática esportiva regular e treinos', 'Práticas corporais, integrativas e meditativas']);
});

test('15. Interesses, Cultura e Lazer: só os 12 tipos pedidos, em ordem alfabética', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const opcoes = await tiposDe(page, 'AL_INTERESSES');
    assertEqual(opcoes, [
        'Assistência a eventos esportivos e lutas (espectador)',
        'Cinema, mostras e festivais audiovisuais',
        'Colecionismo e acervos pessoais',
        'Espetáculos cênicos (teatro, dança e circo)',
        'Experiências gastronômicas e degustações',
        'Exposições artísticas, museus e galerias',
        'Feiras temáticas, convenções e festivais culturais',
        'Hobbies e trabalhos manuais',
        'Jogos de tabuleiro, eletrônicos e RPG',
        'Leituras e clubes do livro',
        'Shows, concertos e festivais musicais',
        'Viagens, turismo e rotas culturais',
    ]);
});

test('Novo tipo "Mentorias e grupos de estudos" (categoria 12) salva corretamente', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirCategoria(page, 'AL_DESENVOLVIMENTO');
    await page.selectOption('#selTipo', 'AL_MENTORIA');
    await page.waitForTimeout(150);
    await page.fill('#dynFields input[name="titulo"]', 'Grupo de estudos de teste');
    await page.click('#camposPanel button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]').find((i) => i.typeKey === 'AL_MENTORIA'));
    assert(salvo, 'O item de Mentorias e grupos de estudos deveria ter sido salvo');
    assertEqual(salvo.categoryKey, 'AL_DESENVOLVIMENTO', 'A categoria deveria ser AL_DESENVOLVIMENTO');
});

test('Novo tipo "Ativismo, conselhos e comitês" (categoria 13) salva corretamente', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirCategoria(page, 'AL_ENGAJAMENTO');
    await page.selectOption('#selTipo', 'AL_ATIVISMO');
    await page.waitForTimeout(150);
    await page.fill('#dynFields input[name="titulo"]', 'Conselho de teste');
    await page.click('#camposPanel button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]').find((i) => i.typeKey === 'AL_ATIVISMO'));
    assert(salvo, 'O item de Ativismo, conselhos e comitês deveria ter sido salvo');
});

test('Novo tipo "Shows, concertos e festivais musicais" (categoria 15) salva corretamente', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirCategoria(page, 'AL_INTERESSES');
    await page.selectOption('#selTipo', 'AL_MUSICA');
    await page.waitForTimeout(150);
    await page.fill('#dynFields input[name="titulo"]', 'Show de teste');
    await page.click('#camposPanel button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]').find((i) => i.typeKey === 'AL_MUSICA'));
    assert(salvo, 'O item de Shows, concertos e festivais musicais deveria ter sido salvo');
});

test('Tipos legados (AL_IDIOMAS, AL_TREINAMENTO, AL_CULTURAL) continuam definidos, mas fora da lista selecionável', async ({ page, baseUrl }) => {
    // Itens já catalogados com esses tipos legados continuam existindo e
    // sendo exibidos normalmente — só não aparecem mais como opção pra criar
    // um item NOVO (mesmo padrão já usado antes pra DOC_IDENTIDADE/DOC_PASSAPORTE).
    const items = [
        makeItem('AL_IDIOMAS', 'AL_DESENVOLVIMENTO', { titulo: 'Espanhol' }),
        makeItem('AL_CULTURAL', 'AL_INTERESSES', { titulo: 'Experiência antiga' }),
    ];
    await seedCatalog(page, baseUrl, items);

    const opcoesDesenv = await tiposDe(page, 'AL_DESENVOLVIMENTO');
    assert(!opcoesDesenv.includes('Idiomas e proficiências'), '"Idiomas e proficiências" não deveria mais ser uma opção selecionável');
    assert(!opcoesDesenv.includes('Treinamentos e workshops'), '"Treinamentos e workshops" não deveria mais ser uma opção selecionável');

    const opcoesInteresses = await tiposDe(page, 'AL_INTERESSES');
    assert(!opcoesInteresses.includes('Experiências culturais'), '"Experiências culturais" não deveria mais ser uma opção selecionável');

    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(200);
    await abrirItens(page);
    const texto = await page.$eval('#tab-conformidade', (el) => el.textContent);
    assert(texto.includes('Espanhol') && texto.includes('Experiência antiga'), 'Itens já catalogados com tipos legados deveriam continuar aparecendo normalmente');
});
