/* ==========================================================================
   lattesZen — Registro do Service Worker (PWA)
   --------------------------------------------------------------------------
   Silencioso se o navegador não suportar Service Worker, ou se o registro
   falhar — nunca deve travar o app (mesmo padrão tolerante a falha usado
   para as bibliotecas externas em index.html).

   sw.js já assume o controle rápido de uma versão nova (skipWaiting +
   clients.claim), mas isso só afeta as PRÓXIMAS requisições — o JS já
   carregado numa aba aberta continua rodando com os dados antigos em
   memória até a página recarregar. Sem isto, uma aba deixada aberta (ou um
   PWA instalado, reaberto sem fechar de vez) pode ficar presa numa versão
   desatualizada indefinidamente (ex.: categorias/critérios que mudaram).
   Por isso recarrega sozinho quando um novo Service Worker assume o
   controle — mas só se JÁ havia um controller antes (ou seja, é de fato
   uma atualização, não a primeira instalação/visita).
   ========================================================================== */
(function () {
    if (!('serviceWorker' in navigator)) return;
    const jaTinhaControlador = !!navigator.serviceWorker.controller;
    let recarregando = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!jaTinhaControlador || recarregando) return;
        recarregando = true;
        window.location.reload();
    });
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    });
})();
