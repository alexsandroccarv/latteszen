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
   lattesZen — Aviso de cookies (consentimento obrigatório para o Google
   Analytics)
   --------------------------------------------------------------------------
   Só aparece quando js/analytics.js reporta um ID de mensuração real
   configurado e o usuário ainda não aceitou. Enquanto não aceitar, um
   overlay cobre a página inteira e bloqueia qualquer interação com o app —
   não existe botão "Recusar": ou aceita, ou fica travado (o Analytics só
   é opcional para quem administra a instância, apagando o ID de
   config.js — não para quem já está usando uma instância com ID
   configurado). Estilo em linha (não depende do Tailwind CDN) pra
   funcionar mesmo se aquele recurso de terceiros não carregar.
   i18n (preparação): label/texto passam por t(). Este arquivo roda ANTES
   de app-core.js na ordem dos <script> em index.html (ver comentário
   acima) — não pode depender de window.AppCore.t existir a tempo, por
   isso importa t() direto, mesmo padrão de lattes-types-*.js.
   ========================================================================== */
import { t } from './i18n.js';
(function () {
    function montar() {
        if (!window.LzAnalytics || !window.LzAnalytics.idConfigurado()) return;
        if (window.LzAnalytics.consentimentoAtual() === 'accepted') return;

        const overlay = document.createElement('div');
        overlay.id = 'lzCookieOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(7,29,65,.6)';

        const barra = document.createElement('div');
        barra.id = 'lzCookieBanner';
        barra.setAttribute('role', 'alertdialog');
        barra.setAttribute('aria-modal', 'true');
        barra.setAttribute('aria-label', t('cookies.aria_label', 'Aviso de cookies'));
        barra.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#071D41;'
            + 'color:#fff;padding:16px 20px;display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center;'
            + 'justify-content:center;font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;'
            + 'box-shadow:0 -2px 10px rgba(0,0,0,.25)';

        const texto = document.createElement('p');
        texto.style.cssText = 'margin:0;max-width:640px;flex:1 1 320px';
        // Sem link pra "Política de Privacidade" aqui: a página dela também
        // fica bloqueada pelo mesmo overlay (o consentimento ainda não foi
        // decidido), então um link pra lá, dentro do próprio bloqueio, não
        // levaria a lugar nenhum.
        texto.textContent = t('cookies.texto', 'Usamos o Google Analytics para entender o acesso a este site (não inclui o conteúdo '
            + 'do seu currículo, que fica só no seu navegador).');

        const btnAceitar = document.createElement('button');
        btnAceitar.type = 'button';
        btnAceitar.id = 'lzCookieAceitar';
        btnAceitar.textContent = t('cookies.aceitar', 'Aceitar');
        btnAceitar.style.cssText = 'background:#1351B4;color:#fff;border:1px solid #1351B4;border-radius:6px;'
            + 'padding:8px 18px;cursor:pointer;font:inherit;font-weight:600;flex:0 0 auto';

        // Trava o scroll do documento por trás do overlay enquanto a decisão
        // não é tomada — sem isto, roda do mouse ainda passaria por baixo.
        const overflowAnterior = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'hidden';

        function aceitar() {
            window.LzAnalytics.aceitar();
            document.documentElement.style.overflow = overflowAnterior;
            if (liberarFoco) liberarFoco();
            overlay.remove();
            barra.remove();
        }
        btnAceitar.addEventListener('click', aceitar);

        barra.appendChild(texto);
        barra.appendChild(btnAceitar);
        document.body.appendChild(overlay);
        document.body.appendChild(barra);

        // Sem "Recusar" de propósito (ver comentário do arquivo): o overlay
        // já bloqueia o mouse, e a armadilha de foco garante que quem
        // navega só por teclado/leitor de tela fique igualmente bloqueado
        // (Tab não escapa pro app por trás) até decidir — sem isso, o
        // aria-modal="true" da barra seria só decorativo.
        const liberarFoco = window.LzA11y && window.LzA11y.trapFocus(barra, { onEscape: null, initialFocus: btnAceitar });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', montar);
    } else {
        montar();
    }
})();
