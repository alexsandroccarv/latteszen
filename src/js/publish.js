/* ==========================================================================
   lattesZen — Publicação: gera a página pública do currículo (1 arquivo)
   --------------------------------------------------------------------------
   window.LzPublish.renderHtml(model, style) devolve uma STRING com um
   documento HTML autossuficiente (CSS + JS inline, assets em base64). "style"
   é a chave de um tema (paleta de cores) em THEMES — ver LzPublish.styles e
   LzPublish.styleLabel(). O "model" é montado no app (tab-publicar.js), que
   lê os dados do catálogo e embute a foto e as evidências marcadas como
   "públicas" em base64.

   Estrutura do model:
   {
     nome, tagline, bio, foto(dataUri|null), iniciais, local,
     areasAtuacao: [string],
     orcid, orcidUrl, lattesUrl,
     contatos: [{ grupo, plataforma, url, usuario }],
     outras: string|null,
     nuvemPalavras: [[palavra, frequência]] | null,
     linhaTempo: { anoMin, anoMax, categorias: [{ label, porAno:{ano:qtd} }] } | null,
     secoes: [{ id, num, label, icon, tipos: [{ label, itens:
        [{ titulo, ano, linha, anexos:[{ name, ext, dataUri }] }] }] }],
     geradoEm, totalItens
   }
   nuvemPalavras/linhaTempo espelham a mesma lógica da aba Linha do tempo do
   app (ver TabLinhaTempo.contarPalavras/contarPorCategoriaEAno em
   tab-linha-tempo.js), computados só sobre os itens que também aparecem em
   "secoes" — nunca vazam dado fora do filtro de privacidade da página.

   Ordem da página: masthead (foto + nome) → introdução (contatos + mini-bio)
   → nuvem de palavras → linha do tempo → itens do currículo (recolhidos por
   categoria).

   Design: tratamento editorial-acadêmico. Sem webfonts (arquivo offline e
   self-contained) — pilha serifada de sistema para display, sans para corpo.
   Dinamismo sóbrio: count-up, reveal no scroll, índice ativo — tudo sob
   prefers-reduced-motion.
   ========================================================================== */
