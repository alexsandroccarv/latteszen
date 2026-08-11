/* ==========================================================================
   lattesZen — Publicação: gera a página pública do currículo (1 arquivo)
   --------------------------------------------------------------------------
   window.LzPublish.renderHtml(model, style) devolve uma STRING com um
   documento HTML autossuficiente (CSS + JS inline, assets em base64).
   O "model" é montado no app (app.js), que lê os dados do catálogo e embute
   a foto e as evidências marcadas como "públicas" em base64.

   Estrutura do model:
   {
     nome, tagline, bio, foto(dataUri|null), iniciais, local,
     orcid, orcidUrl, lattesUrl,
     contatos: [{ grupo, plataforma, url, usuario }],
     outras: string|null,
     secoes: [{ id, num, label, icon, tipos: [{ label, itens:
        [{ titulo, ano, linha, anexos:[{ name, ext, dataUri }] }] }] }],
     geradoEm, totalItens
   }
   ========================================================================== */
window.LzPublish = (function () {
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const CONTACT_ICON = {
        'ORCID': '🆔', 'Lattes': '📄', 'LinkedIn': '💼', 'E-mail': '✉️', 'E-mail profissional': '✉️',
        'Site pessoal': '🌐', 'Instagram': '📸', 'Facebook': '📘', 'YouTube': '▶️', 'X': '𝕏',
        'Google Scholar': '🎓', 'ResearchGate': '🔬', 'GitHub': '💻',
    };
    const contatoIcon = (plat) => CONTACT_ICON[plat] || '🔗';

    function anexoHtml(a) {
        const img = /^(jpe?g|png|gif|webp)$/i.test(a.ext);
        return `<a class="anexo" href="${a.dataUri}" target="_blank" rel="noopener" ${img ? '' : `download="${esc(a.name)}"`} title="${esc(a.name)}">
            <span aria-hidden="true">${img ? '🖼️' : '📎'}</span> ${esc(a.name)}</a>`;
    }

    function itemHtml(it) {
        const anexos = (it.anexos && it.anexos.length)
            ? `<div class="anexos">${it.anexos.map(anexoHtml).join('')}</div>` : '';
        return `<li class="item" data-search="${esc(((it.titulo || '') + ' ' + (it.linha || '')).toLowerCase())}">
            <div class="item-main">
                <p class="item-title">${esc(it.titulo || '(sem título)')}</p>
                ${it.linha ? `<p class="item-meta">${esc(it.linha)}</p>` : ''}
                ${anexos}
            </div>
            ${it.ano ? `<span class="year">${esc(it.ano)}</span>` : ''}
        </li>`;
    }

    function tipoHtml(t) {
        if (!t.itens || !t.itens.length) return '';
        return `<div class="tipo">
            <h3 class="tipo-label">${esc(t.label)} <span class="count">${t.itens.length}</span></h3>
            <ul class="items">${t.itens.map(itemHtml).join('')}</ul>
        </div>`;
    }

    function secaoHtml(s) {
        const tipos = (s.tipos || []).map(tipoHtml).join('');
        if (!tipos) return '';
        return `<section id="${s.id}" class="secao">
            <h2 class="secao-title"><span class="secao-icon" aria-hidden="true">${s.icon || '▣'}</span> ${esc(s.label)}</h2>
            ${tipos}
        </section>`;
    }

    function contatoBtn(c) {
        const label = c.usuario ? `${c.plataforma}` : c.plataforma;
        return `<a class="contato" href="${esc(c.url)}" target="_blank" rel="noopener" title="${esc(c.plataforma)}${c.usuario ? ' · ' + esc(c.usuario) : ''}">
            <span class="contato-ic" aria-hidden="true">${contatoIcon(c.plataforma)}</span><span>${esc(label)}</span></a>`;
    }

    const STYLES = {
        // Paleta e visual "elegante" (claro/escuro). Estilos adicionais podem
        // ser acrescentados a este mapa no futuro.
        elegante: `
:root{
  --bg:#f6f7f9; --surface:#ffffff; --text:#1f2937; --muted:#6b7280; --line:#e5e7eb;
  --accent:#0c326f; --accent2:#1351b4; --chip:#eef2ff; --chipink:#1e3a8a; --shadow:0 1px 2px rgba(16,24,40,.06),0 1px 3px rgba(16,24,40,.1);
}
:root[data-theme="dark"]{
  --bg:#0b1220; --surface:#111827; --text:#e5e7eb; --muted:#9ca3af; --line:#243043;
  --accent:#93c5fd; --accent2:#60a5fa; --chip:#1e293b; --chipink:#bfdbfe; --shadow:0 1px 2px rgba(0,0,0,.4);
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --bg:#0b1220; --surface:#111827; --text:#e5e7eb; --muted:#9ca3af; --line:#243043;
  --accent:#93c5fd; --accent2:#60a5fa; --chip:#1e293b; --chipink:#bfdbfe; --shadow:0 1px 2px rgba(0,0,0,.4);
}}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.55}
a{color:var(--accent2);text-decoration:none}
.skip{position:absolute;left:-999px}.skip:focus{left:8px;top:8px;background:var(--surface);padding:8px;border-radius:6px;z-index:100}
.wrap{max-width:920px;margin:0 auto;padding:0 20px}
/* Hero */
.hero{background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff}
.hero .wrap{display:flex;gap:24px;align-items:center;padding:40px 20px;flex-wrap:wrap}
.avatar{width:120px;height:120px;border-radius:50%;object-fit:cover;border:4px solid rgba(255,255,255,.35);box-shadow:0 6px 20px rgba(0,0,0,.25);background:#fff;flex:0 0 auto}
.avatar.ph{display:flex;align-items:center;justify-content:center;font-size:44px;font-weight:700;color:var(--accent)}
.hero h1{margin:0 0 4px;font-size:2rem;line-height:1.1}
.tagline{margin:.2rem 0;opacity:.95}
.local{margin:.2rem 0;opacity:.85;font-size:.9rem}
.contatos{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.contato{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.16);color:#fff;padding:6px 12px;border-radius:999px;font-size:.85rem;border:1px solid rgba(255,255,255,.25)}
.contato:hover{background:rgba(255,255,255,.28)}
.bio{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:18px 20px;margin:-24px auto 0;position:relative;box-shadow:var(--shadow);white-space:pre-wrap}
/* Nav */
nav.toc{position:sticky;top:0;z-index:20;background:var(--surface);border-bottom:1px solid var(--line);backdrop-filter:saturate(120%) blur(4px)}
nav.toc .wrap{display:flex;align-items:center;gap:6px;padding:8px 20px;overflow-x:auto}
nav.toc a{color:var(--muted);padding:6px 10px;border-radius:8px;font-size:.85rem;white-space:nowrap}
nav.toc a.active,nav.toc a:hover{color:var(--text);background:var(--chip)}
.toc-tools{margin-left:auto;display:flex;gap:6px;align-items:center}
#search{border:1px solid var(--line);background:var(--bg);color:var(--text);border-radius:8px;padding:6px 10px;font-size:.85rem;width:150px}
.btn{border:1px solid var(--line);background:var(--surface);color:var(--text);border-radius:8px;padding:6px 10px;font-size:.85rem;cursor:pointer}
/* Sections */
main{padding:28px 0 60px}
.secao{margin:34px 0}
.secao-title{display:flex;align-items:center;gap:10px;font-size:1.3rem;border-bottom:2px solid var(--line);padding-bottom:8px;margin:0 0 14px}
.secao-icon{font-size:1.1rem}
.tipo{margin:16px 0}
.tipo-label{font-size:1rem;color:var(--accent2);margin:0 0 8px;font-weight:600}
.count{display:inline-block;font-size:.72rem;color:var(--muted);background:var(--chip);border-radius:999px;padding:1px 8px;margin-left:4px;vertical-align:middle}
.items{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.item{display:flex;gap:14px;justify-content:space-between;align-items:flex-start;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:12px 14px;box-shadow:var(--shadow)}
.item-title{margin:0;font-weight:600}
.item-meta{margin:3px 0 0;color:var(--muted);font-size:.9rem}
.year{flex:0 0 auto;font-variant-numeric:tabular-nums;font-weight:700;color:var(--accent2);background:var(--chip);border-radius:8px;padding:2px 10px;font-size:.85rem}
.anexos{margin-top:8px;display:flex;flex-wrap:wrap;gap:8px}
.anexo{display:inline-flex;align-items:center;gap:5px;font-size:.8rem;background:var(--chip);color:var(--chipink);padding:3px 10px;border-radius:999px;border:1px solid var(--line)}
.empty{color:var(--muted);font-style:italic}
footer{border-top:1px solid var(--line);color:var(--muted);font-size:.8rem;text-align:center;padding:24px}
.totop{position:fixed;right:18px;bottom:18px;width:42px;height:42px;border-radius:50%;border:none;background:var(--accent2);color:#fff;font-size:1.1rem;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.25);opacity:0;pointer-events:none;transition:opacity .2s}
.totop.show{opacity:1;pointer-events:auto}
@media (max-width:640px){.hero h1{font-size:1.5rem}.avatar{width:88px;height:88px}#search{width:110px}}
@media print{nav.toc,.totop,#themeBtn,#printBtn{display:none}.hero{background:#0c326f !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.item,.bio{box-shadow:none}}
`,
    };

    function renderHtml(model, style) {
        style = STYLES[style] ? style : 'elegante';
        const m = model || {};
        const nav = (m.secoes || []).filter(s => (s.tipos || []).some(t => t.itens && t.itens.length))
            .map(s => `<a href="#${s.id}">${esc(s.label)}</a>`).join('');
        const secoes = (m.secoes || []).map(secaoHtml).join('') || `<p class="wrap empty">Sem itens catalogados.</p>`;
        const avatar = m.foto
            ? `<img class="avatar" src="${m.foto}" alt="Foto de ${esc(m.nome || '')}">`
            : `<div class="avatar ph" aria-hidden="true">${esc(m.iniciais || '·')}</div>`;
        const contatos = (m.contatos || []).map(contatoBtn).join('');
        const outras = m.outras
            ? `<section id="outras" class="secao"><h2 class="secao-title"><span class="secao-icon">ℹ️</span> Outras informações</h2><div class="bio" style="margin-top:0">${esc(m.outras)}</div></section>`
            : '';

        return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(m.nome || 'Currículo')}</title>
<meta name="description" content="Currículo de ${esc(m.nome || '')}${m.tagline ? ' — ' + esc(m.tagline) : ''}">
<style>${style && STYLES[style] || STYLES.elegante}</style>
</head>
<body>
<a class="skip" href="#conteudo">Ir para o conteúdo</a>
<header class="hero">
  <div class="wrap">
    ${avatar}
    <div>
      <h1>${esc(m.nome || 'Currículo')}</h1>
      ${m.tagline ? `<p class="tagline">${esc(m.tagline)}</p>` : ''}
      ${m.local ? `<p class="local">📍 ${esc(m.local)}</p>` : ''}
      ${contatos ? `<div class="contatos">${contatos}</div>` : ''}
    </div>
  </div>
</header>

<nav class="toc" aria-label="Seções">
  <div class="wrap">
    ${nav}
    <div class="toc-tools">
      <input id="search" type="search" placeholder="Filtrar…" aria-label="Filtrar itens">
      <button id="themeBtn" class="btn" title="Alternar tema" aria-label="Alternar tema">🌓</button>
      <button id="printBtn" class="btn" title="Imprimir / PDF" aria-label="Imprimir">🖨️</button>
    </div>
  </div>
</nav>

<main id="conteudo" class="wrap">
  ${m.bio ? `<div class="bio">${esc(m.bio)}</div>` : ''}
  ${secoes}
  ${outras}
</main>

<footer>
  ${m.totalItens != null ? `${m.totalItens} itens · ` : ''}Gerado com <strong>lattesZen</strong>${m.geradoEm ? ' em ' + esc(m.geradoEm) : ''}.
</footer>

<button class="totop" id="toTop" title="Voltar ao topo" aria-label="Voltar ao topo">↑</button>

<script>
(function(){
  var root=document.documentElement;
  // Tema (segue o sistema; botão alterna e persiste)
  try{var t=localStorage.getItem('cvtheme'); if(t) root.setAttribute('data-theme',t);}catch(e){}
  document.getElementById('themeBtn').addEventListener('click',function(){
    var cur=root.getAttribute('data-theme');
    var dark=cur? cur==='dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    var nv=dark?'light':'dark'; root.setAttribute('data-theme',nv);
    try{localStorage.setItem('cvtheme',nv);}catch(e){}
  });
  document.getElementById('printBtn').addEventListener('click',function(){window.print();});
  // Filtro de busca
  var search=document.getElementById('search');
  search.addEventListener('input',function(){
    var q=this.value.trim().toLowerCase();
    document.querySelectorAll('.item').forEach(function(li){
      li.style.display = (!q || (li.getAttribute('data-search')||'').indexOf(q)>-1) ? '' : 'none';
    });
    document.querySelectorAll('.tipo').forEach(function(tp){
      var vis=tp.querySelectorAll('.item:not([style*="none"])').length;
      tp.style.display = vis? '' : 'none';
    });
    document.querySelectorAll('.secao').forEach(function(se){
      var vis=se.querySelectorAll('.item:not([style*="none"])').length;
      if(se.id==='outras') return; se.style.display = vis? '' : 'none';
    });
  });
  // Scrollspy: destaca a seção ativa
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
  addEventListener('scroll',function(){ top.classList.toggle('show', scrollY>500); });
  top.addEventListener('click',function(){ scrollTo({top:0,behavior:'smooth'}); });
})();
</script>
</body>
</html>`;
    }

    return { renderHtml, styles: Object.keys(STYLES) };
})();
