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
   lattesZen — Google Analytics (GA4), sob consentimento
   --------------------------------------------------------------------------
   Só carrega o gtag.js quando (a) APP_CONFIG.analyticsId (ver js/config.js)
   tiver um ID de mensuração real configurado — não o valor de exemplo
   "G-XXXXXXXXXX" nem vazio — e (b) o usuário tiver aceitado o aviso de
   cookies (ver js/cookie-consent.js, que bloqueia o uso do app até essa
   decisão). Sem "accepted" salvo, nenhuma requisição sai do navegador rumo
   ao Google.
   ========================================================================== */
(function () {
    const CONSENT_KEY = 'lz_cookie_consent';
    const ID = (window.APP_CONFIG && window.APP_CONFIG.analyticsId) || '';

    function idConfigurado() {
        return !!ID && ID !== 'G-XXXXXXXXXX';
    }

    function lerConsentimento() {
        try { return localStorage.getItem(CONSENT_KEY) || ''; } catch (e) { return ''; }
    }

    function carregarGtag() {
        if (document.querySelector('script[src*="googletagmanager.com"]')) return;
        const s = document.createElement('script');
        s.async = true;
        s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ID);
        document.head.appendChild(s);

        window.dataLayer = window.dataLayer || [];
        function gtag() { window.dataLayer.push(arguments); }
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', ID);
    }

    // Exposto para o aviso de cookies (js/cookie-consent.js) decidir quando
    // mostrar a barra e disparar o carregamento após "Aceitar".
    window.LzAnalytics = {
        idConfigurado,
        consentimentoAtual: lerConsentimento,
        aceitar() {
            try { localStorage.setItem(CONSENT_KEY, 'accepted'); } catch (e) {}
            if (idConfigurado()) carregarGtag();
        },
    };

    if (idConfigurado() && lerConsentimento() === 'accepted') carregarGtag();
})();
