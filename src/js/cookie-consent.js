/* ==========================================================================
   lattesZen — Aviso de cookies (consentimento para o Google Analytics)
   --------------------------------------------------------------------------
   Só aparece quando js/analytics.js reporta um ID de mensuração real
   configurado e ainda não há decisão salva (aceitar/recusar). Estilo em
   linha (não depende do Tailwind CDN) para funcionar mesmo se aquele
   recurso de terceiros não carregar.
   ========================================================================== */
(function () {
    function botao(rotulo, primario) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = rotulo;
        b.style.cssText = primario
            ? 'background:#1351B4;color:#fff;border:1px solid #1351B4;border-radius:6px;padding:8px 18px;cursor:pointer;font:inherit;font-weight:600'
            : 'background:transparent;color:#fff;border:1px solid #ADCDFF;border-radius:6px;padding:8px 18px;cursor:pointer;font:inherit';
        return b;
    }

    function montar() {
        if (!window.LzAnalytics || !window.LzAnalytics.idConfigurado()) return;
        if (window.LzAnalytics.consentimentoAtual()) return;

        const barra = document.createElement('div');
        barra.id = 'lzCookieBanner';
        barra.setAttribute('role', 'region');
        barra.setAttribute('aria-label', 'Aviso de cookies');
        barra.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#071D41;'
            + 'color:#fff;padding:16px 20px;display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center;'
            + 'justify-content:center;font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;'
            + 'box-shadow:0 -2px 10px rgba(0,0,0,.25)';

        const texto = document.createElement('p');
        texto.style.cssText = 'margin:0;max-width:640px;flex:1 1 320px';
        texto.innerHTML = 'Usamos o Google Analytics para entender o acesso a este site (não inclui o conteúdo '
            + 'do seu currículo, que fica só no seu navegador). '
            + '<a href="privacidade.html" style="color:#ADCDFF;text-decoration:underline" target="_blank" rel="noopener">'
            + 'Saiba mais na Política de Privacidade</a>.';

        const botoes = document.createElement('div');
        botoes.style.cssText = 'display:flex;gap:10px;flex:0 0 auto';

        const btnAceitar = botao('Aceitar', true);
        const btnRecusar = botao('Recusar', false);
        btnAceitar.id = 'lzCookieAceitar';
        btnRecusar.id = 'lzCookieRecusar';

        btnAceitar.addEventListener('click', () => { window.LzAnalytics.aceitar(); barra.remove(); });
        btnRecusar.addEventListener('click', () => { window.LzAnalytics.recusar(); barra.remove(); });

        botoes.appendChild(btnAceitar);
        botoes.appendChild(btnRecusar);
        barra.appendChild(texto);
        barra.appendChild(botoes);
        document.body.appendChild(barra);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', montar);
    } else {
        montar();
    }
})();
