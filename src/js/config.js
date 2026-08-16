/* ==========================================================================
   lattesZen — Configuração global da aplicação
   ========================================================================== */
window.APP_CONFIG = {
    name: 'lattesZen',
    version: 'v0.2.0',
    lastModified: '16/08/2026',
    author: {
        nome: 'Alexsandro Cardoso Carvalho',
        github: 'https://github.com/alexsandroccarv',
    },
    repo: 'https://github.com/alexsandroccarv/lattesZen',
    license: {
        nome: 'AGPLv3',
        url: 'https://www.gnu.org/licenses/agpl-3.0.html',
    },
    // Chaves de armazenamento local
    storageKeys: {
        catalog: 'lz_catalog',       // índice de itens (backup em localStorage)
        settings: 'lz_settings',     // preferências gerais
        theme: 'tema',
        highContrast: 'altoContraste',
    },
};
