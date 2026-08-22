/* ==========================================================================
   lattesZen — Cliente WebDAV (primitivas HTTP puras)
   --------------------------------------------------------------------------
   Camada fina sobre fetch(): PROPFIND/MKCOL/PUT/GET/DELETE/MOVE, autenticação
   Basic (usuário + senha de aplicativo). Não conhece a taxonomia do Lattes
   nem a estrutura de pastas do app — storage.js usa isto como back-end
   alternativo à File System Access API (pasta local).

   Observação importante: como é acesso cross-origin (o lattesZen roda num
   domínio, o servidor WebDAV é outro), o navegador exige que o servidor
   responda corretamente ao preflight CORS (OPTIONS) para os métodos/headers
   usados aqui. Nem todo servidor WebDAV faz isso — se a conexão falhar de
   forma que "parece rede", é provável que seja isso (ver `isNetworkError`).
   ========================================================================== */
window.WebDavClient = (function () {
    let cfg = null; // { baseUrl, username, password } — baseUrl sem barra final

    function configure(c) {
        cfg = c ? { ...c, baseUrl: String(c.baseUrl || '').replace(/\/+$/, '') } : null;
    }
    function isConfigured() { return !!cfg; }

    function authHeader() {
        const raw = `${cfg.username}:${cfg.password}`;
        // btoa só aceita Latin1 — o roteiro abaixo cobre acentos em usuário/senha via UTF-8→Latin1.
        return 'Basic ' + btoa(unescape(encodeURIComponent(raw)));
    }
    // Monta a URL absoluta de um caminho relativo à pasta configurada,
    // escapando cada segmento (evita depender de codificação manual do chamador).
    function urlFor(path) {
        const segs = String(path || '').split('/').filter(Boolean).map(encodeURIComponent);
        return segs.length ? `${cfg.baseUrl}/${segs.join('/')}` : cfg.baseUrl;
    }
    async function req(method, path, opts) {
        opts = opts || {};
        if (!cfg) throw new Error('WebDAV não configurado.');
        const headers = Object.assign({ Authorization: authHeader() }, opts.headers || {});
        let resp;
        try {
            resp = await fetch(urlFor(path), { method, headers, body: opts.body });
        } catch (e) {
            const err = new Error('Não foi possível conectar ao servidor WebDAV — verifique sua conexão ou se o servidor permite acesso a partir deste site (CORS).');
            err.isNetworkError = true;
            throw err;
        }
        if (opts.okStatuses && opts.okStatuses.includes(resp.status)) return resp;
        if (!resp.ok) {
            const err = new Error(`WebDAV: ${method} ${path || '/'} → HTTP ${resp.status}`);
            err.status = resp.status;
            throw err;
        }
        return resp;
    }

    /* ------------------------------ PROPFIND -------------------------------- */
    // Lista o conteúdo de uma coleção (Depth: 1) — [{ nome, isDir, tamanho }],
    // sem incluir a própria coleção consultada. `null` se o caminho não existe.
    async function propfind(path) {
        const resp = await req('PROPFIND', path, { headers: { Depth: '1', 'Content-Type': 'application/xml' }, okStatuses: [207, 404] });
        if (resp.status === 404) return null;
        const texto = await resp.text();
        const doc = new DOMParser().parseFromString(texto, 'application/xml');
        const respostas = Array.from(doc.getElementsByTagNameNS('DAV:', 'response'));
        const out = [];
        respostas.forEach((r, i) => {
            if (i === 0) return; // a própria coleção consultada, não um filho dela
            const href = r.getElementsByTagNameNS('DAV:', 'href')[0];
            if (!href) return;
            const isDir = r.getElementsByTagNameNS('DAV:', 'collection').length > 0;
            const tamanhoEl = r.getElementsByTagNameNS('DAV:', 'getcontentlength')[0];
            const nome = decodeURIComponent(href.textContent.replace(/\/+$/, '').split('/').pop());
            out.push({ nome, isDir, tamanho: tamanhoEl ? Number(tamanhoEl.textContent) : null });
        });
        return out;
    }
    // Existe (arquivo ou pasta)? PROPFIND Depth:0 na própria entrada.
    async function exists(path) {
        const resp = await req('PROPFIND', path, { headers: { Depth: '0', 'Content-Type': 'application/xml' }, okStatuses: [207, 404] });
        return resp.status === 207;
    }
    // Cria uma coleção (pasta) — 405/409 ("já existe", varia por servidor) são
    // aceitos como sucesso (idempotente).
    async function mkcol(path) {
        await req('MKCOL', path, { okStatuses: [201, 405, 409] });
    }
    // Cria toda a cadeia de pastas de um caminho ("A/B/C"), um segmento por vez
    // — MKCOL não cria pais que ainda não existam.
    async function mkcolRecursive(path) {
        const segs = String(path || '').split('/').filter(Boolean);
        let acumulado = '';
        for (const seg of segs) {
            acumulado = acumulado ? `${acumulado}/${seg}` : seg;
            await mkcol(acumulado);
        }
    }
    async function put(path, data) {
        await req('PUT', path, { body: data, okStatuses: [200, 201, 204] });
    }
    // `null` se o arquivo não existe; senão o conteúdo como Blob.
    async function get(path) {
        const resp = await req('GET', path, { okStatuses: [200, 404] });
        return resp.status === 404 ? null : await resp.blob();
    }
    async function del(path) {
        await req('DELETE', path, { okStatuses: [200, 204, 404] });
    }
    // MOVE nativo do WebDAV: renomeia/move um arquivo OU uma pasta inteira (com
    // todo o conteúdo) num único request — dispensa copiar item por item, como
    // é preciso fazer com a File System Access API local.
    async function move(fromPath, toPath, overwrite) {
        await req('MOVE', fromPath, { headers: { Destination: urlFor(toPath), Overwrite: overwrite ? 'T' : 'F' }, okStatuses: [201, 204] });
    }
    // Testa a conexão (credenciais + alcance do servidor) com um PROPFIND na raiz
    // configurada. Lança erro em caso de falha (credenciais, rede ou CORS).
    async function testConnection() {
        await req('PROPFIND', '', { headers: { Depth: '0', 'Content-Type': 'application/xml' }, okStatuses: [207] });
    }

    return { configure, isConfigured, propfind, exists, mkcol, mkcolRecursive, put, get, del, move, testConnection };
})();