window.LzPublish = (function () {
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // Ícones SVG (traço, currentColor) — substituem emojis por um traço editorial.
    const IC = {
        pin: '<svg class="ic" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11z"/><circle cx="12" cy="10" r="2.4"/></svg>',
        arrow: '<svg class="ic" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>',
        moon: '<svg class="ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>',
        printer: '<svg class="ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="9" rx="1.5"/><path d="M7 14h10v6H7z"/></svg>',
        search: '<svg class="ic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.4-3.4"/></svg>',
        up: '<svg class="ic" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V6"/><path d="m6 12 6-6 6 6"/></svg>',
        paper: '<svg class="ic" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
        image: '<svg class="ic" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="m21 16-5-5L5 20"/></svg>',
        link: '<svg class="ic" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 0 1 0 10h-2"/><path d="M8 12h8"/></svg>',
        chevron: '<svg class="ic chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    };

    // Evidência como ícone puro (sem nome visível) — nome vai no title/aria-label.
    function anexoHtml(a) {
        if (a.url) {
            return `<a class="anexo" href="${esc(a.url)}" target="_blank" rel="noopener" title="${esc(a.name)}" aria-label="${esc(a.name)}">${IC.link}</a>`;
        }
        const img = /^(jpe?g|png|gif|webp)$/i.test(a.ext);
        return `<a class="anexo" href="${a.dataUri}" target="_blank" rel="noopener" ${img ? '' : `download="${esc(a.name)}"`} title="${esc(a.name)}" aria-label="${esc(a.name)}">${img ? IC.image : IC.paper}</a>`;
    }

    // Linha do item: ano — título — ícones de evidência, todos na mesma
    // linha; descrição/detalhamento (linha) abaixo, só quando existir.
    function itemHtml(it) {
        const anexos = (it.anexos && it.anexos.length)
            ? `<div class="anexos">${it.anexos.map(anexoHtml).join('')}</div>` : '';
        return `<li class="item" data-search="${esc(((it.titulo || '') + ' ' + (it.linha || '')).toLowerCase())}">
            <div class="item-row">
                ${it.ano ? `<span class="year">${esc(it.ano)}</span>` : ''}
                <p class="item-title">${esc(it.titulo || '(sem título)')}</p>
                ${anexos}
            </div>
            ${it.linha ? `<p class="item-meta">${esc(it.linha)}</p>` : ''}
        </li>`;
    }

    function tipoHtml(t) {
        if (!t.itens || !t.itens.length) return '';
        return `<div class="tipo">
            <h3 class="tipo-label">${esc(t.label)}<span class="count">${t.itens.length}</span></h3>
            <ul class="items">${t.itens.map(itemHtml).join('')}</ul>
        </div>`;
    }

    // Seção como "cortina": recolhida por padrão, os itens só aparecem ao
    // clicar no cabeçalho (<details>/<summary> nativos — acessível e sem
    // depender de JS para abrir).
    function secaoHtml(s) {
        const tipos = (s.tipos || []).map(tipoHtml).join('');
        if (!tipos) return '';
        return `<section id="${s.id}" class="secao reveal">
            <details class="secao-details">
                <summary class="secao-head">
                    ${s.num ? `<span class="secao-num">${esc(s.num)}</span>` : ''}
                    <span class="secao-title" role="heading" aria-level="2">${esc(s.label)}</span>
                    ${IC.chevron}
                </summary>
                <div class="secao-body">${tipos}</div>
            </details>
        </section>`;
    }

    function contatoBtn(c) {
        return `<a class="contato" href="${esc(c.url)}" target="_blank" rel="noopener" title="${esc(c.plataforma)}${c.usuario ? ' · ' + esc(c.usuario) : ''}">
            <span>${esc(c.plataforma)}</span>${IC.arrow}</a>`;
    }

    // Amplitude de anos (para a estatística "Período")
    function yearRange(m) {
        let lo = Infinity, hi = -Infinity;
        (m.secoes || []).forEach(s => (s.tipos || []).forEach(t => (t.itens || []).forEach(it => {
            const mm = String(it.ano == null ? '' : it.ano).match(/\d{4}/);
            if (mm) { const y = +mm[0]; if (y < lo) lo = y; if (y > hi) hi = y; }
        })));
        return (lo <= hi) ? { lo, hi } : null;
    }

    // Nível de intensidade (0-4, estilo GitHub) — mesma escala usada pela aba
    // Linha do tempo do app (ver TabLinhaTempo.nivel em tab-linha-tempo.js);
    // duplicada aqui (função pura, 6 linhas) pra manter publish.js sem
    // depender de outro módulo em tempo de geração.
    function nivel(n, max) {
        if (!n) return 0;
        if (!max) return 1;
        const r = n / max;
        if (r > 0.75) return 4;
        if (r > 0.5) return 3;
        if (r > 0.25) return 2;
        return 1;
    }

    // Nuvem de palavras: mesma fórmula de tamanho da aba Linha do tempo do
    // app; o posicionamento em espiral roda no navegador do visitante (ver
    // <script> no fim de renderHtml), porque depende do tamanho real dos
    // <span> já renderizados.
    function nuvemHtml(m) {
        const palavras = m.nuvemPalavras;
        if (!palavras || !palavras.length) return '';
        const max = palavras[0][1], min = palavras[palavras.length - 1][1];
        const tam = (n) => (max === min ? 1.15 : 0.8 + ((n - min) / (max - min)) * 1.3).toFixed(2);
        const spans = palavras.map(([w, n]) => `<span class="nuvem-w" style="font-size:${tam(n)}rem" title="${esc(w)}: ${n} ocorrência${n === 1 ? '' : 's'}">${esc(w)}</span>`).join('');
        return `<section id="nuvem" class="secao secao-simples reveal">
            <h2 class="secao-simples-title">Nuvem de palavras</h2>
            <div id="nuvemPub" class="nuvem">${spans}</div>
        </section>`;
    }

    // Linha do tempo: mapa de calor por categoria × ano — mesma estrutura de
    // duas tabelas (rótulos fora da área rolável) usada na aba do app, pra
    // que a rolagem horizontal fique restrita aos anos (ver tab-linha-tempo.js).
    function linhaTempoHtml(m) {
        const lt = m.linhaTempo;
        if (!lt || !lt.categorias || !lt.categorias.length) return '';
        const anos = [];
        for (let y = lt.anoMax; y >= lt.anoMin; y--) anos.push(y);
        let max = 0;
        lt.categorias.forEach(c => Object.values(c.porAno).forEach(n => { if (n > max) max = n; }));

        const headCells = anos.map(y => `<th>${y}</th>`).join('');
        const labelRows = lt.categorias.map(c => `<tr class="gt-row"><th>${esc(c.label)}</th></tr>`).join('');
        const dataRows = lt.categorias.map(c => {
            const cells = anos.map(y => {
                const n = c.porAno[y] || 0;
                const titulo = `${c.label} — ${y}: ${n} ite${n === 1 ? 'm' : 'ns'}`;
                return `<td><div class="gt-cell" style="background:var(--heat-${nivel(n, max)})" title="${esc(titulo)}"></div></td>`;
            }).join('');
            return `<tr class="gt-row">${cells}</tr>`;
        }).join('');
        const legend = [0, 1, 2, 3, 4].map(i => `<span class="sq" style="background:var(--heat-${i})"></span>`).join('');

        return `<section id="tempo" class="secao secao-simples reveal">
            <h2 class="secao-simples-title">Linha do tempo</h2>
            <div class="grade-tempo-wrap">
                <table class="grade-tempo-labels"><thead><tr class="gt-row"><th>&nbsp;</th></tr></thead><tbody>${labelRows}</tbody></table>
                <div class="grade-tempo-scroll"><table class="grade-tempo-anos"><thead><tr class="gt-row">${headCells}</tr></thead><tbody>${dataRows}</tbody></table></div>
            </div>
            <div class="grade-tempo-legend"><span>Menos</span>${legend}<span>Mais</span></div>
        </section>`;
    }

    // Paletas de cor ("temas") escolhíveis em Publicar na Web — cada uma só
    // define os TOKENS (cores + fontes); todos os componentes abaixo (em
    // BASE_CSS) usam exclusivamente var(--token), nunca uma cor fixa, então
    // trocar de tema não exige duplicar nenhuma regra de layout.
    const THEMES = {
        elegante: {
            label: 'Editorial (padrão)',
            light: {
                paper: '#f7f8fa', surface: '#ffffff', ink: '#16202e', muted: '#5b6675', faint: '#8792a1',
                line: '#e5e8ee', accent: '#123b6b', 'accent-2': '#1c5aa8', gold: '#a67c3d', chip: '#eef2f7',
                'hero-bg': '#10243f', 'hero-ink': '#eef3f9', 'hero-soft': 'rgba(238,243,249,.72)', 'hero-line': 'rgba(238,243,249,.16)',
                shadow: '0 1px 2px rgba(16,24,40,.05),0 8px 24px -12px rgba(16,24,40,.14)',
                'heat-0': '#eef1f6', 'heat-1': '#cfe0f2', 'heat-2': '#9cc2e8', 'heat-3': '#5a94d1', 'heat-4': '#123b6b',
                serif: '"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,"Times New Roman",serif',
                sans: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
            },
            dark: {
                paper: '#0e141c', surface: '#151d28', ink: '#e7ecf2', muted: '#9aa6b6', faint: '#6b7787',
                line: '#253141', accent: '#7db1e8', 'accent-2': '#9cc4f0', gold: '#cfa863', chip: '#1b2634',
                'hero-bg': '#0a0f17', 'hero-ink': '#e7ecf2', 'hero-soft': 'rgba(231,236,242,.68)', 'hero-line': 'rgba(231,236,242,.14)',
                shadow: '0 1px 2px rgba(0,0,0,.4),0 10px 28px -14px rgba(0,0,0,.6)',
                'heat-0': '#1b2634', 'heat-1': '#22344a', 'heat-2': '#2c4c6e', 'heat-3': '#3f74a8', 'heat-4': '#7db1e8',
            },
        },
        moderno: {
            label: 'Moderno',
            light: {
                paper: '#f6f8f8', surface: '#ffffff', ink: '#111827', muted: '#4b5563', faint: '#7d8998',
                line: '#e2e8e6', accent: '#0f6f66', 'accent-2': '#0e8a7d', gold: '#e0703e', chip: '#eaf3f1',
                'hero-bg': '#0b2320', 'hero-ink': '#f0f7f5', 'hero-soft': 'rgba(240,247,245,.72)', 'hero-line': 'rgba(240,247,245,.16)',
                shadow: '0 1px 2px rgba(15,40,35,.06),0 8px 24px -12px rgba(15,40,35,.16)',
                'heat-0': '#eef5f3', 'heat-1': '#c7e6df', 'heat-2': '#8fd0c1', 'heat-3': '#45ab97', 'heat-4': '#0f6f66',
                serif: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
                sans: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
            },
            dark: {
                paper: '#0b1413', surface: '#101d1b', ink: '#e8f2f0', muted: '#9db3ae', faint: '#5e7873',
                line: '#1e2f2c', accent: '#4fd3c4', 'accent-2': '#7fe3d6', gold: '#f0895a', chip: '#152524',
                'hero-bg': '#071312', 'hero-ink': '#e8f2f0', 'hero-soft': 'rgba(232,242,240,.68)', 'hero-line': 'rgba(232,242,240,.14)',
                shadow: '0 1px 2px rgba(0,0,0,.4),0 10px 28px -14px rgba(0,0,0,.6)',
                'heat-0': '#152524', 'heat-1': '#1c3733', 'heat-2': '#245349', 'heat-3': '#328874', 'heat-4': '#4fd3c4',
            },
        },
        classico: {
            label: 'Clássico',
            light: {
                paper: '#faf6ee', surface: '#fffdf8', ink: '#2b211c', muted: '#6b5d51', faint: '#9c8a7b',
                line: '#e8ddcd', accent: '#6d2331', 'accent-2': '#8a2f3f', gold: '#9c7a3c', chip: '#f3ece0',
                'hero-bg': '#3a1620', 'hero-ink': '#f6ece5', 'hero-soft': 'rgba(246,236,229,.72)', 'hero-line': 'rgba(246,236,229,.16)',
                shadow: '0 1px 2px rgba(43,33,28,.08),0 8px 24px -12px rgba(43,33,28,.2)',
                'heat-0': '#f2e7db', 'heat-1': '#e3c6bd', 'heat-2': '#c98d94', 'heat-3': '#9c4f5c', 'heat-4': '#6d2331',
                serif: 'Georgia,"Times New Roman","Iowan Old Style",Palatino,serif',
                sans: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
            },
            dark: {
                paper: '#180f0d', surface: '#231715', ink: '#f1e6dd', muted: '#c2a999', faint: '#7d6459',
                line: '#3a2620', accent: '#e18b9a', 'accent-2': '#eaa7b3', gold: '#d1ac6a', chip: '#2b1c18',
                'hero-bg': '#120a09', 'hero-ink': '#f1e6dd', 'hero-soft': 'rgba(241,230,221,.68)', 'hero-line': 'rgba(241,230,221,.14)',
                shadow: '0 1px 2px rgba(0,0,0,.45),0 10px 28px -14px rgba(0,0,0,.65)',
                'heat-0': '#2b1c18', 'heat-1': '#3d241f', 'heat-2': '#5c2d31', 'heat-3': '#8a4451', 'heat-4': '#e18b9a',
            },
        },
    };

    function tokensCss(themeKey) {
        const t = THEMES[themeKey] || THEMES.elegante;
        const decl = (o) => Object.keys(o).map(k => `--${k}:${o[k]};`).join('');
        return `:root{${decl(t.light)}}\n:root[data-theme="dark"]{${decl(t.dark)}}\n@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${decl(t.dark)}}}\n`;
    }

    const BASE_CSS = `
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);line-height:1.6;
  -webkit-font-smoothing:antialiased;transition:background-color .35s ease,color .35s ease}
a{color:var(--accent-2);text-decoration:none}
.ic{flex:0 0 auto;vertical-align:middle}
.skip{position:absolute;left:-999px}.skip:focus{left:12px;top:12px;background:var(--surface);color:var(--ink);padding:10px 14px;border-radius:8px;z-index:100;box-shadow:var(--shadow)}
:focus-visible{outline:2px solid var(--accent-2);outline-offset:2px;border-radius:4px}
.wrap{max-width:940px;margin:0 auto;padding:0 24px}
.eyebrow{font-size:.7rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--gold)}

/* ---- Masthead ---- */
.hero{position:relative;background:var(--hero-bg);color:var(--hero-ink);overflow:hidden}
.hero::after{content:"";position:absolute;inset:0;background:radial-gradient(120% 80% at 88% -10%,rgba(255,255,255,.06),transparent 60%);pointer-events:none}
.hero .wrap{display:flex;gap:30px;align-items:center;padding:64px 24px 52px;flex-wrap:wrap;position:relative;z-index:1}
.avatar{width:118px;height:118px;border-radius:50%;object-fit:cover;flex:0 0 auto;
  box-shadow:0 0 0 1px var(--hero-line),0 0 0 6px rgba(166,124,61,.28),0 14px 32px -10px rgba(0,0,0,.5);background:var(--surface)}
.avatar.ph{display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:44px;font-weight:600;color:var(--accent)}
.hero-id{min-width:min(100%,320px);flex:1}
.hero h1{font-family:var(--serif);font-weight:600;margin:.35rem 0 0;font-size:clamp(2rem,4.6vw,3rem);line-height:1.06;letter-spacing:-.015em;text-wrap:balance}
.hero .rule{width:56px;height:2px;background:var(--gold);margin:16px 0;border:0}
.tagline{margin:0;font-size:1.06rem;color:var(--hero-soft)}
.local{margin:12px 0 0;display:inline-flex;align-items:center;gap:6px;font-size:.9rem;color:var(--hero-soft)}

/* ---- Introdução (contatos + mini-bio, logo abaixo do masthead) ---- */
.intro{margin:8px 0 0}
.contatos{display:flex;flex-wrap:wrap;gap:9px}
.contatos+.bio{margin-top:18px}
.contato{display:inline-flex;align-items:center;gap:7px;color:var(--ink);padding:6px 14px;border-radius:999px;
  font-size:.84rem;border:1px solid var(--line);background:var(--chip);transition:background-color .2s,border-color .2s,transform .2s}
.contato .ic{opacity:.65;color:var(--accent-2);transition:transform .2s,opacity .2s}
.contato:hover{background:var(--surface);border-color:var(--accent-2)}
.contato:hover .ic{transform:translate(2px,-2px);opacity:1}

/* ---- Faixa de estatísticas ---- */
.stats{background:var(--surface);border-bottom:1px solid var(--line)}
.stats-row{display:flex;flex-wrap:wrap;gap:8px 48px;padding:22px 24px}
.stat{display:flex;flex-direction:column;gap:2px}
.stat-num{font-family:var(--serif);font-size:1.9rem;font-weight:600;line-height:1;color:var(--accent);font-variant-numeric:tabular-nums}
.stat-num.period{font-size:1.45rem;letter-spacing:.01em}
.stat-label{font-size:.7rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--faint)}

/* ---- Índice fixo ---- */
nav.toc{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--surface) 86%,transparent);
  border-bottom:1px solid var(--line);backdrop-filter:saturate(140%) blur(10px)}
nav.toc .wrap{display:flex;align-items:center;gap:2px;padding:6px 24px;overflow-x:auto;scrollbar-width:thin}
nav.toc a{position:relative;color:var(--muted);padding:10px 12px;font-size:.82rem;white-space:nowrap;transition:color .2s}
nav.toc a::after{content:"";position:absolute;left:12px;right:12px;bottom:4px;height:2px;background:var(--gold);
  transform:scaleX(0);transform-origin:left;transition:transform .25s ease}
nav.toc a:hover{color:var(--ink)}
nav.toc a.active{color:var(--ink)}
nav.toc a.active::after{transform:scaleX(1)}
.toc-tools{margin-left:auto;display:flex;gap:6px;align-items:center}
.searchwrap{display:flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--paper);border-radius:8px;padding:5px 10px}
.searchwrap .ic{color:var(--faint)}
#search{border:0;background:transparent;color:var(--ink);font-size:.84rem;width:130px;outline:none;font-family:var(--sans)}
.btn{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line);background:var(--surface);
  color:var(--muted);border-radius:8px;width:34px;height:34px;cursor:pointer;transition:color .2s,border-color .2s,background-color .2s}
.btn:hover{color:var(--ink);border-color:var(--accent-2)}

/* ---- Conteúdo ---- */
main{padding:8px 0 72px}
.bio{background:var(--surface);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:12px;
  padding:20px 24px;box-shadow:var(--shadow);white-space:pre-wrap;font-size:1.02rem;color:var(--ink)}
.secao{margin:44px 0 0}
.secao-simples-title{font-family:var(--serif);font-weight:600;font-size:clamp(1.2rem,2.2vw,1.45rem);margin:0 0 18px;
  letter-spacing:-.01em;text-wrap:balance}

/* ---- Nuvem de palavras ---- */
.nuvem{position:relative;width:100%}
.nuvem-w{color:var(--accent-2);font-weight:700;white-space:nowrap;line-height:1}

/* ---- Linha do tempo (mapa de calor por categoria × ano) ---- */
.grade-tempo-wrap{display:flex;align-items:flex-start;overflow:hidden}
.grade-tempo-labels{border-collapse:separate;border-spacing:2px;flex:0 0 auto}
.grade-tempo-labels th{padding-right:12px;font-size:.8rem;font-weight:600;text-align:left;white-space:nowrap;color:var(--ink)}
.grade-tempo-scroll{overflow-x:auto;min-width:0;flex:1;scrollbar-width:thin;scrollbar-color:var(--line) transparent}
.grade-tempo-scroll::-webkit-scrollbar{height:6px}
.grade-tempo-scroll::-webkit-scrollbar-track{background:transparent}
.grade-tempo-scroll::-webkit-scrollbar-thumb{background-color:var(--line);border-radius:999px}
.grade-tempo-anos{border-collapse:separate;border-spacing:2px}
.grade-tempo-anos th{font-size:.62rem;font-weight:400;text-align:center;white-space:nowrap;color:var(--faint);padding-bottom:2px}
.gt-row{height:22px}
.gt-cell{width:11px;height:11px;border-radius:2px}
.grade-tempo-legend{display:flex;align-items:center;gap:4px;font-size:.75rem;color:var(--faint);margin-top:12px}
.grade-tempo-legend .sq{width:8px;height:8px;border-radius:2px;display:inline-block}
.secao-details{display:block}
.secao-head{display:flex;align-items:baseline;gap:14px;border-bottom:1px solid var(--line);padding-bottom:10px;margin-bottom:0;
  cursor:pointer;list-style:none;-webkit-tap-highlight-color:transparent}
.secao-head::-webkit-details-marker{display:none}
.secao-head::marker{content:""}
.secao-details[open]>.secao-head{margin-bottom:20px}
.secao-head:hover .secao-title{color:var(--accent-2)}
.secao-num{font-family:var(--serif);color:var(--gold);font-size:1rem;font-weight:700;letter-spacing:.05em;font-variant-numeric:tabular-nums}
.secao-title{flex:1;min-width:0;font-family:var(--serif);font-weight:600;font-size:clamp(1.35rem,2.6vw,1.7rem);margin:0;
  letter-spacing:-.01em;text-wrap:balance;transition:color .2s}
.chev{flex:0 0 auto;color:var(--faint);transition:transform .25s ease}
.secao-details[open] .chev{transform:rotate(180deg)}
.tipo{margin:22px 0 0}
.tipo-label{display:flex;align-items:center;gap:8px;font-size:.72rem;font-weight:700;letter-spacing:.13em;
  text-transform:uppercase;color:var(--accent);margin:0 0 4px}
.count{font-family:var(--sans);font-size:.68rem;font-weight:700;letter-spacing:.02em;color:var(--faint);
  background:var(--chip);border-radius:999px;padding:1px 8px}
.items{list-style:none;margin:0;padding:0}
.item{padding:12px 8px 12px 10px;border-bottom:1px solid var(--line);border-radius:8px;transition:background-color .2s}
.item:hover{background:var(--chip)}
.item-row{display:flex;align-items:baseline;gap:12px}
.item-title{flex:1;min-width:0;margin:0;font-weight:600;font-size:1.01rem;line-height:1.4}
.item-meta{margin:4px 0 0;color:var(--muted);font-size:.9rem;line-height:1.5}
.year{flex:0 0 auto;font-family:var(--serif);font-variant-numeric:tabular-nums;font-weight:700;font-size:.95rem;
  color:var(--gold);letter-spacing:.02em;white-space:nowrap}
.anexos{flex:0 0 auto;display:flex;gap:5px}
.anexo{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;color:var(--accent-2);
  border-radius:999px;border:1px solid var(--line);transition:border-color .2s,background-color .2s,color .2s}
.anexo:hover{border-color:var(--accent-2);background:var(--chip);color:var(--accent)}
.empty{color:var(--muted);font-style:italic;padding:40px 0}
footer{border-top:1px solid var(--line);color:var(--faint);font-size:.8rem;text-align:center;padding:30px 24px;margin-top:20px}
footer strong{color:var(--muted);font-weight:700}
.totop{position:fixed;right:22px;bottom:22px;width:44px;height:44px;border-radius:50%;border:1px solid var(--line);
  background:var(--surface);color:var(--accent);display:flex;align-items:center;justify-content:center;cursor:pointer;
  box-shadow:var(--shadow);opacity:0;pointer-events:none;transform:translateY(8px);transition:opacity .25s,transform .25s}
.totop.show{opacity:1;pointer-events:auto;transform:none}

/* ---- Movimento (revelação + carga) ---- */
.reveal{opacity:0;transform:translateY(16px);transition:opacity .6s ease,transform .6s ease}
.reveal.in{opacity:1;transform:none}
.hero .wrap>*{opacity:0;transform:translateY(14px);animation:rise .7s cubic-bezier(.22,.61,.36,1) forwards}
.hero .avatar{animation-delay:.05s}.hero .hero-id{animation-delay:.16s}
@keyframes rise{to{opacity:1;transform:none}}

@media (max-width:640px){
  .hero .wrap{padding:44px 22px 40px;gap:22px}
  .avatar{width:92px;height:92px}
  .stat-num{font-size:1.6rem}
}
@media (prefers-reduced-motion: reduce){
  html{scroll-behavior:auto}
  .reveal{opacity:1;transform:none;transition:none}
  .hero .wrap>*{opacity:1;transform:none;animation:none}
  .totop{transition:opacity .01s}
}
@media print{
  nav.toc,.totop,#themeBtn,#printBtn,.searchwrap,.chev{display:none!important}
  body{background:#fff;color:#000}
  .hero{background:var(--hero-bg)!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .item,.bio,.stats{box-shadow:none}
  .reveal{opacity:1!important;transform:none!important}
  .secao{break-inside:avoid}
  .secao-head{cursor:default}
}
`;

    const STYLES = {};
    Object.keys(THEMES).forEach(k => { STYLES[k] = tokensCss(k) + BASE_CSS; });

    // opts.externalCss: caminho relativo (ex.: "css/estilo.css") — quando
    // informado, o CSS vai por <link> em vez de embutido em <style> (uso: a
    // versão salva na pasta, que grava o CSS como arquivo à parte).
    function renderHtml(model, style, opts) {
        style = STYLES[style] ? style : 'elegante';
        opts = opts || {};
        const m = model || {};
        const secoesComItens = (m.secoes || []).filter(s => (s.tipos || []).some(t => t.itens && t.itens.length));
        const navExtra = [];
        if (m.nuvemPalavras && m.nuvemPalavras.length) navExtra.push('<a href="#nuvem">Nuvem de palavras</a>');
        if (m.linhaTempo && m.linhaTempo.categorias && m.linhaTempo.categorias.length) navExtra.push('<a href="#tempo">Linha do tempo</a>');
        const nav = navExtra.join('') + secoesComItens.map(s => `<a href="#${s.id}">${esc(s.label)}</a>`).join('');
        const secoes = (m.secoes || []).map(secaoHtml).join('') || `<p class="wrap empty">Sem itens catalogados.</p>`;
        const avatar = m.foto
            ? `<img class="avatar" src="${m.foto}" alt="Foto de ${esc(m.nome || '')}">`
            : `<div class="avatar ph" aria-hidden="true">${esc(m.iniciais || '·')}</div>`;
        const contatos = (m.contatos || []).map(contatoBtn).join('');
        const outras = m.outras
            ? `<section id="outras" class="secao reveal"><div class="secao-head"><h2 class="secao-title">Outras informações</h2></div><div class="bio">${esc(m.outras)}</div></section>`
            : '';
        const intro = (contatos || m.bio)
            ? `<section class="intro reveal">
                ${contatos ? `<div class="contatos">${contatos}</div>` : ''}
                ${m.bio ? `<div class="bio">${esc(m.bio)}</div>` : ''}
            </section>`
            : '';

        // Faixa de estatísticas (resumo antes do detalhe)
        const yr = yearRange(m);
        const stats = [];
        if (m.totalItens != null) stats.push(`<div class="stat"><span class="stat-num" data-count="${m.totalItens}">${m.totalItens}</span><span class="stat-label">Itens catalogados</span></div>`);
        if (secoesComItens.length) stats.push(`<div class="stat"><span class="stat-num" data-count="${secoesComItens.length}">${secoesComItens.length}</span><span class="stat-label">Seções</span></div>`);
        if (yr) stats.push(`<div class="stat"><span class="stat-num period">${yr.lo}<span style="color:var(--faint)">–</span>${yr.hi}</span><span class="stat-label">Período</span></div>`);
        const statsHtml = stats.length ? `<section class="stats reveal" aria-label="Resumo do currículo"><div class="wrap stats-row">${stats.join('')}</div></section>` : '';

        return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(m.nome || 'Currículo')}</title>
<meta name="description" content="Currículo de ${esc(m.nome || '')}${m.tagline ? ' — ' + esc(m.tagline) : ''}">
${opts.externalCss ? `<link rel="stylesheet" href="${esc(opts.externalCss)}">` : `<style>${STYLES[style] || STYLES.elegante}</style>`}
</head>
<body>
<a class="skip" href="#conteudo">Ir para o conteúdo</a>
<header class="hero">
  <div class="wrap">
    ${avatar}
    <div class="hero-id">
      <span class="eyebrow">Currículo acadêmico</span>
      <h1>${esc(m.nome || 'Currículo')}</h1>
      <hr class="rule">
      ${m.tagline ? `<p class="tagline">${esc(m.tagline)}</p>` : ''}
      ${m.local ? `<p class="local">${IC.pin} ${esc(m.local)}</p>` : ''}
      ${(m.areasAtuacao && m.areasAtuacao.length) ? `<p class="local">${esc('Áreas de atuação: ' + m.areasAtuacao.join(' · '))}</p>` : ''}
    </div>
  </div>
</header>

${statsHtml}

<nav class="toc" aria-label="Seções">
  <div class="wrap">
    ${nav}
    <div class="toc-tools">
      <label class="searchwrap">${IC.search}<input id="search" type="search" placeholder="Filtrar…" aria-label="Filtrar itens"></label>
      <button id="themeBtn" class="btn" title="Alternar tema" aria-label="Alternar tema claro/escuro">${IC.moon}</button>
      <button id="printBtn" class="btn" title="Imprimir / PDF" aria-label="Imprimir">${IC.printer}</button>
    </div>
  </div>
</nav>

<main id="conteudo" class="wrap">
  ${intro}
  ${nuvemHtml(m)}
  ${linhaTempoHtml(m)}
  ${secoes}
  ${outras}
</main>

<footer>
  ${m.totalItens != null ? `${m.totalItens} itens · ` : ''}Gerado com <strong>lattesZen</strong>${m.geradoEm ? ' em ' + esc(m.geradoEm) : ''}.
</footer>

<button class="totop" id="toTop" title="Voltar ao topo" aria-label="Voltar ao topo">${IC.up}</button>

<script>
(function(){
  var root=document.documentElement;
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Tema (segue o sistema; botão alterna e persiste)
  try{var t=localStorage.getItem('cvtheme'); if(t) root.setAttribute('data-theme',t);}catch(e){}
  document.getElementById('themeBtn').addEventListener('click',function(){
    var cur=root.getAttribute('data-theme');
    var dark=cur? cur==='dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    var nv=dark?'light':'dark'; root.setAttribute('data-theme',nv);
    try{localStorage.setItem('cvtheme',nv);}catch(e){}
  });
  document.getElementById('printBtn').addEventListener('click',function(){window.print();});

  // Nuvem de palavras: espalha os <span> (já em fluxo normal) em espiral a
  // partir do centro, testando colisão de retângulos — mesmo algoritmo da
  // aba Linha do tempo do app (ver posicionarNuvem em tab-linha-tempo.js),
  // rodando aqui porque depende do tamanho real já renderizado dos <span>.
  var nuvemArea=document.getElementById('nuvemPub');
  if(nuvemArea && nuvemArea.children.length){
    var spans=[].slice.call(nuvemArea.children);
    var larguraArea=nuvemArea.clientWidth||600;
    var alturaBase=Math.max(160,larguraArea*0.5);
    var cx=larguraArea/2, cy=alturaBase/2, PAD=5, caixas=[];
    spans.forEach(function(span,i){
      var largura=span.offsetWidth+PAD*2, altura=span.offsetHeight+PAD*2;
      var angulo=(i*2.4)%(Math.PI*2), raio=0, caixa=null;
      for(var passo=0;passo<2000;passo++){
        var x=cx+raio*Math.cos(angulo)-largura/2;
        var y=cy+raio*Math.sin(angulo)*0.7-altura/2;
        var candidata={x:x,y:y,w:largura,h:altura};
        var colide=caixas.some(function(c){return candidata.x<c.x+c.w&&c.x<candidata.x+candidata.w&&candidata.y<c.y+c.h&&c.y<candidata.y+candidata.h;});
        if(!colide){caixa=candidata;break;}
        angulo+=0.3; raio+=1.4;
      }
      caixas.push(caixa||{x:cx-largura/2,y:cy-altura/2,w:largura,h:altura});
    });
    var minX=Math.min.apply(null,[0].concat(caixas.map(function(c){return c.x;})));
    var maxX=Math.max.apply(null,[larguraArea].concat(caixas.map(function(c){return c.x+c.w;})));
    var minY=Math.min.apply(null,[0].concat(caixas.map(function(c){return c.y;})));
    var maxY=Math.max.apply(null,caixas.map(function(c){return c.y+c.h;}));
    var larguraFinal=maxX-minX;
    var deslocX=larguraArea>larguraFinal?(larguraArea-larguraFinal)/2-minX:-minX;
    var deslocY=-minY;
    spans.forEach(function(span,i){
      var c=caixas[i];
      span.style.position='absolute';
      span.style.left=(c.x+PAD+deslocX)+'px';
      span.style.top=(c.y+PAD+deslocY)+'px';
    });
    nuvemArea.style.position='relative';
    nuvemArea.style.height=((maxY-minY)+10)+'px';
  }

  // Impressão: as seções ficam recolhidas por padrão, então força todas
  // abertas antes de imprimir (senão o conteúdo simplesmente não sai no PDF).
  addEventListener('beforeprint',function(){
    document.querySelectorAll('details.secao-details').forEach(function(d){ d.open=true; });
  });

  // Índice: clicar numa seção também abre a cortina (senão o link rola até
  // um cabeçalho recolhido, sem nada visível abaixo).
  document.querySelectorAll('nav.toc a').forEach(function(a){
    a.addEventListener('click',function(){
      var sec=document.getElementById(a.getAttribute('href').slice(1));
      var det=sec&&sec.querySelector('details.secao-details');
      if(det) det.open=true;
    });
  });

  // Filtro de busca
  var search=document.getElementById('search');
  search.addEventListener('input',function(){
    var q=this.value.trim().toLowerCase();
    document.querySelectorAll('.item').forEach(function(li){
      li.style.display = (!q || (li.getAttribute('data-search')||'').indexOf(q)>-1) ? '' : 'none';
    });
    document.querySelectorAll('.tipo').forEach(function(tp){
      tp.style.display = tp.querySelectorAll('.item:not([style*="none"])').length ? '' : 'none';
    });
    document.querySelectorAll('.secao').forEach(function(se){
      if(se.id==='outras') return;
      var hasMatch = se.querySelectorAll('.item:not([style*="none"])').length>0;
      se.style.display = hasMatch ? '' : 'none';
      // Digitando: abre as seções com resultado (senão fica escondido atrás
      // da cortina). Campo vazio: volta todas ao estado recolhido padrão.
      var det=se.querySelector('details.secao-details');
      if(det) det.open = q ? hasMatch : false;
    });
  });

  // Revelação no scroll
  var reveals=[].slice.call(document.querySelectorAll('.reveal'));
  if(reduce || !('IntersectionObserver' in window)){
    reveals.forEach(function(el){el.classList.add('in');});
  }else{
    var ro=new IntersectionObserver(function(ents){
      ents.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); ro.unobserve(e.target); }});
    },{rootMargin:'0px 0px -8% 0px',threshold:.06});
    reveals.forEach(function(el){ro.observe(el);});
  }

  // Contagem animada das estatísticas
  var counters=[].slice.call(document.querySelectorAll('.stat-num[data-count]'));
  function runCount(el){
    var target=+el.getAttribute('data-count')||0;
    if(reduce){ el.textContent=target; return; }
    var t0=null, dur=900;
    function step(ts){ if(!t0)t0=ts; var p=Math.min(1,(ts-t0)/dur);
      var eased=1-Math.pow(1-p,3);
      el.textContent=Math.round(target*eased);
      if(p<1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if(counters.length){
    if(reduce || !('IntersectionObserver' in window)){ counters.forEach(runCount); }
    else{
      var co=new IntersectionObserver(function(ents){
        ents.forEach(function(e){ if(e.isIntersecting){ runCount(e.target); co.unobserve(e.target); }});
      },{threshold:.5});
      counters.forEach(function(el){co.observe(el);});
    }
  }

  // Índice ativo (scrollspy)
  var links=[].slice.call(document.querySelectorAll('nav.toc a'));
  var map={}; links.forEach(function(a){map[a.getAttribute('href').slice(1)]=a;});
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(ents){
      ents.forEach(function(e){ if(e.isIntersecting){ links.forEach(function(l){l.classList.remove('active');}); var a=map[e.target.id]; if(a)a.classList.add('active'); }});
    },{rootMargin:'-45% 0px -50% 0px'});
    document.querySelectorAll('main .secao').forEach(function(s){io.observe(s);});
  }

  // Voltar ao topo
  var top=document.getElementById('toTop');
  addEventListener('scroll',function(){ top.classList.toggle('show', scrollY>500); },{passive:true});
  top.addEventListener('click',function(){ scrollTo({top:0,behavior:reduce?'auto':'smooth'}); });
})();
</script>
</body>
</html>`;
    }

    return {
        renderHtml, styles: Object.keys(STYLES),
        // Nome amigável de um tema, para o seletor em Publicar na Web.
        styleLabel(style) { return (THEMES[style] && THEMES[style].label) || style; },
        // CSS puro de um estilo (usado para gravar como arquivo à parte, ex.: css/estilo.css)
        css(style) { return STYLES[style] || STYLES.elegante; },
    };
})();
