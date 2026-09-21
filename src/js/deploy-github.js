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
   lattesZen — Cliente GitHub (REST + Git Data API, sem backend)
   --------------------------------------------------------------------------
   Publica a página pública (Publicar na Web) direto num repositório do
   GitHub, para servir via GitHub Pages — usando um token de acesso pessoal
   colado pelo usuário (não há OAuth "de verdade" possível aqui sem backend:
   a troca do "code" por token do GitHub exige um client_secret, que não dá
   pra guardar com segurança num app estático servido ao navegador).

   Usa a Git Data API (blobs → tree → commit → ref) em vez da Contents API
   (um PUT por arquivo) pra publicar todos os arquivos num ÚNICO commit —
   evita deixar o site num estado parcial (ex.: index.html novo apontando
   pra uma imagem que ainda não chegou) se a rede cair no meio do envio.
   i18n (preparação): mensagens de erro voltadas ao usuário (lançadas via
   throw, exibidas depois num toast por quem chama) passam por
   window.AppCore.t — só chamadas em resposta a uma ação do usuário
   (nunca no carregamento do módulo), então window.AppCore já existe.
   ========================================================================== */
window.DeployGithub = (function () {
    const BASE = 'https://api.github.com';
    const t = (chave, padrao, vars) => window.AppCore.t(chave, padrao, vars);

    async function req(token, method, path, opts) {
        opts = opts || {};
        let resp;
        try {
            resp = await fetch(`${BASE}${path}`, {
                method,
                headers: Object.assign({ Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }, opts.headers || {}),
                body: opts.body,
            });
        } catch (e) {
            const err = new Error(t('deploy_github.erro_conexao', 'Não foi possível conectar ao GitHub — verifique sua conexão.'));
            err.isNetworkError = true;
            throw err;
        }
        if (opts.okStatuses && opts.okStatuses.includes(resp.status)) return resp;
        if (!resp.ok) {
            let msg = t('deploy_github.erro_http', 'GitHub: HTTP {status}', { status: resp.status });
            try { const j = await resp.json(); if (j && j.message) msg += ` — ${j.message}`; } catch (_) {}
            const err = new Error(msg);
            err.status = resp.status;
            throw err;
        }
        return resp;
    }

    // base64 seguro para texto UTF-8 (btoa só aceita Latin-1 direto)
    function textToBase64(str) { return btoa(unescape(encodeURIComponent(str))); }
    function bytesToBase64(bytes) {
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin);
    }
    async function toBase64(content) {
        if (typeof content === 'string') return textToBase64(content);
        const buf = content instanceof ArrayBuffer ? content : await content.arrayBuffer();
        return bytesToBase64(new Uint8Array(buf));
    }

    // Confere se o token enxerga o repositório (usado pelo botão "Testar
    // conexão" nas Configurações — falha cedo, com mensagem clara, em vez de
    // só na hora de publicar).
    async function checkRepo(token, owner, repo) {
        const resp = await req(token, 'GET', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { okStatuses: [200, 404] });
        if (resp.status === 404) throw new Error(t('deploy_github.erro_repo_nao_encontrado', 'Repositório "{repo}" não encontrado (ou o token não tem acesso a ele).', { repo: `${owner}/${repo}` }));
        return resp.json();
    }

    // Publica `files` (array de {path, content}, content string ou Blob/File)
    // num commit único no branch indicado — cria o branch (e o repositório,
    // se ainda estiver vazio) automaticamente quando necessário.
    async function publish({ token, owner, repo, branch, files, message }) {
        if (!token) throw new Error(t('deploy_github.erro_sem_token', 'Informe um token de acesso do GitHub.'));
        if (!owner || !repo) throw new Error(t('deploy_github.erro_sem_repo', 'Informe o repositório (dono/nome).'));
        if (!files || !files.length) throw new Error(t('deploy_comum.erro_nada_para_publicar', 'Nada para publicar.'));
        branch = (branch || 'gh-pages').trim() || 'gh-pages';

        let baseCommitSha = null, baseTreeSha = null;
        const refResp = await req(token, 'GET', `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`, { okStatuses: [200, 404] });
        if (refResp.status === 200) {
            const ref = await refResp.json();
            baseCommitSha = ref.object.sha;
            const commitResp = await req(token, 'GET', `/repos/${owner}/${repo}/git/commits/${baseCommitSha}`, { okStatuses: [200] });
            baseTreeSha = (await commitResp.json()).tree.sha;
        }

        const tree = [];
        for (const f of files) {
            const content = await toBase64(f.content);
            const blobResp = await req(token, 'POST', `/repos/${owner}/${repo}/git/blobs`, {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, encoding: 'base64' }),
                okStatuses: [201],
            });
            const blob = await blobResp.json();
            tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
        }

        const treeBody = { tree };
        if (baseTreeSha) treeBody.base_tree = baseTreeSha;
        const treeResp = await req(token, 'POST', `/repos/${owner}/${repo}/git/trees`, {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(treeBody),
            okStatuses: [201],
        });
        const newTree = await treeResp.json();

        const commitBody = { message: message || 'Publicar currículo — lattesZen', tree: newTree.sha };
        if (baseCommitSha) commitBody.parents = [baseCommitSha];
        const commitResp2 = await req(token, 'POST', `/repos/${owner}/${repo}/git/commits`, {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(commitBody),
            okStatuses: [201],
        });
        const newCommit = await commitResp2.json();

        if (baseCommitSha) {
            await req(token, 'PATCH', `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sha: newCommit.sha }),
                okStatuses: [200],
            });
        } else {
            await req(token, 'POST', `/repos/${owner}/${repo}/git/refs`, {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: newCommit.sha }),
                okStatuses: [201],
            });
        }

        // Tenta habilitar o GitHub Pages nesse branch — melhor esforço: exige
        // a permissão "Pages" no token (além de "Contents"), que é opcional;
        // sem ela, o commit já foi publicado normalmente, só não confirma a
        // URL de Pages automaticamente (o usuário habilita manualmente).
        let pagesUrl = null;
        try {
            const pagesGet = await req(token, 'GET', `/repos/${owner}/${repo}/pages`, { okStatuses: [200, 404] });
            if (pagesGet.status === 404) {
                const created = await req(token, 'POST', `/repos/${owner}/${repo}/pages`, {
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ build_type: 'legacy', source: { branch, path: '/' } }),
                    okStatuses: [201],
                });
                pagesUrl = (await created.json()).html_url || null;
            } else {
                pagesUrl = (await pagesGet.json()).html_url || null;
            }
        } catch (_) { /* segue sem confirmar a URL de Pages automaticamente */ }

        return { commitSha: newCommit.sha, commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`, pagesUrl };
    }

    return { checkRepo, publish };
})();
