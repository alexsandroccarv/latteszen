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
   Regressão: limites de tamanho e extensões de evidência
   --------------------------------------------------------------------------
   checkEvidenceFile() só lê file.name/file.size/file.type — passamos
   objetos simples (sem alocar Blob/File de verdade) para testar os limites
   de 512MB/2048MB sem gastar memória real no navegador do teste.
   Compactados (zip/tar/gz/xz/7z) têm limite maior (2048MB) por
   costumarem empacotar várias evidências grandes num arquivo só; os
   demais (PDF, imagem, vídeo avulsos) ficam em 512MB.
   ========================================================================== */
import { test, assert, assertEqual, seedCatalog } from '../harness.mjs';

const MB = 1024 * 1024;

test('checkEvidenceFile: .tar.xz e .7z são aceitos como extensão (allowedExtsForAccept padrão)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const exts = await page.evaluate(() => window.AppCore.allowedExtsForAccept(window.AppCore.EVID_ACCEPT_DEFAULT));
    assert(exts.includes('xz'), 'A lista padrão de extensões deveria incluir "xz" (tar.xz)');
    assert(exts.includes('7z'), 'A lista padrão de extensões deveria incluir "7z"');
    assert(exts.includes('zip') && exts.includes('gz'), 'zip e gz (tar.gz) continuam aceitos');
});

test('checkEvidenceFile: compactados (zip/tar/gz/xz/7z) aceitam até 2048MB, recusam acima disso', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const r = await page.evaluate(({ MB }) => {
        const exts = window.AppCore.allowedExtsForAccept(window.AppCore.EVID_ACCEPT_DEFAULT);
        const dentro = ['arquivo.zip', 'arquivo.tar', 'arquivo.tar.gz', 'arquivo.tar.xz', 'arquivo.7z'].map(nome =>
            window.AppCore.checkEvidenceFile({ name: nome, size: 2048 * MB, type: '' }, exts));
        const fora = window.AppCore.checkEvidenceFile({ name: 'arquivo.zip', size: 2048 * MB + 1, type: '' }, exts);
        return { dentro, fora };
    }, { MB });
    r.dentro.forEach((erro, i) => assertEqual(erro, null, `Compactado de exatamente 2048MB (índice ${i}) não deveria ser recusado por tamanho`));
    assert(r.fora && r.fora.includes('2048'), 'Compactado acima de 2048MB deveria ser recusado, citando o limite de 2048MB');
});

test('checkEvidenceFile: arquivos não-compactados (PDF/imagem/vídeo) aceitam até 512MB, recusam acima disso', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const r = await page.evaluate(({ MB }) => {
        const exts = window.AppCore.allowedExtsForAccept(window.AppCore.EVID_ACCEPT_DEFAULT);
        const dentro = window.AppCore.checkEvidenceFile({ name: 'relatorio.pdf', size: 512 * MB, type: 'application/pdf' }, exts);
        const fora = window.AppCore.checkEvidenceFile({ name: 'relatorio.pdf', size: 512 * MB + 1, type: 'application/pdf' }, exts);
        const foraVideo = window.AppCore.checkEvidenceFile({ name: 'video.mp4', size: 513 * MB, type: 'video/mp4' }, exts);
        return { dentro, fora, foraVideo };
    }, { MB });
    assertEqual(r.dentro, null, 'PDF de exatamente 512MB não deveria ser recusado por tamanho');
    assert(r.fora && r.fora.includes('512'), 'PDF acima de 512MB deveria ser recusado, citando o limite de 512MB (não o de compactados)');
    assert(r.foraVideo && r.foraVideo.includes('512'), 'Vídeo acima de 512MB também usa o limite de 512MB, não o de compactados');
});
