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
   lattesZen — Painéis "já cadastrados" de Idiomas e Área de atuação (Catalogar)
   --------------------------------------------------------------------------
   Extraído de tab-catalogar.js (issue de refatoração) — estavam aninhados
   dentro de buildForm() por acidente de organização, sem usar nada do seu
   escopo além de state/$/$$/esc (AppCore) e LattesTypes (global);
   buildForm() em si é chamado via window.AppCore.buildForm (já publicado
   por tab-catalogar.js) em vez de importado, pra evitar um import
   circular entre os dois arquivos. Nenhuma mudança de conteúdo, só saiu
   do arquivo único original.
   ========================================================================== */
const { state, $, $$, esc, t, compararTexto } = window.AppCore;

        // Entre a seção de seleção do tipo e o formulário de cadastro do
        // idioma: lista os idiomas já cadastrados (ordem alfabética), cada
        // um com um link "Editar" que reabre o formulário naquele item —
        // ajuda a notar rapidamente um idioma repetido antes de tentar
        // recadastrá-lo (ver também o filtro do próprio seletor, acima).
        export function renderIdiomasCadastradosBlock(def, itemAtual) {
            const bloco = $('#idiomasCadastradosBlock');
            if (!bloco) return;
            const ehIdiomas = !!(def && def.key === 'IDIOMAS');
            if (!ehIdiomas) { bloco.classList.add('hidden'); bloco.innerHTML = ''; return; }
            const cadastrados = state.catalogo.items
                .filter(i => i.typeKey === 'IDIOMAS' && (!itemAtual || i.id !== itemAtual.id) && (i.fields || {}).titulo)
                .slice().sort((a, b) => compararTexto(a.fields.titulo, b.fields.titulo));
            if (!cadastrados.length) { bloco.classList.add('hidden'); bloco.innerHTML = ''; return; }
            bloco.classList.remove('hidden');
            bloco.innerHTML = `<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-3">
                <p class="text-xs font-semibold mb-1.5"><i aria-hidden="true" class="fa-solid fa-language mr-1"></i> ${esc(t('tab_catalogar_cadastrados.idiomas_titulo', 'Idiomas já cadastrados'))}</p>
                <ul class="text-sm space-y-1">${cadastrados.map(i => `<li class="flex items-center justify-between gap-2">
                    <span>${esc(i.fields.titulo)}</span>
                    <button type="button" data-editar-idioma="${esc(i.id)}" class="text-xs underline text-govbr-700 dark:text-unifesp-300">${esc(t('tab_catalogar_cadastrados.editar', 'Editar'))}</button>
                </li>`).join('')}</ul>
            </div>`;
            $$('[data-editar-idioma]', bloco).forEach(btn => {
                btn.addEventListener('click', () => {
                    const alvo = state.catalogo.items.find(i => i.id === btn.dataset.editarIdioma);
                    if (alvo) window.AppCore.buildForm(alvo, { focus: true });
                });
            });
        }

        // Troca a posição de duas Áreas de atuação (mantém a ordem relativa
        // dos demais itens do catálogo — só troca os dois objetos de lugar).
        // A ordem física em state.catalogo.items é o que a exportação Lattes usa como
        // SEQUENCIA-AREA-DE-ATUACAO (ver lattes-xml-export.js) — por isso o
        // reordenamento manual (▲▼), não um sort automático.
        function moveAreaAtuacao(id, dir) {
            const areas = state.catalogo.items.filter(i => i.typeKey === 'AREA_ATUACAO');
            const pos = areas.findIndex(i => i.id === id);
            const alvo = pos + dir;
            if (pos < 0 || alvo < 0 || alvo >= areas.length) return;
            const idxA = state.catalogo.items.indexOf(areas[pos]), idxB = state.catalogo.items.indexOf(areas[alvo]);
            const tmp = state.catalogo.items[idxA]; state.catalogo.items[idxA] = state.catalogo.items[idxB]; state.catalogo.items[idxB] = tmp;
            window.AppCore.saveCatalog();
        }
        // Entre a seção de seleção do tipo e o formulário de cadastro da área
        // de atuação: lista as já cadastradas, na ordem de exportação, com
        // ▲▼ pra reordenar (mesmo mecanismo que já existia em Configurações)
        // e um link "Editar" que reabre o formulário naquele item.
        export function renderAreaAtuacaoCadastradasBlock(def, itemAtual) {
            const bloco = $('#areaAtuacaoCadastradasBlock');
            if (!bloco) return;
            const ehArea = !!(def && def.key === 'AREA_ATUACAO');
            if (!ehArea) { bloco.classList.add('hidden'); bloco.innerHTML = ''; return; }
            const areas = state.catalogo.items.filter(i => i.typeKey === 'AREA_ATUACAO');
            if (!areas.length) { bloco.classList.add('hidden'); bloco.innerHTML = ''; return; }
            bloco.classList.remove('hidden');
            bloco.innerHTML = `<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-3">
                <p class="text-xs font-semibold mb-1.5"><i aria-hidden="true" class="fa-solid fa-list-ol mr-1"></i> ${esc(t('tab_catalogar_cadastrados.areas_titulo', 'Áreas de atuação já cadastradas — ▲▼ define a ordem de exportação'))}</p>
                <ul class="text-sm space-y-1">${areas.map((i, idx) => `<li class="flex items-center gap-2">
                    <button type="button" data-area-up="${esc(i.id)}" title="${esc(t('tab_catalogar_cadastrados.subir', 'Subir'))}" class="w-8 h-8 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 shrink-0 disabled:opacity-30" ${idx === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                    <button type="button" data-area-down="${esc(i.id)}" title="${esc(t('tab_catalogar_cadastrados.descer', 'Descer'))}" class="w-8 h-8 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 shrink-0 disabled:opacity-30" ${idx === areas.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                    <span class="flex-1 min-w-0 truncate">${esc(LattesTypes.itemTitle(i))}</span>
                    <button type="button" data-editar-area="${esc(i.id)}" class="text-xs underline text-govbr-700 dark:text-unifesp-300 shrink-0">${esc(t('tab_catalogar_cadastrados.editar', 'Editar'))}</button>
                </li>`).join('')}</ul>
            </div>`;
            $$('[data-area-up]', bloco).forEach(btn => btn.addEventListener('click', () => {
                moveAreaAtuacao(btn.dataset.areaUp, -1);
                renderAreaAtuacaoCadastradasBlock(def, itemAtual);
                window.AppCore.renderItemList();
            }));
            $$('[data-area-down]', bloco).forEach(btn => btn.addEventListener('click', () => {
                moveAreaAtuacao(btn.dataset.areaDown, 1);
                renderAreaAtuacaoCadastradasBlock(def, itemAtual);
                window.AppCore.renderItemList();
            }));
            $$('[data-editar-area]', bloco).forEach(btn => {
                btn.addEventListener('click', () => {
                    const alvo = state.catalogo.items.find(i => i.id === btn.dataset.editarArea);
                    if (alvo) window.AppCore.buildForm(alvo, { focus: true });
                });
            });
        }
