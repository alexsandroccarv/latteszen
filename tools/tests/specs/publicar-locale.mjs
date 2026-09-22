// lattesZen — Copyright (C) 2026 Alexsandro Cardoso Carvalho
//
// This file is part of lattesZen.
//
// lattesZen is free software: you can redistribute it and/or modify it
// under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or (at
// your option) any later version.
//
// lattesZen is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public
// License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with lattesZen. If not, see <https://www.gnu.org/licenses/>.

/* ==========================================================================
   Regressão: a página pública do currículo (publish.js/renderHtml) segue o
   locale ativo do app no momento em que é gerada — <html lang>, rótulos de
   navegação/rodapé/estatísticas etc. Quem vê essa página é o visitante
   final (não necessariamente quem usa o app), mas o texto é gerado no
   momento da publicação, então acompanha o idioma da instalação nesse
   instante (ver nota no topo de publish.js).
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

async function gerarPreviaEmLocale(page, baseUrl, locale, items) {
    await page.goto(baseUrl + '/index.html');
    await page.evaluate((args) => {
        localStorage.setItem('lz_catalog', JSON.stringify(args.items));
        if (args.locale) localStorage.setItem('lz_settings', JSON.stringify({ locale: args.locale }));
    }, { items, locale });
    await page.reload();
    await page.waitForTimeout(500);
    await page.click('[data-tab="publicar"]');
    await page.waitForTimeout(200);
    await page.click('#btnPubPreview');
    await page.waitForTimeout(400);
    return page.$eval('#pubPreview', (el) => el.srcdoc);
}

test('Página pública em pt-br (padrão): <html lang="pt-BR"> e rótulos em português', async ({ page, baseUrl }) => {
    const items = [
        makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulana de Tal' }),
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Artigo Publicável', ano: '2024', periodico: 'Revista Teste' }),
    ];
    const srcdoc = await gerarPreviaEmLocale(page, baseUrl, null, items);
    assert(srcdoc.includes('<html lang="pt-BR">'), 'Em pt-br, a página pública deveria abrir com <html lang="pt-BR">');
    assert(srcdoc.includes('Voltar ao topo'), 'O botão de voltar ao topo deveria estar em português');
    assert(srcdoc.includes('Currículo acadêmico'), 'O "eyebrow" do cabeçalho deveria estar em português');
    assert(srcdoc.includes('Gerado com'), 'O rodapé deveria estar em português');
});

test('Página pública em "en": <html lang="en">, rótulos e rodapé em inglês', async ({ page, baseUrl }) => {
    const items = [
        makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'John Doe' }),
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Publishable Article', ano: '2024', periodico: 'Test Journal' }),
    ];
    const srcdoc = await gerarPreviaEmLocale(page, baseUrl, 'en', items);
    assert(srcdoc.includes('<html lang="en">'), 'Em "en", a página pública deveria abrir com <html lang="en">');
    assert(srcdoc.includes('Back to top'), 'O botão de voltar ao topo deveria estar em inglês');
    assert(srcdoc.includes('Academic résumé'), 'O "eyebrow" do cabeçalho deveria estar em inglês');
    assert(srcdoc.includes('Generated with'), 'O rodapé deveria estar em inglês');
    // Checa só o texto VISÍVEL (atributos title/aria-label do botão), não a
    // string inteira: o <script> embutido na página gerada tem comentários
    // de código em português (implementação, nunca visto por quem visita a
    // página) — string.includes("Voltar ao topo") pegaria até esses
    // comentários, um falso positivo que não indica nenhum vazamento real.
    assert(!srcdoc.includes('title="Voltar ao topo"') && !srcdoc.includes('aria-label="Voltar ao topo"'),
        'Não deveria sobrar nenhum rótulo VISÍVEL em português');
});

test('Página pública: item sem título não vaza o placeholder em português no locale errado', async ({ page, baseUrl }) => {
    const items = [
        makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'John Doe' }),
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { ano: '2024', periodico: 'Test Journal' }), // sem título
    ];
    const srcdoc = await gerarPreviaEmLocale(page, baseUrl, 'en', items);
    assert(srcdoc.includes('(untitled)'), 'Item sem título deveria mostrar o placeholder em inglês');
    assert(!srcdoc.includes('(sem título)'), 'Não deveria mostrar o placeholder em português');
});
