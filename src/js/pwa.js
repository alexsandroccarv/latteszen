/* ==========================================================================
   lattesZen — Registro do Service Worker (PWA)
   --------------------------------------------------------------------------
   Silencioso se o navegador não suportar Service Worker, ou se o registro
   falhar — nunca deve travar o app (mesmo padrão tolerante a falha usado
   para as bibliotecas externas em index.html).
   ========================================================================== */
(function () {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    });
})();
