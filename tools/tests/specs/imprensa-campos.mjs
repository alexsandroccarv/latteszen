/* ==========================================================================
   Regressão: "19. Imprensa" — novos campos "Tipo de participação" e "Formato
   da aparição", e os 3 tipos de item renomeados pro "Tipo de item" pedido.
   --------------------------------------------------------------------------
   - Os 3 tipos existentes (Citação na Imprensa/Entrevistado/Outras) ganham
     os rótulos "Presença indireta/menção" / "Participação direta" /
     "Bastidores e assessoria de RP" — cada um já restringe sozinho quais
     opções de "Tipo de participação" fazem sentido (sem precisar de campo
     condicional em tempo de execução).
   - "Tipo de participação" e "Formato da aparição" ficam lado a lado, logo
     abaixo de "Título da matéria".
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

async function abrirImprensa(page, tipo) {
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'AL_IMPRENSA_CAT');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', tipo);
    await page.waitForTimeout(150);
}

test('Imprensa: "Tipo de item" mostra os 3 rótulos pedidos (Participação direta / Presença indireta-menção / Bastidores e assessoria de RP)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'AL_IMPRENSA_CAT');
    await page.waitForTimeout(150);

    const opcoes = await page.$eval('#selTipo', (sel) => Array.from(sel.options).map((o) => o.textContent.trim()).filter(Boolean));
    assert(opcoes.includes('Participação direta'), 'Deveria existir a opção "Participação direta"');
    assert(opcoes.includes('Presença indireta/menção'), 'Deveria existir a opção "Presença indireta/menção"');
    assert(opcoes.includes('Bastidores e assessoria de RP'), 'Deveria existir a opção "Bastidores e assessoria de RP"');
});

test('Imprensa: "Participação direta" — Tipo de participação tem só as 5 opções relacionadas', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirImprensa(page, 'AL_IMPRENSA_ENTREVISTADO');
    const opcoes = await page.$eval('#dynFields select[name="tipoParticipacao"]', (sel) => Array.from(sel.options).map((o) => o.value).filter(Boolean));
    assertEqual(opcoes, ['Entrevistado principal', 'Comentarista/Especialista', 'Articulista', 'Debatedor/Painelista', 'Porta-voz em coletiva'],
        'Tipo de participação de "Participação direta" deveria ter exatamente essas 5 opções');
});

test('Imprensa: "Presença indireta/menção" — Tipo de participação tem só as 5 opções relacionadas', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirImprensa(page, 'AL_IMPRENSA_CITACAO');
    const opcoes = await page.$eval('#dynFields select[name="tipoParticipacao"]', (sel) => Array.from(sel.options).map((o) => o.value).filter(Boolean));
    assertEqual(opcoes, ['Citado nominalmente', 'Citado via documento/estudo', 'Fotografado/Imagem', 'Objeto da pauta', 'Alvo de crítica/Contraditório'],
        'Tipo de participação de "Presença indireta/menção" deveria ter exatamente essas 5 opções');
});

test('Imprensa: "Bastidores e assessoria de RP" — Tipo de participação tem só as 4 opções relacionadas', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirImprensa(page, 'AL_IMPRENSA_OUTRA');
    const opcoes = await page.$eval('#dynFields select[name="tipoParticipacao"]', (sel) => Array.from(sel.options).map((o) => o.value).filter(Boolean));
    assertEqual(opcoes, ['Fonte em off/Background', 'Nota oficial', 'Sugestão de pauta/Pitching', 'Demanda não atendida'],
        'Tipo de participação de "Bastidores e assessoria de RP" deveria ter exatamente essas 4 opções');
});

test('Imprensa: "Formato da aparição" tem as 6 opções fixas, igual nos 3 tipos, ao lado de Tipo de participação', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    for (const tipo of ['AL_IMPRENSA_ENTREVISTADO', 'AL_IMPRENSA_CITACAO', 'AL_IMPRENSA_OUTRA']) {
        await abrirImprensa(page, tipo);
        const opcoes = await page.$eval('#dynFields select[name="formatoAparicao"]', (sel) => Array.from(sel.options).map((o) => o.value).filter(Boolean));
        assertEqual(opcoes, ['Texto (Aspas/Declaração)', 'Vídeo ao vivo', 'Vídeo gravado', 'Áudio (Podcast/Rádio)', 'Foto', 'Nota Oficial'],
            `Formato da aparição de ${tipo} deveria ter as 6 opções fixas`);
    }

    const mesmaLinha = await page.evaluate(() => {
        const a = document.querySelector('#dynFields [name="tipoParticipacao"]').closest('[data-field]');
        const b = document.querySelector('#dynFields [name="formatoAparicao"]').closest('[data-field]');
        return a && b && a.parentElement === b.parentElement;
    });
    assert(mesmaLinha, 'Tipo de participação e Formato da aparição deveriam ficar lado a lado (mesma linha)');
});

test('Imprensa: salvar grava Tipo de participação e Formato da aparição corretamente', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirImprensa(page, 'AL_IMPRENSA_ENTREVISTADO');

    await page.fill('#dynFields input[name="titulo"]', 'Matéria de teste');
    await page.selectOption('#dynFields select[name="tipoParticipacao"]', 'Comentarista/Especialista');
    await page.selectOption('#dynFields select[name="formatoAparicao"]', 'Áudio (Podcast/Rádio)');
    await page.fill('#dynFields input[name="entidade"]', 'Jornal Teste');
    await page.fill('#dynFields input[name="ano"]', '2024');
    await page.click('#camposPanel button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]').find((i) => i.typeKey === 'AL_IMPRENSA_ENTREVISTADO'));
    assert(salvo, 'O item de Imprensa deveria ter sido salvo');
    assertEqual(salvo.fields.tipoParticipacao, 'Comentarista/Especialista', 'Tipo de participação deveria ter sido salvo');
    assertEqual(salvo.fields.formatoAparicao, 'Áudio (Podcast/Rádio)', 'Formato da aparição deveria ter sido salvo');
});
