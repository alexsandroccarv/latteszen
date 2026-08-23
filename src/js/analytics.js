/* ==========================================================================
   lattesZen — Google Analytics (GA4), opcional e desligado por padrão
   --------------------------------------------------------------------------
   Só carrega o gtag.js de verdade quando APP_CONFIG.analyticsId (ver
   js/config.js) for substituído pelo ID de mensuração real da propriedade
   GA4 ("G-XXXXXXXXXX"). Enquanto for o valor de exemplo (ou vazio), esta
   função não faz nada — nenhuma requisição sai do navegador, nenhum
   tráfego é enviado a propriedade nenhuma.
   ========================================================================== */
(function () {
    const ID = (window.APP_CONFIG && window.APP_CONFIG.analyticsId) || '';
    if (!ID || ID === 'G-XXXXXXXXXX') return; // ainda não configurado

    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ID);
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', ID);
})();
