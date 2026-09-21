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
   lattesZen — Hidratação de i18n do shell estático (index.html)
   --------------------------------------------------------------------------
   index.html é HTML puro — não passa por nenhuma função JS que possa
   chamar t() na hora de montar o markup (ao contrário dos tab-*.js, que
   remontam seu HTML via innerHTML a cada render). Este módulo varre o
   documento uma única vez, no carregamento, trocando o texto/atributos
   marcados por data-i18n[-attrs] pelo valor de t() — o texto/atributo já
   escrito no HTML serve como o próprio `padrao` (fallback), então nada
   muda visualmente enquanto nenhum dicionário estiver carregado.
   Roda cedo (1º script do body, ver index.html) — os elementos acima já
   existem no DOM nesse ponto (scripts de módulo, mesmo sem defer, só
   executam depois do HTML anterior a eles já ter sido parseado).
   ========================================================================== */
import { t } from './i18n.js';

document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'), el.textContent);
});

// data-i18n-html: mesma ideia, mas para os poucos trechos com marcação
// confiável embutida (ex.: <strong>) — troca via innerHTML (não
// textContent, que perderia a marcação) usando o próprio HTML já escrito
// como padrão. Conteúdo sempre autoral (nunca dado do usuário).
document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.getAttribute('data-i18n-html'), el.innerHTML);
});

document.querySelectorAll('[data-i18n-attrs]').forEach((el) => {
    let map;
    try { map = JSON.parse(el.getAttribute('data-i18n-attrs')); } catch (_) { return; }
    Object.keys(map).forEach((attr) => {
        el.setAttribute(attr, t(map[attr], el.getAttribute(attr) || ''));
    });
});
