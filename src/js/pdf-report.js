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
   lattesZen — Motor do "Relatório completo (PDF)" (Configurações → Trazer e
   levar dados → Exportar)
   --------------------------------------------------------------------------
   Único arquivo PDF pronto para impressão/encadernação: capa → sumário
   (com paginação real) → Memorial (se preenchido) → Currículo completo →
   Anexos (evidências marcadas como "pública", mescladas de verdade — não só
   citadas) → contracapa.

   Reaproveita window.TabPublicar.buildPublicModel() (mesma lógica de
   agrupar por categoria/instituição e mesmo critério de evidências —
   ev.publica — já usados na página pública, ver tab-publicar.js) em vez de
   percorrer state.catalogo.items de novo — o modelo já traz cada evidência pública
   como base64 (dataUri), pronta para embutir/mesclar aqui.

   Única biblioteca externa carregada pelo app até hoje que não é puramente
   visual (Tailwind/Font Awesome/fontes) — pdf-lib, via CDN (mesmo padrão de
   carregamento sob demanda, só quando a pessoa realmente pede o relatório).
   Motivo: mesclar de verdade os PDFs/imagens de evidência existentes num
   único arquivo de saída não é algo que dê para "desenhar" do zero (como o
   gerador de .docx em docx-export.js) — exige entender o formato PDF de
   arquivos alheios (parsing), não só escrever um novo.
   ========================================================================== */
window.LzPdfReport = (function () {
    // window.AppCore só existe quando gerar() é chamado de verdade (clique
    // do usuário, bem depois do carregamento de todos os módulos) — nunca
    // no topo deste arquivo, que carrega ANTES de app-core.js (ver ordem
    // dos <script> em index.html, mesmo motivo de vários módulos de aba).

    const PDF_LIB_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
    let pdfLibPromise = null;
    function carregarPdfLib() {
        if (window.PDFLib) return Promise.resolve(window.PDFLib);
        if (pdfLibPromise) return pdfLibPromise;
        pdfLibPromise = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = PDF_LIB_URL;
            s.onload = () => window.PDFLib ? resolve(window.PDFLib) : reject(new Error('pdf-lib carregou, mas window.PDFLib não apareceu.'));
            s.onerror = () => { pdfLibPromise = null; reject(new Error('Não foi possível carregar a biblioteca de PDF (verifique sua conexão com a internet).')); };
            document.head.appendChild(s);
        });
        return pdfLibPromise;
    }

    // Página A4 em pontos (1/72"), mesma unidade do pdf-lib.
    const PAGE_W = 595.28, PAGE_H = 841.89;
    const MARGIN = 56;
    const CONTENT_W = PAGE_W - MARGIN * 2;
    const CONTENT_H = PAGE_H - MARGIN * 2;
    const ALTURA_ENTRADA_SUMARIO = 18;
    // Largura da faixa lateral colorida do Modelo B (índice de dedo).
    const SIDEBAR_W = 58;
    // 1cm em pontos (1pt = 1/72"; 1" = 2,54cm) — usado pra deslocar o bloco
    // de texto do Modelo B pra mais perto da faixa lateral (pedido do
    // Alexsandro), sem mudar a largura do bloco.
    const UM_CM = 28.35;

    function corPrincipal(rgb) { return rgb(0.075, 0.318, 0.706); } // #1351b4 (govbr-600)
    function corTexto(rgb) { return rgb(0.11, 0.11, 0.11); }
    function corMuted(rgb) { return rgb(0.42, 0.42, 0.42); }

    // Modelo B ("Índice lateral colorido"): cada categoria (01-21) recebe uma
    // cor fixa, ciclando por esta paleta na ORDEM em que as categorias
    // aparecem em LattesTypes.categories — determinístico (a mesma categoria
    // sempre cai na mesma cor entre execuções). Sem número de categoria
    // (seção mesclada "Outras atividades", Memorial, Anexos), cai num
    // cinza neutro em vez de tentar "inventar" uma cor.
    const PALETA_CATEGORIAS = [
        [0.357, 0.247, 0.851], [0.318, 0.216, 0.706], [0.075, 0.318, 0.706], [0.055, 0.486, 0.400],
        [0.184, 0.490, 0.196], [0.722, 0.349, 0.039], [0.757, 0.267, 0.227], [0.541, 0.247, 0.627],
        [0.231, 0.431, 0.561], [0.549, 0.416, 0.184], [0.698, 0.227, 0.420], [0.102, 0.541, 0.620],
    ];
    const CINZA_NEUTRO = [0.42, 0.42, 0.42];
    // Faixa lateral da seção de Anexos (Modelo B): cinza bem mais claro que
    // o neutro acima (pedido do Alexsandro — "ao invés de cinza forte") —
    // com texto escuro (ver desenharSidebarB/contexto.corTexto), já que
    // texto branco não teria contraste sobre um cinza tão claro.
    const CINZA_CLARO_ANEXOS = [0.87, 0.87, 0.85];
    const TEXTO_ESCURO_ANEXOS = [0.15, 0.15, 0.14];
    function corDaCategoria(num) {
        if (!num) return CINZA_NEUTRO;
        const cats = (window.LattesTypes && window.LattesTypes.categories) || [];
        const idx = cats.findIndex((c) => c.num === num);
        return PALETA_CATEGORIAS[(idx >= 0 ? idx : 0) % PALETA_CATEGORIAS.length];
    }
    // Mistura uma cor [r,g,b] (0-1) com branco — usada no Modelo B pra marcar
    // a data de cada item com uma versão CLARA (pastel) da cor da categoria
    // em vez da cor cheia, que fica reservada pro selo do contador/índice
    // lateral (pedido do Alexsandro: "use a cor do subtipo mais clara ao
    // marcar as datas").
    function misturarComBranco(cor, fator) {
        return [cor[0] + (1 - cor[0]) * fator, cor[1] + (1 - cor[1]) * fator, cor[2] + (1 - cor[2]) * fator];
    }

    // As fontes padrão do PDF (Helvetica) só sabem desenhar o alfabeto
    // WinAnsi (basicamente Latin-1 + alguns símbolos) — QUALQUER caractere
    // fora disso (grego, setas, CJK, cirílico, emoji...) faz pdf-lib
    // lançar uma exceção ("WinAnsi cannot encode...") na hora de medir ou
    // desenhar o texto, derrubando a geração do relatório inteiro por causa
    // de UM caractere, em qualquer campo (título de produção, Memorial,
    // nome de instituição...) — nada incomum num currículo acadêmico (ex.:
    // "α-sinucleína" num título, um nome em script não-latino, "→" numa
    // descrição). sanitizarTexto() troca o que dá por um equivalente
    // legível e o resto por "?", pra nunca mais travar a geração inteira
    // por causa de um caractere isolado.
    const charSetCache = new WeakMap();
    function charSetDe(fonte) {
        // fontes de teste (tools/tests/specs/pdf-report.mjs) só implementam
        // widthOfTextAtSize, pra testar a lógica pura sem depender do
        // pdf-lib real (CDN bloqueado nos testes) — sem getCharacterSet(),
        // não há como saber o que a fonte desenha, então não sanitiza nada.
        if (typeof fonte.getCharacterSet !== 'function') return null;
        let cs = charSetCache.get(fonte);
        if (!cs) { cs = new Set(fonte.getCharacterSet()); charSetCache.set(fonte, cs); }
        return cs;
    }
    const SUBSTITUICOES_TEXTO = {
        'α': 'alfa', 'β': 'beta', 'γ': 'gama', 'δ': 'delta', 'Δ': 'Delta', 'ε': 'epsilon', 'ζ': 'zeta', 'η': 'eta',
        'θ': 'teta', 'ι': 'iota', 'κ': 'capa', 'λ': 'lambda', 'μ': 'mi', 'µ': 'mi', 'ν': 'ni', 'ξ': 'csi', 'π': 'pi',
        'ρ': 'rô', 'σ': 'sigma', 'Σ': 'Sigma', 'τ': 'tau', 'υ': 'ípsilon', 'φ': 'fi', 'χ': 'qui', 'ψ': 'psi', 'ω': 'ômega', 'Ω': 'Ômega',
        '→': '->', '←': '<-', '↔': '<->', '⇒': '=>', '⇐': '<=',
        '―': '—', '‑': '-', '‒': '-',
    };
    function sanitizarTexto(fonte, texto) {
        const s = String(texto == null ? '' : texto);
        if (!s) return s;
        const cs = charSetDe(fonte);
        if (!cs) return s;
        let resultado = '';
        for (const ch of s) {
            resultado += cs.has(ch.codePointAt(0)) ? ch : (SUBSTITUICOES_TEXTO[ch] || '?');
        }
        return resultado;
    }

    // Quebra um texto (pode ter várias linhas/parágrafos, separados por \n)
    // em linhas que cabem em `largura` pontos, na fonte/tamanho dados —
    // pdf-lib não faz isso sozinho (só mede largura de texto já pronto).
    function quebrarLinhas(texto, fonte, tamanho, largura) {
        const linhas = [];
        sanitizarTexto(fonte, texto).split(/\r?\n/).forEach((paragrafo) => {
            const palavras = paragrafo.split(/\s+/).filter(Boolean);
            if (!palavras.length) { linhas.push(''); return; }
            let atual = '';
            palavras.forEach((palavra) => {
                const tentativa = atual ? `${atual} ${palavra}` : palavra;
                if (atual && fonte.widthOfTextAtSize(tentativa, tamanho) > largura) {
                    linhas.push(atual);
                    atual = palavra;
                } else atual = tentativa;
            });
            if (atual) linhas.push(atual);
        });
        return linhas;
    }

    // "Escritor": cursor de página + posição Y, cria páginas A4 novas
    // conforme o conteúdo enche a página atual (mesma ideia de um editor de
    // texto fluindo por várias páginas) — usado pelo Memorial, pelo
    // Currículo completo e pelos Anexos.
    function criarEscritor(pdfDoc, fontes, paginasSemNumero, indicesDivisoria) {
        let pagina = null, y = 0, margemExtra = 0, deslocamentoX = 0;
        // decorador(pagina): redesenhado em TODA página nova, inclusive as
        // criadas automaticamente por garantirEspaco() no meio de uma seção
        // que estourou a página atual — é assim que o cabeçalho corrido do
        // Modelo A e a faixa lateral colorida do Modelo B aparecem em toda
        // página de conteúdo, não só na primeira de cada seção. Quem chama
        // gerar() atualiza o "contexto" (nome da seção atual, cor da
        // categoria) ANTES de desenhar essa seção — ver desenharSidebarB/
        // desenharCabecalhoA e o loop do Currículo completo abaixo.
        let decorador = null;
        function novaPagina() {
            pagina = pdfDoc.addPage([PAGE_W, PAGE_H]);
            y = PAGE_H - MARGIN;
            if (decorador) decorador(pagina);
            return pagina;
        }
        function garantirEspaco(altura) {
            if (!pagina || y - altura < MARGIN) novaPagina();
        }
        // Desenha uma única linha (já quebrada) e avança o cursor — devolve
        // o índice da página onde a linha efetivamente caiu (para o sumário
        // apontar pro lugar certo, mesmo que a seção tenha "estourado" pra
        // uma nova página bem no início).
        function linha(texto, opts) {
            opts = opts || {};
            const fonte = opts.negrito ? fontes.negrito : fontes.regular;
            const tamanho = opts.tamanho || 10;
            const leading = tamanho * (opts.leading || 1.4);
            garantirEspaco(leading);
            const textoSeguro = sanitizarTexto(fonte, texto);
            if (textoSeguro) pagina.drawText(textoSeguro, { x: MARGIN + margemExtra + deslocamentoX + (opts.indent || 0), y, size: tamanho, font: fonte, color: opts.cor || fontes.corTexto });
            y -= leading;
            return pdfDoc.getPageCount() - 1;
        }
        function paragrafo(texto, opts) {
            opts = opts || {};
            const fonte = opts.negrito ? fontes.negrito : fontes.regular;
            const tamanho = opts.tamanho || 10;
            const largura = CONTENT_W - margemExtra - (opts.indent || 0);
            let primeiraPagina = null;
            quebrarLinhas(texto, fonte, tamanho, largura).forEach((l) => {
                const idx = linha(l, opts);
                if (primeiraPagina == null) primeiraPagina = idx;
            });
            return primeiraPagina;
        }
        function espaco(altura) { y -= altura; }
        // Sem página inicial "de graça" aqui — quem monta o relatório sempre
        // chama novaPagina() explicitamente depois de cada divisória (ver
        // gerar() abaixo); criar uma aqui deixaria uma página em branco
        // órfã (nunca usada) entre o sumário e o Memorial/Currículo.
        return {
            novaPagina, garantirEspaco, linha, paragrafo, espaco,
            get pagina() { return pagina; },
            get y() { return y; },
            set y(v) { y = v; },
            get margemExtra() { return margemExtra; },
            set margemExtra(v) { margemExtra = v; },
            // Desloca só a POSIÇÃO X do bloco de texto (não a largura) —
            // usado pelo Modelo B pra aproximar o texto da faixa lateral,
            // deixando mais espaço em branco do lado direito da página (ver
            // UM_CM/gerar()). Valor negativo desloca pra esquerda.
            get deslocamentoX() { return deslocamentoX; },
            set deslocamentoX(v) { deslocamentoX = v; },
            set decorador(fn) { decorador = fn; },
            // Mesmo número que numerarPaginas() vai desenhar no rodapé/topo
            // desta página (capa E sumário ficam sem número; a numeração
            // visível começa em "1" na 1ª página de conteúdo depois do
            // sumário — paginasSemNumero conta quantas páginas vêm antes
            // dela) — usado pelo cabeçalho de cada página de evidência e
            // pelo sumário (entradasSumario[...].paginaIndex), pra dar
            // contexto de posição sem esperar numerarPaginas() rodar (só no
            // fim, depois que o documento inteiro já foi montado). Mesma
            // conta de numeroVisivelDaPagina() (desconta as divisórias
            // internas já criadas até aqui — também sem número, ver
            // desenharDivisoria/numerarPaginas), senão o número mostrado
            // aqui destoaria do que numerarPaginas() de fato estampa na
            // página.
            get numeroPagina() { return numeroVisivelDaPagina(pdfDoc.getPageCount() - 1, paginasSemNumero, indicesDivisoria); },
        };
    }

    // Desenha, embaixo de um título de categoria (Modelo B), a lista de
    // subcategorias (sec.tipos) ligadas a ele por um "conector de árvore"
    // — tronco vertical + um tracinho horizontal por subcategoria — na cor
    // da própria categoria (mesmo desenho já refinado no protótipo da
    // Divisória C). xTexto = mesmo eixo X do título (o tronco fica um
    // pouco à esquerda dele); yTopoTree = Y logo abaixo do título (já
    // descontada a margem entre eles). Devolve o Y após a última linha.
    function desenharSubcategorias(pagina, fontes, xTexto, yTopoTree, cor, subcategorias) {
        const corRgb = fontes.rgb(cor[0], cor[1], cor[2]);
        const tamanho = 15, leading = tamanho * 1.55;
        const xTronco = xTexto - 10;
        let y = yTopoTree;
        const baselines = [];
        subcategorias.forEach((label) => {
            const seguro = sanitizarTexto(fontes.tituloFonte, label);
            pagina.drawText(seguro, { x: xTexto, y, size: tamanho, font: fontes.tituloFonte, color: fontes.corTexto });
            baselines.push(y);
            y -= leading;
        });
        if (!baselines.length) return y;
        const yTopoTronco = yTopoTree + 12;
        const yBaseTronco = baselines[baselines.length - 1] - 3;
        pagina.drawRectangle({ x: xTronco, y: yBaseTronco, width: 1.2, height: yTopoTronco - yBaseTronco, color: corRgb });
        pagina.drawRectangle({ x: xTronco, y: yTopoTronco - 0.6, width: 6, height: 1.2, color: corRgb });
        baselines.forEach((yb) => {
            pagina.drawRectangle({ x: xTronco, y: yb - 0.6, width: xTexto - xTronco - 5, height: 1.2, color: corRgb });
        });
        return y;
    }

    // Página-título de seção ("capa intermediária") — a próxima página já
    // começa "limpa" pro conteúdo real daquela seção. indicesDivisoria
    // (opcional): Set preenchido com o índice (0-based) desta página, pra
    // numerarPaginas() pular — divisória não é "conteúdo numerado", é
    // título de seção (pedido do Alexsandro: "as capas internas não devem
    // ter número de página", mesmo raciocínio já aplicado à capa e ao
    // sumário). modelo/sec (opcionais, default 'A'/null): dois desenhos
    // diferentes, escolhidos entre os mockups do protótipo —
    //   'A' (sóbrio): selo circular com o número da categoria (cor da
    //       categoria, ou cinza neutro sem categoria — Memorial/links),
    //       título centralizado, linhas finas em cima/embaixo.
    //   'B' (colorido): a faixa lateral vira uma cor SÓLIDA (a cor da
    //       categoria — "a bolinha, a barra e as linhas de interligação
    //       têm a mesma cor", pedido do Alexsandro) em vez do índice de 12
    //       cores das páginas de conteúdo; título alinhado à coluna de
    //       texto, com as subcategorias (sec.tipos) listadas abaixo, presas
    //       ao título por um conector de árvore (ver desenharSubcategorias).
    // sec (opcional): a seção/categoria (mesmo objeto de model.secoes —
    // ver buildPublicModel em tab-publicar.js) por trás desta divisória,
    // quando ela tem uma (Memorial e "Evidências em link" não têm
    // categoria própria, então sec fica null/ausente nesses casos).
    function desenharDivisoria(pdfDoc, fontes, titulo, indicesDivisoria, modelo, sec) {
        const pagina = pdfDoc.addPage([PAGE_W, PAGE_H]);
        if (indicesDivisoria) indicesDivisoria.add(pdfDoc.getPageCount() - 1);
        const num = sec && sec.num;
        const cor = num ? corDaCategoria(num) : CINZA_NEUTRO;

        if (modelo === 'B') {
            pagina.drawRectangle({ x: 0, y: 0, width: SIDEBAR_W, height: PAGE_H, color: fontes.rgb(cor[0], cor[1], cor[2]) });
            const xTexto = SIDEBAR_W + 40;
            const larguraTexto = PAGE_W - xTexto - MARGIN;
            let y = PAGE_H - 70;
            const diamSelo = 46;
            if (num) {
                y = desenharSeloCategoria(pagina, fontes, xTexto + diamSelo / 2, y, diamSelo, cor, String(num).padStart(2, '0'));
                y -= 20;
            }
            pagina.drawRectangle({ x: xTexto, y, width: larguraTexto, height: 0.75, color: fontes.corRule });
            y -= 20;

            const fonteTitulo = fontes.tituloFonte;
            const textoSeguro = sanitizarTexto(fonteTitulo, titulo);
            let tamTitulo = 19;
            while (tamTitulo > 13 && fonteTitulo.widthOfTextAtSize(textoSeguro, tamTitulo) > larguraTexto * 2.2) tamTitulo -= 1;
            quebrarLinhas(titulo, fonteTitulo, tamTitulo, larguraTexto).forEach((linha) => {
                pagina.drawText(sanitizarTexto(fonteTitulo, linha), { x: xTexto, y, size: tamTitulo, font: fonteTitulo, color: fontes.corTexto });
                y -= tamTitulo * 1.2;
            });
            y -= 12;

            const subcategorias = sec ? (sec.tipos || []).map((t) => t.label).filter(Boolean).slice(0, 10) : [];
            if (subcategorias.length) desenharSubcategorias(pagina, fontes, xTexto, y, cor, subcategorias);
            return pagina;
        }

        const larguraRegua = 40;
        let y = PAGE_H / 2 + 70;
        pagina.drawRectangle({ x: PAGE_W / 2 - larguraRegua / 2, y, width: larguraRegua, height: 1.5, color: fontes.rgb(cor[0], cor[1], cor[2]) });
        y -= 30;

        const diamSelo = 60;
        if (num) {
            y = desenharSeloCategoria(pagina, fontes, PAGE_W / 2, y, diamSelo, cor, String(num).padStart(2, '0'));
            y -= 24;
        }

        const fonte = fontes.tituloFonte;
        const textoSeguro = sanitizarTexto(fonte, titulo);
        // Título de categoria ("Anexo <romano> — <categoria>") pode ser bem
        // mais comprido que "Memorial"/"Anexos" — encolhe a fonte até caber
        // na largura útil da página em vez de deixar vazar pelas bordas.
        let tamanho = 26;
        while (tamanho > 14 && fonte.widthOfTextAtSize(textoSeguro, tamanho) > CONTENT_W) tamanho -= 1;
        quebrarLinhas(titulo, fonte, tamanho, CONTENT_W).forEach((linha) => {
            const seguro = sanitizarTexto(fonte, linha);
            const largura = fonte.widthOfTextAtSize(seguro, tamanho);
            pagina.drawText(seguro, { x: (PAGE_W - largura) / 2, y, size: tamanho, font: fonte, color: fontes.corTexto });
            y -= tamanho * 1.2;
        });
        y -= 18;
        pagina.drawRectangle({ x: PAGE_W / 2 - larguraRegua / 2, y, width: larguraRegua, height: 1.5, color: fontes.rgb(cor[0], cor[1], cor[2]) });
        return pagina;
    }

    // Faixa lateral colorida do Modelo B, redesenhada em toda página de
    // conteúdo (ver decorador em criarEscritor) — funciona como um índice de
    // dedo (thumb index): a cor + número da categoria dão pra achar a seção
    // certa folheando o PDF impresso, sem abrir o sumário. contexto = { cor,
    // num, label }, atualizado pelo chamador antes de cada seção/divisória.
    // corTexto opcional em contexto — RGB [0-1] pra usar no lugar do branco
    // padrão (necessário na seção de Anexos, cujo cinza claro não teria
    // contraste com texto branco — ver CINZA_CLARO_ANEXOS/gerar()).
    function desenharSidebarB(pagina, fontes, contexto) {
        const cor = fontes.rgb(contexto.cor[0], contexto.cor[1], contexto.cor[2]);
        pagina.drawRectangle({ x: 0, y: 0, width: SIDEBAR_W, height: PAGE_H, color: cor });
        const corTexto = contexto.corTexto ? fontes.rgb(contexto.corTexto[0], contexto.corTexto[1], contexto.corTexto[2]) : fontes.rgb(1, 1, 1);
        if (contexto.num) {
            const numTam = 20;
            const numSeguro = sanitizarTexto(fontes.negrito, contexto.num);
            const numW = fontes.negrito.widthOfTextAtSize(numSeguro, numTam);
            pagina.drawText(numSeguro, { x: (SIDEBAR_W - numW) / 2, y: PAGE_H - 90, size: numTam, font: fontes.negrito, color: corTexto });
        }
        // Rótulo da categoria (texto rotacionado) com o dobro do tamanho
        // original (pedido do Alexsandro — só este, não o número grande
        // acima, pra não estourar a largura da barra em categorias de 2
        // dígitos). Rotação de 90° (sentido anti-horário, convenção do
        // PDF): o "ascent" do texto (que sem rotação ficaria acima da linha
        // de base) passa a apontar pra ESQUERDA do ponto (x,y), e o
        // "descent" pra DIREITA — centralizar na largura da barra exige
        // compensar essa assimetria (métricas padrão da Helvetica: ascent
        // ~0,718em, descent ~0,207em a partir da linha de base), não só
        // metade do tamanho da fonte. A fórmula antiga (deslocamento fixo a
        // partir da borda direita) não escalava certo com o tamanho da
        // fonte — descentralizava ao aumentá-la (pedido do Alexsandro).
        const lbl = sanitizarTexto(fontes.negrito, (contexto.label || '').toUpperCase());
        if (lbl) {
            const lblTam = 15;
            const xLbl = SIDEBAR_W / 2 + (0.718 - 0.207) * lblTam / 2;
            pagina.drawText(lbl, { x: xLbl, y: 90, size: lblTam, font: fontes.negrito, color: corTexto, rotate: fontes.degrees(90) });
        }
    }

    // Cabeçalho corrido do Modelo A, redesenhado em toda página de conteúdo
    // — nome à esquerda, seção atual à direita, uma linha fina embaixo.
    // Resolve o problema de uma folha impressa solta não dizer a que seção
    // do currículo ela pertence (o relatório original não tinha isso).
    // contexto = { nome, secao }, atualizado pelo chamador antes de cada
    // seção/divisória.
    function desenharCabecalhoA(pagina, fontes, contexto) {
        const y = PAGE_H - MARGIN + 16;
        const nomeTxt = sanitizarTexto(fontes.regular, (contexto.nome || '').toUpperCase());
        pagina.drawText(nomeTxt, { x: MARGIN, y, size: 6.5, font: fontes.regular, color: fontes.corMuted });
        const secTxt = sanitizarTexto(fontes.regular, contexto.secao || '');
        const w = fontes.regular.widthOfTextAtSize(secTxt, 6.5);
        pagina.drawText(secTxt, { x: PAGE_W - MARGIN - w, y, size: 6.5, font: fontes.regular, color: fontes.corMuted });
        pagina.drawLine({ start: { x: MARGIN, y: y - 5 }, end: { x: PAGE_W - MARGIN, y: y - 5 }, thickness: 0.5, color: fontes.corRule });
    }

    // Título de CATEGORIA do Modelo B: faixa colorida cobrindo a largura
    // inteira do bloco de texto (não só o texto), com o título em branco por
    // cima — pedido do Alexsandro ("aplicar a cor no fundo da linha na
    // categoria"). Substitui o escritor.linha() em negrito de sempre só
    // nesse ponto específico (o resto do documento continua fluindo pelo
    // escritor normalmente).
    function desenharFaixaCategoria(escritor, fontes, texto, cor) {
        const tamanho = 13, alturaFaixa = 24;
        escritor.garantirEspaco(alturaFaixa + 6);
        const pagina = escritor.pagina;
        const xIni = MARGIN + escritor.margemExtra + escritor.deslocamentoX;
        const xFim = PAGE_W - MARGIN + escritor.deslocamentoX;
        const yTopo = escritor.y + 7;
        pagina.drawRectangle({ x: xIni, y: yTopo - alturaFaixa, width: xFim - xIni, height: alturaFaixa, color: fontes.rgb(cor[0], cor[1], cor[2]) });
        pagina.drawText(sanitizarTexto(fontes.negrito, texto), { x: xIni + 10, y: yTopo - alturaFaixa + 7, size: tamanho, font: fontes.negrito, color: fontes.rgb(1, 1, 1) });
        escritor.y = yTopo - alturaFaixa - 14;
    }

    // Título de SUBCATEGORIA (subtipo) do Modelo B: "destaque" tipo marca-
    // texto — cor de fundo (versão CLARA da cor da categoria) só atrás das
    // PALAVRAS, não da linha inteira — pedido do Alexsandro, pra diferenciar
    // visualmente do tratamento de linha cheia da categoria (acima).
    function desenharDestaqueSubtipo(escritor, fontes, texto, cor, indent) {
        const tamanho = 10, padX = 5, alturaDestaque = 15;
        escritor.garantirEspaco(alturaDestaque + 4);
        const pagina = escritor.pagina;
        const corClara = misturarComBranco(cor, 0.62);
        const xBase = MARGIN + escritor.margemExtra + escritor.deslocamentoX + indent;
        const textoSeguro = sanitizarTexto(fontes.negrito, texto);
        const largura = fontes.negrito.widthOfTextAtSize(textoSeguro, tamanho);
        const yTopo = escritor.y;
        pagina.drawRectangle({ x: xBase, y: yTopo - 3, width: largura + padX * 2, height: alturaDestaque, color: fontes.rgb(corClara[0], corClara[1], corClara[2]) });
        pagina.drawText(textoSeguro, { x: xBase + padX, y: yTopo, size: tamanho, font: fontes.negrito, color: fontes.rgb(cor[0], cor[1], cor[2]) });
        escritor.y -= alturaDestaque + 4;
    }

    // Anexa uma anotação de link (URI) de verdade a um retângulo da página —
    // pdf-lib não tem um "drawLink()" pronto, então monta o dicionário PDF
    // de baixo nível (mesma receita documentada pelo próprio pdf-lib). Fica
    // clicável em qualquer leitor de PDF, não é só texto azul sublinhado.
    function adicionarLink(pdfDoc, PDFName, PDFString, pagina, x, y, w, h, url) {
        const linkAnnot = pdfDoc.context.obj({
            Type: 'Annot', Subtype: 'Link',
            Rect: [x, y, x + w, y + h],
            Border: [0, 0, 0],
            A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
        });
        const linkRef = pdfDoc.context.register(linkAnnot);
        const existentes = pagina.node.lookup(PDFName.of('Annots'));
        if (existentes) existentes.push(linkRef);
        else pagina.node.set(PDFName.of('Annots'), pdfDoc.context.obj([linkRef]));
    }

    // Créditos discretos, logo abaixo do último item do Currículo completo
    // (pedido do Alexsandro — tirou o "Documento gerado em..." da capa e
    // pediu pra virar isto aqui): linha fina 50% centralizada, o texto
    // (com "lattesZen" e o nome do autor como links de verdade, clicáveis),
    // e outra linha fina 50% centralizada embaixo. Fonte regular (não
    // negrito) tamanho 10, cor discreta — não usa o negrito do resto do
    // documento de propósito, pedido "fonte suave".
    function desenharCreditos(pdfDoc, PDFName, PDFString, escritor, fontes) {
        const tamanho = 10, leading = tamanho * 1.5;
        const fonte = fontes.regular;
        const areaW = CONTENT_W - escritor.margemExtra;
        const xCentro = MARGIN + escritor.margemExtra + escritor.deslocamentoX + areaW / 2;
        const larguraLinhaFina = areaW * 0.5;

        const desenharLinhaFina = () => {
            escritor.garantirEspaco(14);
            escritor.pagina.drawLine({
                start: { x: xCentro - larguraLinhaFina / 2, y: escritor.y + 4 },
                end: { x: xCentro + larguraLinhaFina / 2, y: escritor.y + 4 },
                thickness: 0.5, color: fontes.corRule,
            });
            escritor.espaco(14);
        };

        escritor.espaco(10);
        desenharLinhaFina();

        const dataTxt = new Date().toLocaleDateString('pt-BR');
        const segmentos = [
            { texto: `Curriculum Vitae gerado em ${dataTxt} com apoio do software livre ` },
            { texto: 'lattesZen', url: 'https://github.com/alexsandroccarv/latteszen' },
            { texto: ' desenvolvido por ' },
            { texto: 'Alexsandro Cardoso Carvalho', url: 'https://ccarvalho.net' },
            { texto: '.' },
        ];
        const palavras = [];
        segmentos.forEach((seg) => {
            sanitizarTexto(fonte, seg.texto).split(/(\s+)/).forEach((tok) => { if (tok !== '') palavras.push({ tok, url: seg.url }); });
        });
        const larguraMax = areaW * 0.72;
        const linhas = [];
        let atual = [], larguraAtual = 0;
        palavras.forEach((p) => {
            const w = fonte.widthOfTextAtSize(p.tok, tamanho);
            if (atual.length && larguraAtual + w > larguraMax) { linhas.push(atual); atual = []; larguraAtual = 0; }
            if (atual.length === 0 && p.tok.trim() === '') return; // não inicia linha com espaço
            atual.push(p); larguraAtual += w;
        });
        if (atual.length) linhas.push(atual);

        linhas.forEach((linha) => {
            escritor.garantirEspaco(leading);
            const pagina = escritor.pagina;
            const larguraLinha = linha.reduce((s, p) => s + fonte.widthOfTextAtSize(p.tok, tamanho), 0);
            let x = xCentro - larguraLinha / 2;
            linha.forEach((p) => {
                const w = fonte.widthOfTextAtSize(p.tok, tamanho);
                if (p.tok.trim() !== '') {
                    pagina.drawText(p.tok, { x, y: escritor.y, size: tamanho, font: fonte, color: p.url ? fontes.corAccent : fontes.corMuted });
                    if (p.url) adicionarLink(pdfDoc, PDFName, PDFString, pagina, x, escritor.y - 2, w, tamanho + 3, p.url);
                }
                x += w;
            });
            escritor.espaco(leading);
        });

        escritor.espaco(4);
        desenharLinhaFina();
    }

    // Item do Modelo A: desenha o contador (NNN) na cor de destaque, em
    // separado do resto da linha (que continua pelo escritor.paragrafo() de
    // sempre, com recuo suspenso — linhas quebradas alinham com o TEXTO, não
    // com o número). Reaproveita linhaDoItem() e só descarta o prefixo
    // "NNN " que ela mesma gera, pra não duplicar a lógica de formatação
    // (Formação acadêmica com data só no final etc.) em dois lugares.
    function desenharItemA(escritor, fontes, item, contador, indent) {
        const num = String(contador).padStart(3, '0');
        const tamanho = 10;
        const numGap = fontes.negrito.widthOfTextAtSize('000 ', tamanho);
        const textoResto = linhaDoItem(contador, item).slice(num.length + 1);
        escritor.garantirEspaco(tamanho * 1.4);
        const pagina = escritor.pagina, y = escritor.y;
        pagina.drawText(sanitizarTexto(fontes.negrito, num), { x: MARGIN + escritor.margemExtra + escritor.deslocamentoX + indent, y, size: tamanho, font: fontes.negrito, color: fontes.corAccent });
        escritor.paragrafo(textoResto, { tamanho, indent: indent + numGap });
        if (item.linha) escritor.paragrafo(item.linha, { tamanho: 9, cor: fontes.corMuted, indent: indent + numGap });
        escritor.espaco(3);
    }

    // Item do Modelo B: selo circular-quadrado com o contador (borda na cor
    // da categoria) + "chip" de data (fundo CLARO — mistura da cor da
    // categoria com branco — texto na cor cheia, pedido do Alexsandro) +
    // título em negrito, com o texto e a linha secundária desenhados pelo
    // escritor de sempre (multi-linha/paginação já resolvidos ali).
    function desenharItemB(escritor, fontes, cor, item, contador, indent) {
        const tamanho = 10;
        const anoTxt = item.typeKey === 'FORMACAO_ACADEMICA' ? (item.ano ? `(${item.ano})` : '') : (item.ano || '');
        const tituloTxt = tituloParaLinha(item) + sufixoCargaHoraria(item);
        const corClara = misturarComBranco(cor, 0.62);

        const numTxt = String(contador).padStart(2, '0');
        const numFonte = fontes.negrito, numTam = 8;
        const numLargura = Math.max(16, numFonte.widthOfTextAtSize(numTxt, numTam) + 6);

        const chipFonte = fontes.negrito, chipTam = 8;
        const chipTxtSeguro = sanitizarTexto(chipFonte, anoTxt);
        const chipLargura = anoTxt ? chipFonte.widthOfTextAtSize(chipTxtSeguro, chipTam) + 8 : 0;
        const offsetTexto = numLargura + (chipLargura ? chipLargura + 6 : 0);

        escritor.garantirEspaco(tamanho * 1.4);
        const pagina = escritor.pagina;
        const xBase = MARGIN + escritor.margemExtra + escritor.deslocamentoX + indent;
        const y = escritor.y;

        pagina.drawRectangle({ x: xBase, y: y - 2, width: numLargura - 3, height: tamanho + 1, borderColor: fontes.rgb(cor[0], cor[1], cor[2]), borderWidth: 0.75, color: fontes.rgb(1, 1, 1) });
        const numW = numFonte.widthOfTextAtSize(numTxt, numTam);
        pagina.drawText(numTxt, { x: xBase + (numLargura - 3 - numW) / 2, y: y + 0.5, size: numTam, font: numFonte, color: fontes.rgb(cor[0], cor[1], cor[2]) });

        if (anoTxt) {
            pagina.drawRectangle({ x: xBase + numLargura, y: y - 2, width: chipLargura, height: tamanho + 1, color: fontes.rgb(corClara[0], corClara[1], corClara[2]) });
            pagina.drawText(chipTxtSeguro, { x: xBase + numLargura + 4, y: y + 0.5, size: chipTam, font: chipFonte, color: fontes.rgb(cor[0], cor[1], cor[2]) });
        }

        escritor.paragrafo(tituloTxt, { tamanho, indent: indent + offsetTexto, negrito: true });
        if (item.linha) escritor.paragrafo(item.linha, { tamanho: 9, cor: fontes.corMuted, indent: indent + offsetTexto });
        escritor.espaco(5);
    }

    function dataUriParaBytes(dataUri) {
        const virgula = dataUri.indexOf(',');
        const base64 = virgula >= 0 ? dataUri.slice(virgula + 1) : dataUri;
        const bin = atob(base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
    }
    // gif/webp: pdf-lib só embute JPG/PNG diretamente — converte via <canvas>
    // (nenhuma biblioteca extra pra isso, o navegador decodifica sozinho).
    function converterParaPng(dataUri) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || 1; canvas.height = img.naturalHeight || 1;
                canvas.getContext('2d').drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => reject(new Error('Falha ao decodificar a imagem.'));
            img.src = dataUri;
        });
    }

    // Formação acadêmica/titulação: LattesTypes.itemTitle() já prefixa o
    // título com o período ("2018-2022 Doutorado · Ciência X") — bom nas
    // demais telas do app, mas duplicava a data no relatório, que já
    // acrescenta item.ano no FINAL da linha ("... (2018–2022)"). Mantém a
    // data só no final aqui, removendo o prefixo (ano ou "ano-ano" seguido
    // de espaço) só para este tipo — os demais tipos não têm esse prefixo,
    // então o replace() não acha nada e não faz diferença.
    function tituloParaLinha(item) {
        if (item.typeKey !== 'FORMACAO_ACADEMICA') return item.titulo;
        return item.titulo.replace(/^\d{4}(-\d{4})?\s+/, '');
    }

    // Carga horária (campo "cargaHoraria", presente em Eventos/Formação/
    // Vínculo profissional/Produção técnica etc. — ver tab-publicar.js, que
    // já repassa esse valor no item achatado) mostrada no FINAL do item,
    // entre parênteses — pedido do Alexsandro. "Não se aplica" (marcação
    // explícita de N/A) não mostra nada, igual a campo vazio.
    function sufixoCargaHoraria(item) {
        const ch = item.cargaHoraria;
        if (!ch || ch === window.AppCore.NA_VALUE) return '';
        return ` (${ch} h)`;
    }

    // Contador (001, 002...) no início de cada item — reinicia a cada
    // subtipo/tipo (o `contador` já vem calculado por escreverItens()
    // abaixo, sempre a partir de 1 para cada lista de itens nova). Ordem
    // padrão: "NNN ano título". Formação acadêmica/titulação foge à regra
    // (ver tituloParaLinha) — mantém a data só no final: "NNN título (ano)".
    // Carga horária (ver sufixoCargaHoraria), quando existe, fica por
    // último — depois do "(ano)" na Formação, no fim de tudo nos demais.
    function linhaDoItem(contador, item) {
        const num = String(contador).padStart(3, '0');
        const chSufixo = sufixoCargaHoraria(item);
        if (item.typeKey === 'FORMACAO_ACADEMICA') {
            const anoTxt = item.ano ? ` (${item.ano})` : '';
            return `${num} ${tituloParaLinha(item)}${anoTxt}${chSufixo}`;
        }
        const anoPrefixo = item.ano ? `${item.ano} ` : '';
        return `${num} ${anoPrefixo}${item.titulo}${chSufixo}`;
    }

    // Atribui a cada item do modelo o contador (NNN) e a cor de categoria
    // que ele vai exibir no Currículo completo — ANTES de qualquer
    // renderização (chamado uma vez, logo no início de gerar()). Única fonte
    // de verdade pros dois lugares que mostram essa numeração/cor sempre
    // baterem: a lista de itens (escreverItens, abaixo) e o cabeçalho da
    // página de evidência do mesmo item (ver desenharPaginaEvidencia) —
    // inclusive no modo "apenas evidências", onde o Currículo nem chega a
    // ser desenhado. Contador reinicia a cada tipo, EXCETO em Atuação
    // (tipo.subgrupos), onde é único por instituição — continua de um
    // subtipo para o outro (pedido do Alexsandro: "mantenha a divisão por
    // subitens mas use uma única numeração").
    function atribuirNumeracaoItens(model) {
        model.secoes.forEach((sec) => {
            const cor = corDaCategoria(sec.num);
            sec.tipos.forEach((tipo) => {
                let contador = 1;
                const marcar = (item) => { item._pdfContador = contador; item._pdfCor = cor; contador += 1; };
                if (tipo.subgrupos) tipo.subgrupos.forEach((sub) => sub.itens.forEach(marcar));
                else tipo.itens.forEach(marcar);
            });
        });
    }

    // Escreve uma lista de itens (já ordenada) — contador/cor de cada item
    // já vêm atribuídos por atribuirNumeracaoItens() (ver gerar()). modelo
    // seleciona entre desenharItemA (contador na cor de destaque fixa,
    // linha corrida) e desenharItemB (selo + chip de data na cor da
    // categoria).
    function escreverItens(escritor, fontes, itens, indent, modelo) {
        itens.forEach((item) => {
            if (modelo === 'B') desenharItemB(escritor, fontes, item._pdfCor, item, item._pdfContador, indent);
            else desenharItemA(escritor, fontes, item, item._pdfContador, indent);
        });
    }

    // Percorre o modelo (mesmas seções/tipos/itens da página pública) e
    // devolve a lista achatada de {item, anexo} — só evidências realmente
    // marcadas "pública" chegam aqui (buildPublicModel/itemAnexos já filtra).
    // itemTitulo fica mantido à parte (não só dentro de item) por
    // conveniência de quem só precisa do texto.
    function anexosDoModelo(model) {
        const lista = [];
        const registrar = (item) => (item.anexos || []).forEach((anexo) => lista.push({ itemTitulo: item.titulo, item, anexo }));
        model.secoes.forEach((sec) => sec.tipos.forEach((tipo) => {
            // Atuação: "tipo" é uma instituição, com os itens agrupados por
            // subtipo em tipo.subgrupos em vez de tipo.itens direto (ver
            // buildPublicModel em tab-publicar.js).
            if (tipo.subgrupos) tipo.subgrupos.forEach((sub) => sub.itens.forEach(registrar));
            else tipo.itens.forEach(registrar);
        }));
        return lista;
    }

    // Mesmo percurso de anexosDoModelo(), mas escopado a UMA seção/categoria
    // e só evidências de ARQUIVO (não link — ver anexo.ext === 'url') — usado
    // pra organizar os Anexos por categoria ("Anexo I", "Anexo II"...), já
    // que evidências em link não geram página própria (continuam juntas, ao
    // final, em "Evidências em link").
    function anexosDaSecaoSemLink(sec) {
        const lista = [];
        const registrar = (item) => (item.anexos || []).forEach((anexo) => { if (anexo.ext !== 'url') lista.push({ item, anexo }); });
        sec.tipos.forEach((tipo) => {
            if (tipo.subgrupos) tipo.subgrupos.forEach((sub) => sub.itens.forEach(registrar));
            else tipo.itens.forEach(registrar);
        });
        return lista;
    }

    // Numeral romano (I, II, III...) pros títulos "Anexo <romano> —
    // <categoria>" no sumário/relatório — nunca passa de ~20 (nº de
    // categorias), então não precisa lidar com milhares.
    function numeroRomano(n) {
        const valores = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
        let resto = n, out = '';
        valores.forEach(([v, s]) => { while (resto >= v) { out += s; resto -= v; } });
        return out;
    }

    // Uma página de evidência: cabeçalho com o número da página do
    // relatório (canto superior direito — mesmo número que numerarPaginas()
    // vai desenhar no rodapé/topo) e a IDENTIFICAÇÃO DO ITEM — reaproveita
    // desenharItemA/desenharItemB, o MESMO contador/título/linha
    // secundária/cores já usados pra esse item lá no Currículo completo
    // (ver atribuirNumeracaoItens), pedido do Alexsandro pra bater
    // exatamente com o que a pessoa já viu antes, folheando o relatório —
    // depois uma linha fina, a evidência reduzida de forma SEMPRE
    // proporcional (nunca estica um eixo mais que o outro) pra caber no
    // espaço disponível, e "Evidência disponível em: ..." no rodapé da
    // página (ver linhaEvidenciaDisponivelEm) — pedido do Alexsandro: antes
    // essa linha ficava colada no cabeçalho, junto do nome do arquivo.
    // `desenhar(pagina, area)` faz o drawImage/drawPage de verdade — este
    // helper só cuida do layout comum entre os dois casos (anexarEvidencias).
    function desenharPaginaEvidencia(escritor, fontes, modelo, item, anexo, larguraNatural, alturaNatural, desenhar) {
        escritor.novaPagina();
        const pagina = escritor.pagina;
        const xBase = MARGIN + escritor.margemExtra + escritor.deslocamentoX;
        const xFim = PAGE_W - MARGIN + escritor.deslocamentoX;

        // Modelo A: número também aqui no topo (o rodapé, onde
        // numerarPaginas() desenha o de verdade, fica no centro — longe —
        // então este funciona como um preview). Modelo B: dispensa —
        // numerarPaginas() já estampa esse mesmo número no canto superior
        // direito de TODA página de conteúdo (mesmo canto), desenhar de
        // novo aqui duplicaria o número na página.
        if (modelo !== 'B') {
            const numTam = 9;
            const numero = String(escritor.numeroPagina);
            const numLargura = fontes.regular.widthOfTextAtSize(numero, numTam);
            pagina.drawText(numero, { x: xFim - numLargura, y: escritor.y, size: numTam, font: fontes.regular, color: fontes.corMuted });
            escritor.espaco(numTam * 1.5);
        }

        desenharIdentificacaoItem(escritor, fontes, modelo, item);

        escritor.espaco(6);
        pagina.drawLine({ start: { x: xBase, y: escritor.y + 3 }, end: { x: xFim, y: escritor.y + 3 }, thickness: 0.5, color: fontes.corRule });
        escritor.espaco(6);

        const rodape = desenharRodapeEvidencia(pagina, fontes, escritor, anexo);

        // A EVIDÊNCIA em si (imagem/PDF) ganha uma margem bem mais estreita
        // que o resto da página (1cm em vez dos ~2cm de MARGIN) — pedido do
        // Alexsandro pra ampliar a exibição (~10-20% a mais de área) sem
        // mexer na identificação do item nem no rodapé, que continuam na
        // margem normal do relatório. No Modelo B, a barra lateral (largura
        // fixa, não é "margem") continua sendo o limite à esquerda.
        const xEvid = modelo === 'B' ? SIDEBAR_W + UM_CM : UM_CM;
        const xEvidFim = PAGE_W - UM_CM;
        const areaW = xEvidFim - xEvid, areaH = Math.max(60, escritor.y - MARGIN - rodape.altura);
        const escala = Math.min(areaW / larguraNatural, areaH / alturaNatural, 1);
        const w = larguraNatural * escala, h = alturaNatural * escala;
        const x = xEvid + (areaW - w) / 2, y = MARGIN + rodape.altura + (areaH - h) / 2;
        desenhar(pagina, { x, y, w, h });
    }

    // "Evidência disponível em: ..." no rodapé da página (canto inferior
    // esquerdo, acima do número de página que numerarPaginas() desenha por
    // último) — pedido do Alexsandro. anexo.caminho já vem pronto de
    // itemAnexos() (tab-publicar.js): "/Modo: ~/pasta raiz/Evidências/NN
    // Categoria/id-evidencia.ext". Evidências em link (sem caminho local)
    // caem no fallback anexo.name. Devolve a altura reservada, pra quem
    // chama encolher a área da evidência (imagem/PDF) por essa mesma
    // medida em vez de desenhar por cima.
    function linhaEvidenciaDisponivelEm(anexo) {
        return `Evidência disponível em: ${anexo.caminho || anexo.name}`;
    }
    function desenharRodapeEvidencia(pagina, fontes, escritor, anexo) {
        const xBase = MARGIN + escritor.margemExtra + escritor.deslocamentoX;
        const largura = CONTENT_W - escritor.margemExtra;
        const tamanho = 8.5, leading = tamanho * 1.35;
        const linhas = quebrarLinhas(linhaEvidenciaDisponivelEm(anexo), fontes.regular, tamanho, largura);
        const altura = linhas.length * leading + 4;
        let y = MARGIN + altura - leading + 2;
        linhas.forEach((linha) => {
            pagina.drawText(sanitizarTexto(fontes.regular, linha), { x: xBase, y, size: tamanho, font: fontes.regular, color: fontes.corMuted });
            y -= leading;
        });
        return { altura };
    }

    // Mesma identificação de item usada em desenharPaginaEvidencia() e nos
    // 3 casos de anexarEvidencias() que não têm arquivo pra desenhar (link,
    // extensão não suportada, erro ao anexar) — extraído pra não repetir o
    // if(modelo === 'B') três vezes.
    function desenharIdentificacaoItem(escritor, fontes, modelo, item) {
        if (modelo === 'B') desenharItemB(escritor, fontes, item._pdfCor, item, item._pdfContador, 0);
        else desenharItemA(escritor, fontes, item, item._pdfContador, 0);
    }

    // Anexa de fato os arquivos de evidência: cada página de PDF (uma ou
    // várias) e cada imagem viram sua PRÓPRIA página no relatório, com
    // cabeçalho (nome do item + nº da página) e reduzidas proporcionalmente
    // pra caber no espaço abaixo dele — ver desenharPaginaEvidencia(). Tipos
    // não suportados (vídeo/zip) e erros ao anexar viram uma nota em texto;
    // nada é descartado silenciosamente. Organizadas por CATEGORIA — cada
    // categoria com evidência de arquivo é um grupo em `grupos` (ver gerar():
    // gruposAnexo, montado ANTES, junto do sumário, pra já saber os títulos
    // "Anexo <romano> — <categoria>"). Evidências em LINK entram à parte, ao
    // final (linksNota), já que não geram página própria pra "pertencer" a
    // uma categoria. `paginasDivisao` (opção escolhida por quem gera o
    // relatório): com uma página de divisão dedicada por categoria (mesmo
    // estilo do Memorial) ou sem nenhuma, direto pro primeiro item — nos
    // dois casos, o número de página da 1ª página de cada categoria é
    // gravado na entrada do sumário correspondente (grupo.entrada).
    async function anexarEvidencias(pdfDoc, PDFLib, escritor, fontes, modelo, grupos, linksNota, entradaLinks, paginasDivisao, indicesDivisoria, contextoB) {
        const { PDFDocument } = PDFLib;
        for (const grupo of grupos) {
            // Barra lateral (modelo B) segue a categoria de cada bloco de
            // anexos — "Anexo | <categoria>" na cor real da categoria — em
            // vez do rótulo/cinza neutro fixo (pedido do Alexsandro; não
            // se aplica à própria página de divisória, que já usa a cor da
            // categoria por conta própria).
            if (contextoB) {
                if (grupo.sec && grupo.sec.num) {
                    Object.assign(contextoB, { cor: corDaCategoria(grupo.sec.num), num: grupo.sec.num, label: `Anexo | ${grupo.sec.label}`, corTexto: undefined });
                } else {
                    Object.assign(contextoB, { cor: CINZA_CLARO_ANEXOS, num: null, label: `Anexo | ${grupo.sec.label}`, corTexto: TEXTO_ESCURO_ANEXOS });
                }
            }
            if (paginasDivisao) desenharDivisoria(pdfDoc, fontes, grupo.entrada.titulo, indicesDivisoria, modelo, grupo.sec);
            let primeiraPaginaRegistrada = false;
            const registrarPrimeiraPagina = () => {
                if (!primeiraPaginaRegistrada) { grupo.entrada.paginaIndex = escritor.numeroPagina; primeiraPaginaRegistrada = true; }
            };
            for (const { item, anexo } of grupo.itens) {
                try {
                    if (anexo.ext === 'pdf') {
                        const bytes = dataUriParaBytes(anexo.dataUri);
                        const origem = await PDFDocument.load(bytes, { ignoreEncryption: true });
                        const paginasEmbutidas = await pdfDoc.embedPdf(origem, origem.getPageIndices());
                        paginasEmbutidas.forEach((embutida) => {
                            desenharPaginaEvidencia(escritor, fontes, modelo, item, anexo, embutida.width, embutida.height, (pagina, area) => {
                                pagina.drawPage(embutida, { x: area.x, y: area.y, width: area.w, height: area.h });
                            });
                            registrarPrimeiraPagina();
                        });
                    } else if (window.AppCore.isImageExt(anexo.ext)) {
                        let dataUri = anexo.dataUri;
                        let ehPng = /^(png)$/i.test(anexo.ext);
                        if (/^(gif|webp)$/i.test(anexo.ext)) { dataUri = await converterParaPng(dataUri); ehPng = true; }
                        const bytes = dataUriParaBytes(dataUri);
                        const imagem = ehPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
                        desenharPaginaEvidencia(escritor, fontes, modelo, item, anexo, imagem.width, imagem.height, (pagina, area) => {
                            pagina.drawImage(imagem, { x: area.x, y: area.y, width: area.w, height: area.h });
                        });
                        registrarPrimeiraPagina();
                    } else {
                        escritor.novaPagina();
                        desenharIdentificacaoItem(escritor, fontes, modelo, item);
                        escritor.espaco(8);
                        escritor.paragrafo(`Arquivo do tipo ".${anexo.ext}" não pode ser incluído dentro do PDF — consulte a pasta/Google Drive configurado para abri-lo.`, { cor: fontes.corMuted });
                        desenharRodapeEvidencia(escritor.pagina, fontes, escritor, anexo);
                        registrarPrimeiraPagina();
                    }
                } catch (e) {
                    escritor.novaPagina();
                    desenharIdentificacaoItem(escritor, fontes, modelo, item);
                    escritor.espaco(8);
                    escritor.paragrafo(`Não foi possível incluir este arquivo automaticamente (${e.message || 'formato inválido'}).`, { cor: fontes.corMuted });
                    desenharRodapeEvidencia(escritor.pagina, fontes, escritor, anexo);
                    registrarPrimeiraPagina();
                }
            }
        }
        if (linksNota.length) {
            if (contextoB) Object.assign(contextoB, { cor: CINZA_CLARO_ANEXOS, num: null, label: 'Anexos', corTexto: TEXTO_ESCURO_ANEXOS });
            if (paginasDivisao) desenharDivisoria(pdfDoc, fontes, entradaLinks.titulo, indicesDivisoria, modelo, null);
            escritor.novaPagina();
            if (entradaLinks) entradaLinks.paginaIndex = escritor.numeroPagina;
            escritor.linha('Evidências em link (endereço na web, sem arquivo para anexar)', { negrito: true, tamanho: 12 });
            escritor.espaco(6);
            linksNota.forEach(({ item, anexo }) => {
                desenharIdentificacaoItem(escritor, fontes, modelo, item);
                const rotulo = anexo.tag ? `${anexo.tag} | ${anexo.name}` : anexo.name;
                escritor.paragrafo(`${rotulo}: ${anexo.url}`, { tamanho: 9, cor: fontes.corMuted, indent: 10 });
                escritor.espaco(4);
            });
        }
    }

    // Linhas de contato mostradas na capa — ORCID, telefone e e-mail, cada
    // uma só quando preenchida (pedido do Alexsandro: "prever... telefone e
    // email para contato"). Campos telefone/email vêm de Identificação
    // (Catalogar → Dados gerais), repassados por buildPublicModel.
    function linhasContatoCapa(model) {
        const linhas = [];
        if (model.orcid) linhas.push(`ORCID: ${model.orcid}`);
        if (model.telefone) linhas.push(model.telefone);
        if (model.email) linhas.push(model.email);
        return linhas;
    }

    // Distribui uma lista de [palavra, frequência] (já ordenada, mais
    // frequente primeiro — mesmo formato de TabLinhaTempo.contarPalavras())
    // num "fluxo" de linhas que quebram dentro de larguraMax, cada palavra
    // com tamanho de fonte proporcional à frequência (mesma escala linear
    // já usada por TabLinhaTempo.renderNuvemPalavras() no app — aqui em
    // pontos, não rem). Layout "editorial" (linhas que quebram e
    // centralizam), não o espiral com detecção de colisão da versão web:
    // mais simples de portar pro pdf-lib (sem DOM/canvas pra medir texto) e
    // mais legível numa página impressa. As `nDestaque` palavras mais
    // frequentes ganham negrito + uma cor da paleta de categorias
    // (cor.length delas, cíclico); o resto fica em 2 tons de cinza,
    // proporcional ao tamanho. Pura (só usa fonte.widthOfTextAtSize) —
    // exposta só para teste.
    function layoutNuvemFlow(palavras, fonteRegular, fonteNegrito, opts) {
        opts = opts || {};
        if (!palavras || !palavras.length) return { spans: [], altura: 0 };
        const larguraMax = opts.larguraMax;
        const tamMin = opts.tamMin != null ? opts.tamMin : 8;
        const tamMax = opts.tamMax != null ? opts.tamMax : 24;
        const nDestaque = opts.nDestaque || 0;
        const gapX = opts.gapX != null ? opts.gapX : 6;
        const gapY = opts.gapY != null ? opts.gapY : 4;
        const lineHeight = opts.lineHeight || 1.15;
        const coresDestaque = opts.coresDestaque || [[0.075, 0.318, 0.706]];
        const corMedia = opts.corMedia || [0.11, 0.11, 0.11];
        const corMuted = opts.corMuted || [0.55, 0.55, 0.52];
        const align = opts.align || 'center';

        const max = palavras[0][1];
        const min = palavras[palavras.length - 1][1];
        const tamanhoDe = (n) => (max === min ? (tamMin + tamMax) / 2 : tamMin + ((n - min) / (max - min)) * (tamMax - tamMin));
        const meio = tamMin + (tamMax - tamMin) * 0.55;

        const itens = palavras.map(([w, n], i) => {
            const tamanho = tamanhoDe(n);
            const destaque = i < nDestaque;
            const fonte = destaque || tamanho >= meio ? fonteNegrito : fonteRegular;
            const cor = destaque ? coresDestaque[i % coresDestaque.length] : (tamanho >= meio ? corMedia : corMuted);
            const largura = fonte.widthOfTextAtSize(w, tamanho);
            return { texto: w, tamanho, fonte, cor, largura };
        });

        const linhas = [];
        let atual = [], larguraAtual = 0;
        itens.forEach((item) => {
            const acrescimo = item.largura + (atual.length ? gapX : 0);
            if (atual.length && larguraAtual + acrescimo > larguraMax) {
                linhas.push(atual);
                atual = [item];
                larguraAtual = item.largura;
            } else {
                atual.push(item);
                larguraAtual += acrescimo;
            }
        });
        if (atual.length) linhas.push(atual);

        const spans = [];
        let y = 0;
        linhas.forEach((linha) => {
            const alturaLinha = Math.max(...linha.map((it) => it.tamanho)) * lineHeight;
            const larguraLinha = linha.reduce((s, it, i) => s + it.largura + (i ? gapX : 0), 0);
            let x = align === 'left' ? 0 : (larguraMax - larguraLinha) / 2;
            linha.forEach((it) => {
                spans.push({ texto: it.texto, tamanho: it.tamanho, cor: it.cor, fonte: it.fonte, x, y: y + alturaLinha });
                x += it.largura + gapX;
            });
            y += alturaLinha + gapY;
        });
        return { spans, altura: Math.max(0, y - gapY) };
    }

    // Selo circular colorido com o número da categoria em branco,
    // centralizado — versão "grande" (capa/divisórias) do índice numérico
    // já usado na faixa lateral (ver desenharSidebarB). cx = centro
    // horizontal; yTopo = topo do círculo (Y decresce a partir daí,
    // convenção pdf-lib). Devolve o Y da base do círculo, pra continuar o
    // layout abaixo dele.
    function desenharSeloCategoria(pagina, fontes, cx, yTopo, diametro, cor, numero) {
        const cy = yTopo - diametro / 2;
        pagina.drawCircle({ x: cx, y: cy, size: diametro / 2, color: fontes.rgb(cor[0], cor[1], cor[2]) });
        if (numero) {
            const numSeguro = sanitizarTexto(fontes.negrito, numero);
            const tam = diametro * 0.32;
            const w = fontes.negrito.widthOfTextAtSize(numSeguro, tam);
            pagina.drawText(numSeguro, { x: cx - w / 2, y: cy - tam * 0.36, size: tam, font: fontes.negrito, color: fontes.rgb(1, 1, 1) });
        }
        return yTopo - diametro;
    }

    // Capa do Modelo B — "nuvem em destaque": cabeçalho compacto (foto,
    // nome, ORCID), nuvem de palavras (termos mais frequentes do catálogo)
    // como elemento central da capa, e o texto inicial do Currículo Lattes
    // (RESUMO_CV) como epígrafe logo abaixo dela — escolhida entre 3
    // propostas de mockup (pedido do Alexsandro: incluir a nuvem e o texto
    // inicial na capa). Telefone/e-mail viraram um bloco à parte, mais
    // discreto, alinhado à direita perto do rodapé (pedido do Alexsandro:
    // separar do ORCID, que fica junto do nome). A nuvem faz o mesmo papel
    // visual que a pirâmide de tijolos fazia antes (preenche o espaço, dá
    // cor à capa) — mas com informação de verdade, no espírito já usado na
    // faixa lateral colorida do resto do Modelo B.
    function desenharCapaB(pagina, fontes, model, subtitulo, fotoImg) {
        const faixaH = PAGE_H / PALETA_CATEGORIAS.length;
        PALETA_CATEGORIAS.forEach((cor, i) => {
            pagina.drawRectangle({ x: 0, y: PAGE_H - (i + 1) * faixaH - 0.5, width: SIDEBAR_W, height: faixaH + 1, color: fontes.rgb(cor[0], cor[1], cor[2]) });
        });

        const xTexto = SIDEBAR_W + 54;
        const larguraTexto = PAGE_W - xTexto - MARGIN;
        const cxTexto = xTexto + larguraTexto / 2;
        const larguraBloco = Math.min(larguraTexto, 340);
        const xBloco = cxTexto - larguraBloco / 2;

        // Subtítulo ("Curriculum Vitae"/"Evidências") fixo perto do topo da
        // coluna de texto, centralizado — sai do caminho do cabeçalho/nuvem
        // logo abaixo, em vez de competir por espaço com eles.
        const subTam = 10;
        const subSeguro = sanitizarTexto(fontes.negrito, subtitulo.toUpperCase());
        const subLargura = fontes.negrito.widthOfTextAtSize(subSeguro, subTam);
        pagina.drawText(subSeguro, { x: cxTexto - subLargura / 2, y: PAGE_H - 46, size: subTam, font: fontes.negrito, color: fontes.corAccent });

        let y = PAGE_H - 100;
        if (fotoImg) {
            const lado = 76;
            const escala = Math.min(lado / fotoImg.width, lado / fotoImg.height);
            const w = fotoImg.width * escala, h = fotoImg.height * escala;
            pagina.drawImage(fotoImg, { x: cxTexto - w / 2, y: y - h, width: w, height: h });
            y -= h + 16;
        }

        const nomeTam = 20;
        quebrarLinhas(model.nome, fontes.nomeFonte, nomeTam, larguraTexto).forEach((linha) => {
            const seguro = sanitizarTexto(fontes.nomeFonte, linha);
            const w = fontes.nomeFonte.widthOfTextAtSize(seguro, nomeTam);
            pagina.drawText(seguro, { x: cxTexto - w / 2, y, size: nomeTam, font: fontes.nomeFonte, color: fontes.corTextoCapa });
            y -= nomeTam * 1.15;
        });

        if (model.orcid) {
            y -= 4;
            const seguro = sanitizarTexto(fontes.regular, `ORCID: ${model.orcid}`);
            const w = fontes.regular.widthOfTextAtSize(seguro, 9);
            pagina.drawText(seguro, { x: cxTexto - w / 2, y, size: 9, font: fontes.regular, color: fontes.corTextoCapaMuted });
            y -= 16;
        }

        y -= 6;
        pagina.drawRectangle({ x: xTexto, y, width: larguraTexto, height: 0.75, color: fontes.corRule });
        y -= 24;

        // Nuvem de palavras — limitada aos ~18 termos mais frequentes, pra
        // caber com folga numa capa (página única, sem overflow pra
        // próxima página).
        const nuvemPalavras = (model.nuvemPalavras || []).slice(0, 18);
        if (nuvemPalavras.length) {
            const nuvem = layoutNuvemFlow(nuvemPalavras, fontes.regular, fontes.negrito, {
                larguraMax: larguraBloco, tamMin: 8, tamMax: 22, nDestaque: 3, gapX: 5, gapY: 3,
                coresDestaque: [PALETA_CATEGORIAS[2], PALETA_CATEGORIAS[4], PALETA_CATEGORIAS[6]],
                corMedia: [0.11, 0.11, 0.11], corMuted: [0.55, 0.55, 0.52],
            });
            nuvem.spans.forEach((span) => {
                const seguro = sanitizarTexto(span.fonte, span.texto);
                pagina.drawText(seguro, { x: xBloco + span.x, y: y - span.y, size: span.tamanho, font: span.fonte, color: fontes.rgb(span.cor[0], span.cor[1], span.cor[2]) });
            });
            y -= nuvem.altura + 18;
        }

        // Texto inicial do Currículo Lattes (RESUMO_CV), como epígrafe —
        // limitado a 6 linhas (mesma lógica de segurança da nuvem acima).
        if (model.bio) {
            const bioTam = 9;
            quebrarLinhas(model.bio, fontes.regular, bioTam, larguraBloco).slice(0, 6).forEach((linha) => {
                const seguro = sanitizarTexto(fontes.regular, linha);
                const w = fontes.regular.widthOfTextAtSize(seguro, bioTam);
                pagina.drawText(seguro, { x: cxTexto - w / 2, y, size: bioTam, font: fontes.regular, color: fontes.rgb(0.36, 0.36, 0.33) });
                y -= bioTam * 1.55;
            });
        }

        // Telefone/e-mail — bloco à parte, mais discreto, alinhado à
        // direita da coluna de texto, ancorado perto do rodapé (posição
        // fixa, não encadeado ao fim da nuvem/bio acima — evita colidir com
        // conteúdo variável, capa é página única sem "próxima página").
        const contatos = [model.telefone, model.email].filter(Boolean);
        if (contatos.length) {
            let yContato = 108;
            contatos.forEach((txt) => {
                const seguro = sanitizarTexto(fontes.regular, txt);
                const w = fontes.regular.widthOfTextAtSize(seguro, 9);
                pagina.drawText(seguro, { x: PAGE_W - MARGIN - w, y: yContato, size: 9, font: fontes.regular, color: fontes.corTextoCapaMuted });
                yContato -= 15;
            });
        }

        // Linha fina + ano corrente, no rodapé, centralizada na coluna de
        // texto — fecha a capa com uma marca discreta.
        const ano = String(new Date().getFullYear());
        const anoSeguro = sanitizarTexto(fontes.regular, ano);
        const anoLargura = fontes.regular.widthOfTextAtSize(anoSeguro, 9);
        pagina.drawRectangle({ x: cxTexto - 12, y: 40, width: 24, height: 0.75, color: fontes.corRule });
        pagina.drawText(anoSeguro, { x: cxTexto - anoLargura / 2, y: 26, size: 9, font: fontes.regular, color: fontes.corTextoCapaMuted });
    }

    // Nome/foto/ORCID do Ego (Identificação) — mesmos dados já resolvidos
    // pelo modelo da página pública (buildPublicModel), sem reler o catálogo.
    function desenharCapa(pdfDoc, fontes, modelo, model, subtitulo, fotoImg) {
        const pagina = pdfDoc.addPage([PAGE_W, PAGE_H]);
        pagina.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: fontes.corCapaFundo });

        if (modelo === 'B') {
            desenharCapaB(pagina, fontes, model, subtitulo, fotoImg);
            return pagina;
        }

        const linhasContato = linhasContatoCapa(model);
        pagina.drawRectangle({ x: PAGE_W / 2 - 20, y: PAGE_H - 64, width: 40, height: 2, color: fontes.corAccent });
        pagina.drawRectangle({ x: PAGE_W / 2 - 20, y: 62, width: 40, height: 2, color: fontes.corAccent });
        let y = PAGE_H - 220;
        if (fotoImg) {
            const lado = 130;
            const escala = Math.min(lado / fotoImg.width, lado / fotoImg.height);
            const w = fotoImg.width * escala, h = fotoImg.height * escala;
            pagina.drawImage(fotoImg, { x: (PAGE_W - w) / 2, y: y - h, width: w, height: h });
            y -= h + 30;
        }
        const nomeTam = 24;
        const nomeSeguro = sanitizarTexto(fontes.nomeFonte, model.nome);
        const nomeLargura = fontes.nomeFonte.widthOfTextAtSize(nomeSeguro, nomeTam);
        pagina.drawText(nomeSeguro, { x: (PAGE_W - nomeLargura) / 2, y, size: nomeTam, font: fontes.nomeFonte, color: fontes.corTextoCapa });
        y -= 34;
        const subTam = 14;
        const subSeguro = sanitizarTexto(fontes.negrito, subtitulo.toUpperCase());
        const subLargura = fontes.negrito.widthOfTextAtSize(subSeguro, subTam);
        pagina.drawText(subSeguro, { x: (PAGE_W - subLargura) / 2, y, size: subTam, font: fontes.negrito, color: fontes.corAccent });
        if (linhasContato.length) {
            y -= 40;
            linhasContato.forEach((txt) => {
                const txtSeguro = sanitizarTexto(fontes.regular, txt);
                const w = fontes.regular.widthOfTextAtSize(txtSeguro, 10);
                pagina.drawText(txtSeguro, { x: (PAGE_W - w) / 2, y, size: 10, font: fontes.regular, color: fontes.corTextoCapaMuted });
                y -= 16;
            });
        }
        return pagina;
    }

    function desenharContracapa(pdfDoc, fontes, model) {
        const pagina = pdfDoc.addPage([PAGE_W, PAGE_H]);
        pagina.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: fontes.corCapaFundo });
        const linhas = [model.nome, 'Relatório completo gerado com lattesZen', 'https://github.com/alexsandroccarv/latteszen'];
        let y = PAGE_H / 2 + 20;
        linhas.forEach((l, i) => {
            const tamanho = i === 0 ? 16 : 10;
            const fonte = i === 0 ? fontes.nomeFonte : fontes.regular;
            const seguro = sanitizarTexto(fonte, l);
            const w = fonte.widthOfTextAtSize(seguro, tamanho);
            pagina.drawText(seguro, { x: (PAGE_W - w) / 2, y, size: tamanho, font: fonte, color: i === 0 ? fontes.corTextoCapa : fontes.corTextoCapaMuted });
            y -= tamanho + 12;
        });
    }

    // Reserva N páginas em branco (contadas de antemão a partir do nº de
    // entradas) logo após a capa — o texto do sumário só é desenhado no
    // FINAL (ver montarSumario), quando já se sabe o índice real de cada
    // página (o resto do documento inteiro já foi montado a essa altura).
    function calcularPaginasSumario(entradas) {
        const alturaTitulo = 40;
        const alturaTotal = alturaTitulo + entradas.length * ALTURA_ENTRADA_SUMARIO;
        return Math.max(1, Math.ceil(alturaTotal / CONTENT_H));
    }
    // modelo === 'A': pontilhado guiando o olho até o número da página
    // (linha do meio) — hoje o número só "flutuava" à direita, sem ligação
    // visual com o título. modelo === 'B': entradas de categoria (nivel 1)
    // ganham um ponto colorido na cor da própria categoria, funcionando como
    // legenda da faixa lateral colorida que aparece nas páginas de conteúdo.
    function desenharSumario(paginasReservadas, fontes, entradas, modelo) {
        let paginaIdx = 0, pagina = paginasReservadas[0], y = PAGE_H - MARGIN;
        const tituloFonte = fontes.tituloFonte;
        pagina.drawText(sanitizarTexto(tituloFonte, 'Sumário'), { x: MARGIN, y, size: 20, font: tituloFonte, color: fontes.corTexto });
        y -= 40;
        entradas.forEach((e) => {
            if (y < MARGIN + ALTURA_ENTRADA_SUMARIO) {
                paginaIdx += 1;
                pagina = paginasReservadas[Math.min(paginaIdx, paginasReservadas.length - 1)];
                y = PAGE_H - MARGIN;
            }
            const tamanho = e.nivel === 0 ? 12 : 10;
            const fonte = e.nivel === 0 ? fontes.negrito : fontes.regular;
            const indent = e.nivel === 0 ? 0 : 18;
            const numero = e.paginaIndex != null ? String(e.paginaIndex) : '';
            const tituloSeguro = sanitizarTexto(fonte, e.titulo);
            if (modelo === 'B' && e.nivel === 1) {
                const cor = fontes.rgb(...corDaCategoria(e.num));
                pagina.drawCircle({ x: MARGIN + indent + 4, y: y + 3, size: 3.5, color: cor });
                pagina.drawText(tituloSeguro, { x: MARGIN + indent + 14, y, size: tamanho, font: fonte, color: fontes.corTexto });
                const nw = fonte.widthOfTextAtSize(numero, tamanho);
                pagina.drawText(numero, { x: PAGE_W - MARGIN - nw, y, size: tamanho, font: fonte, color: fontes.corMuted });
            } else {
                const cor = e.nivel === 0 ? fontes.corTexto : fontes.corMuted;
                pagina.drawText(tituloSeguro, { x: MARGIN + indent, y, size: tamanho, font: fonte, color: cor });
                if (modelo === 'A' && numero) {
                    const tituloLargura = fonte.widthOfTextAtSize(tituloSeguro, tamanho);
                    const numLargura = fonte.widthOfTextAtSize(numero, tamanho);
                    const inicioX = MARGIN + indent + tituloLargura + 4;
                    const fimX = PAGE_W - MARGIN - numLargura - 4;
                    if (fimX > inicioX) {
                        const passo = fonte.widthOfTextAtSize('.', tamanho) * 2.2;
                        for (let px = inicioX; px < fimX; px += passo) {
                            pagina.drawText('.', { x: px, y, size: tamanho, font: fonte, color: fontes.corMuted });
                        }
                    }
                }
                const nw = fonte.widthOfTextAtSize(numero, tamanho);
                pagina.drawText(numero, { x: PAGE_W - MARGIN - nw, y, size: tamanho, font: fonte, color: cor });
            }
            y -= ALTURA_ENTRADA_SUMARIO;
        });
    }

    // Número visível de uma página de CONTEÚDO (índice 0-based), ou null se
    // ela não deve ganhar número — capa/sumário (índice < paginasSemNumero)
    // e divisórias internas (indicesDivisoria: Memorial/Anexos/categoria,
    // preenchido por desenharDivisoria() — só título de seção, não conteúdo
    // numerado, mesmo critério já aplicado à capa/sumário; pedido do
    // Alexsandro: "as capas internas não devem ter número de página"). A
    // contagem visível continua sequencial (sem pular número) — cada
    // divisória antes do índice desconta 1 do valor bruto (índice -
    // paginasSemNumero + 1). Pura (sem pdf-lib) — usada por
    // numerarPaginas()/criarEscritor() e exposta só para teste.
    function numeroVisivelDaPagina(indice, paginasSemNumero, indicesDivisoria) {
        if (indice < paginasSemNumero) return null;
        if (indicesDivisoria && indicesDivisoria.has(indice)) return null;
        let divisoriasAntes = 0;
        if (indicesDivisoria) {
            indicesDivisoria.forEach((idx) => { if (idx >= paginasSemNumero && idx < indice) divisoriasAntes += 1; });
        }
        return (indice - paginasSemNumero + 1) - divisoriasAntes;
    }

    // Numera as páginas de CONTEÚDO — nem a capa nem o sumário entram na
    // contagem (pedido do Alexsandro): "1" cai na 1ª página depois do
    // sumário (Memorial/Currículo/Anexos, o que vier primeiro), não mais na
    // 1ª página do próprio sumário. paginasSemNumero (capa + nº de páginas
    // do sumário, já resolvido antes de chamar isto — ver gerar()) marca
    // onde a contagem visível começa. modelo === 'B': número sobe pro canto
    // superior direito (pedido do Alexsandro), em vez do rodapé central de
    // sempre. indicesDivisoria: ver numeroVisivelDaPagina() acima.
    function numerarPaginas(pdfDoc, fontes, modelo, paginasSemNumero, indicesDivisoria) {
        const paginas = pdfDoc.getPages();
        for (let i = paginasSemNumero; i < paginas.length - 1; i++) {
            const num = numeroVisivelDaPagina(i, paginasSemNumero, indicesDivisoria);
            if (num == null) continue;
            const numero = String(num);
            const w = fontes.regular.widthOfTextAtSize(numero, 9);
            if (modelo === 'B') {
                paginas[i].drawText(numero, { x: PAGE_W - MARGIN - w, y: PAGE_H - MARGIN + 16, size: 9, font: fontes.regular, color: fontes.corMuted });
            } else {
                paginas[i].drawText(numero, { x: (PAGE_W - w) / 2, y: MARGIN / 2, size: 9, font: fontes.regular, color: fontes.corMuted });
            }
        }
    }

    // Ponto de entrada.
    // opts.incluirTodos: catálogo inteiro (ignora "Publicar na Web") ou só
    // os itens marcados para Publicar na Web (mesmo recorte da página
    // pública).
    // opts.incluirCurriculo / opts.incluirEvidencias (default: true nos
    // dois) — os 4 modos do cartão "O que incluir no relatório":
    //   completo            → os dois true (padrão, comportamento de sempre)
    //   apenas currículo     → incluirEvidencias: false
    //   apenas evidências     → incluirCurriculo: false
    //   personalizado         → os dois true, mas com opts.categorias restrito
    // opts.categorias: array de categoryKey (ex.: ['DADOS_GERAIS', 'FORMACAO']) —
    // repassado a buildPublicModel(); null/ausente = todas as categorias
    // (mesmo comportamento de sempre).
    // opts.ordemAsc: true ordena os itens DENTRO de cada categoria/tipo por
    // ano crescente (mais antigos primeiro); false/ausente = decrescente
    // (mais recentes primeiro, comportamento de sempre).
    // opts.modelo: 'A' (Editorial sóbrio, padrão) ou 'B' (Índice lateral
    // colorido) — os 2 modelos de diagramação do relatório. 'A' troca os
    // títulos pra uma fonte serifada (Times, já embutida no pdf-lib — sem
    // baixar fonte nenhuma), acrescenta um cabeçalho corrido (nome + seção
    // atual) em toda página de conteúdo e um pontilhado guia no sumário até
    // o número da página. 'B' dá a cada categoria uma cor fixa (determinada
    // pela posição dela em LattesTypes.categories — ver corDaCategoria);
    // toda página de conteúdo ganha uma faixa lateral colorida com o número
    // da categoria (funciona como um índice de dedo ao folhear o PDF
    // impresso), o sumário ganha um ponto colorido por categoria, e cada
    // item ganha um selo com o contador + um "chip" de data — o chip usa
    // uma versão CLARA da cor da categoria (mistura com branco), não a cor
    // cheia, que fica reservada pro selo/índice lateral.
    // Devolve o PDF pronto (Uint8Array).
    async function gerar(opts) {
        const incluirTodos = !!(opts && opts.incluirTodos);
        const incluirCurriculo = !(opts && opts.incluirCurriculo === false);
        const incluirEvidencias = !(opts && opts.incluirEvidencias === false);
        const categorias = (opts && opts.categorias) || null;
        const ordemAsc = !!(opts && opts.ordemAsc);
        const modelo = (opts && opts.modelo === 'B') ? 'B' : 'A';
        // Página de divisão dedicada por categoria de evidência, nos Anexos
        // (opcional — pedido do Alexsandro: deixar a pessoa escolher, em vez
        // de decidir por ela). Sem isto (padrão), os Anexos vão direto pro
        // primeiro item de cada categoria, sem página extra nenhuma — só o
        // sumário aponta certo pra onde cada categoria começa.
        const paginasDivisao = !!(opts && opts.paginasDivisao);
        const PDFLib = await carregarPdfLib();
        const { PDFDocument, StandardFonts, rgb, degrees, PDFName, PDFString } = PDFLib;

        const pdfDoc = await PDFDocument.create();
        const model = await window.TabPublicar.buildPublicModel({ incluirTodos, categorias, ordemAsc });
        // Contador/cor de cada item, atribuídos ANTES de qualquer
        // renderização — única fonte de verdade reaproveitada tanto pelo
        // Currículo completo quanto pelo cabeçalho da página de evidência
        // correspondente (ver atribuirNumeracaoItens acima), mesmo no modo
        // "apenas evidências" (onde o Currículo nem chega a ser desenhado).
        atribuirNumeracaoItens(model);
        pdfDoc.setTitle(`Relatório completo — ${model.nome}`);
        pdfDoc.setAuthor(model.nome);
        pdfDoc.setProducer('lattesZen');
        pdfDoc.setCreator('lattesZen (https://github.com/alexsandroccarv/latteszen)');

        const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const negrito = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        // TimesRomanBold é uma das 14 fontes padrão do PDF — vem embutida no
        // próprio pdf-lib, sem precisar baixar nada de fonte alguma (mesmo
        // raciocínio de usar só StandardFonts que já regia o resto do
        // arquivo) — usada só nos títulos do Modelo A, pro efeito "editorial".
        const serifNegrito = modelo === 'A' ? await pdfDoc.embedFont(StandardFonts.TimesRomanBold) : negrito;
        const fontes = {
            regular, negrito, serifNegrito, rgb, degrees,
            nomeFonte: modelo === 'A' ? serifNegrito : negrito,
            tituloFonte: modelo === 'A' ? serifNegrito : negrito,
            corTexto: corTexto(rgb), corMuted: corMuted(rgb), corAccent: corPrincipal(rgb),
            corRule: rgb(0.85, 0.83, 0.78),
            corTextoCapa: corTexto(rgb), corTextoCapaMuted: corMuted(rgb), corCapaFundo: rgb(0.984, 0.980, 0.968),
        };

        // Memorial é conteúdo do CURRÍCULO — some junto com ele no modo
        // "apenas evidências" (senão o texto do Memorial vazaria num
        // relatório que deveria conter só os anexos).
        const memorialItem = (window.AppCore.state.catalogo.items || []).find((i) => i.typeKey === 'MEMORIAL');
        const memorialTexto = incluirCurriculo ? String((memorialItem && memorialItem.fields && memorialItem.fields.descricao) || '').trim() : '';
        const todosAnexos = anexosDoModelo(model);
        const temAnexos = incluirEvidencias && todosAnexos.length > 0;
        // Anexos organizados por categoria — cada categoria com evidência de
        // ARQUIVO vira um grupo (as evidências em link ficam à parte, em
        // linksNota, já que não geram página própria — ver anexarEvidencias).
        // Calculado aqui, ANTES do sumário, pra já saber os títulos "Anexo
        // <romano> — <categoria>" e reservar a entrada certa (o número da
        // página de cada uma só é preenchido depois, quando o conteúdo é
        // desenhado de verdade — mesmo padrão de entradasPorSecao abaixo).
        const gruposAnexo = incluirEvidencias
            ? model.secoes.map((sec) => ({ sec, itens: anexosDaSecaoSemLink(sec), entrada: null })).filter((g) => g.itens.length)
            : [];
        const linksNota = incluirEvidencias ? todosAnexos.filter(({ anexo }) => anexo.ext === 'url').map(({ item, anexo }) => ({ item, anexo })) : [];
        let entradaLinks = null;

        let fotoImg = null;
        if (model.foto) {
            try {
                const ehPng = /^data:image\/png/i.test(model.foto);
                const bytes = dataUriParaBytes(model.foto);
                fotoImg = ehPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
            } catch (_) { fotoImg = null; }
        }

        // 1) Capa
        const subtituloCapa = incluirCurriculo ? 'Curriculum Vitae' : 'Evidências';
        desenharCapa(pdfDoc, fontes, modelo, model, subtituloCapa, fotoImg);

        // 2) Sumário — reserva as páginas agora (o texto entra por último,
        //    quando os índices de página de cada seção já são conhecidos).
        const entradasSumario = [];
        let entradaMemorial = null;
        if (memorialTexto) { entradaMemorial = { titulo: 'Memorial', nivel: 0, paginaIndex: null }; entradasSumario.push(entradaMemorial); }
        // "Currículo completo" virou "Curriculum Vitae" SÓ no sumário (pedido
        // do Alexsandro) — sem número de página (o Currículo ocupa páginas
        // demais pra um número só fazer sentido; as categorias logo abaixo,
        // uma por uma, já apontam pro lugar certo de cada uma).
        if (incluirCurriculo) entradasSumario.push({ titulo: 'Curriculum Vitae', nivel: 0, paginaIndex: null });
        const entradasPorSecao = new Map();
        if (incluirCurriculo) {
            model.secoes.forEach((sec) => {
                const entrada = { titulo: sec.num ? `${sec.num}. ${sec.label}` : sec.label, nivel: 1, paginaIndex: null, num: sec.num };
                entradasSumario.push(entrada);
                entradasPorSecao.set(sec.id, entrada);
            });
        }
        // "Anexos — Evidências" virou "Anexos" (sem número de página, mesmo
        // motivo do Currículo) com uma entrada "Anexo <romano> — <categoria>"
        // por categoria abaixo — cada uma com o número certo da página onde
        // aquela categoria começa (preenchido lá na frente, junto do
        // conteúdo — ver anexarEvidencias()).
        if (temAnexos) {
            entradasSumario.push({ titulo: 'Anexos', nivel: 0, paginaIndex: null });
            let romanoIdx = 0;
            gruposAnexo.forEach((g) => {
                romanoIdx += 1;
                // Formato pedido pelo Alexsandro: "Anexo I - 03 Atuação" (o
                // número da categoria, já zero-padded em LATTES_CATEGORIES,
                // antes do nome — sem ele nas seções sem categoria própria,
                // como "Outras atividades").
                g.entrada = { titulo: `Anexo ${numeroRomano(romanoIdx)} - ${g.sec.num ? g.sec.num + ' ' : ''}${g.sec.label}`, nivel: 1, paginaIndex: null, num: g.sec.num };
                entradasSumario.push(g.entrada);
            });
            if (linksNota.length) {
                romanoIdx += 1;
                entradaLinks = { titulo: `Anexo ${numeroRomano(romanoIdx)} — Evidências em link`, nivel: 1, paginaIndex: null, num: null };
                entradasSumario.push(entradaLinks);
            }
        }

        const numPaginasSumario = calcularPaginasSumario(entradasSumario);
        const paginasSumario = [];
        for (let i = 0; i < numPaginasSumario; i++) paginasSumario.push(pdfDoc.addPage([PAGE_W, PAGE_H]));

        // Capa + sumário não entram na numeração visível (pedido do
        // Alexsandro) — pdfDoc já tem exatamente essas páginas nesse ponto
        // (nenhum conteúdo foi desenhado ainda), então isto é literalmente
        // "quantas páginas vêm antes da 1ª página numerada como '1'".
        const paginasSemNumero = pdfDoc.getPageCount();
        // Índices (0-based) das divisórias internas (Memorial/Anexos/
        // categoria) — preenchido por desenharDivisoria() conforme cada uma
        // é criada, e usado tanto por numeroPagina (acima) quanto por
        // numerarPaginas() no fim, pra nenhuma delas ganhar número de
        // página (pedido do Alexsandro: "as capas internas não devem ter
        // número de página").
        const indicesDivisoria = new Set();
        const escritor = criarEscritor(pdfDoc, fontes, paginasSemNumero, indicesDivisoria);
        // contextoA/contextoB alimentam o decorador (cabeçalho corrido do
        // Modelo A / faixa lateral do Modelo B), atualizados ANTES de cada
        // novaPagina()/seção — ver criarEscritor() e desenharCabecalhoA/
        // desenharSidebarB acima.
        const contextoA = { nome: model.nome, secao: '' };
        const contextoB = { cor: CINZA_NEUTRO, num: null, label: '' };
        if (modelo === 'A') escritor.decorador = (pagina) => desenharCabecalhoA(pagina, fontes, contextoA);
        else escritor.decorador = (pagina) => desenharSidebarB(pagina, fontes, contextoB);
        if (modelo === 'B') { escritor.margemExtra = SIDEBAR_W + 18; escritor.deslocamentoX = -UM_CM; }

        // 3) Memorial (só existe se houver texto e incluirCurriculo)
        if (memorialTexto) {
            desenharDivisoria(pdfDoc, fontes, 'Memorial', indicesDivisoria, modelo, null);
            contextoA.secao = 'Memorial';
            Object.assign(contextoB, { cor: CINZA_NEUTRO, num: null, label: 'Memorial' });
            escritor.novaPagina();
            entradaMemorial.paginaIndex = escritor.numeroPagina;
            escritor.paragrafo(memorialTexto, { tamanho: 11, leading: 1.6 });
        }

        // 4) Currículo completo (pulado inteiro no modo "apenas evidências")
        // Sem página divisória própria (pedido do Alexsandro) — vai direto
        // pro conteúdo, só numa página nova (limpa) depois do Memorial. Sem
        // número de página no sumário (ver entradasSumario acima), então não
        // há entrada pra atualizar aqui — só a página em si precisa existir.
        if (incluirCurriculo) {
            contextoA.secao = 'Currículo completo';
            Object.assign(contextoB, { cor: CINZA_NEUTRO, num: null, label: 'Currículo' });
            escritor.novaPagina();
            if (!model.secoes.length) {
                escritor.paragrafo('Nenhum item cadastrado ainda.', { cor: fontes.corMuted });
            }
            model.secoes.forEach((sec) => {
                // Atualiza o contexto ANTES de desenhar qualquer coisa desta
                // seção — se o título da seção estourar pra uma página nova
                // (garantirEspaco dispara o decorador), ele já reflete a
                // seção certa, não a anterior.
                contextoA.secao = sec.num ? `${sec.num} · ${sec.label}` : sec.label;
                Object.assign(contextoB, { cor: corDaCategoria(sec.num), num: sec.num, label: sec.label });
                escritor.espaco(6);
                const tituloSec = sec.num ? `${sec.num}  ${sec.label}` : sec.label;
                if (modelo === 'B') desenharFaixaCategoria(escritor, fontes, tituloSec, contextoB.cor);
                else escritor.linha(sec.num ? `${sec.num}. ${sec.label}` : sec.label, { negrito: true, tamanho: 13 });
                entradasPorSecao.get(sec.id).paginaIndex = escritor.numeroPagina;
                sec.tipos.forEach((tipo) => {
                    escritor.espaco(4);
                    escritor.linha(tipo.label, { negrito: true, tamanho: 11, indent: 12 });
                    // Atuação: "tipo" é uma instituição, com os itens dela
                    // agrupados por subtipo em tipo.subgrupos (ver
                    // buildPublicModel em tab-publicar.js) — um nível a mais
                    // que os demais tipos, que continuam com tipo.itens direto.
                    if (tipo.subgrupos) {
                        tipo.subgrupos.forEach((sub) => {
                            escritor.espaco(2);
                            if (modelo === 'B') desenharDestaqueSubtipo(escritor, fontes, sub.label, contextoB.cor, 20);
                            else escritor.linha(sub.label, { negrito: true, tamanho: 10, indent: 20, cor: fontes.corMuted });
                            escreverItens(escritor, fontes, sub.itens, 28, modelo);
                        });
                    } else {
                        escreverItens(escritor, fontes, tipo.itens, 24, modelo);
                    }
                });
            });
            if (model.secoes.length) desenharCreditos(pdfDoc, PDFName, PDFString, escritor, fontes);
        }

        // 5) Anexos (evidências marcadas como "pública" — mescladas de
        // verdade), organizadas por categoria — sem página de divisão nem
        // página em branco antes do 1º item (pedido do Alexsandro: eram 2
        // páginas "perdidas" antes de qualquer evidência de verdade
        // aparecer). Com opts.paginasDivisao, cada categoria ganha sua
        // própria página de divisão (ver anexarEvidencias); sem, vai direto
        // pro primeiro item de cada categoria.
        if (temAnexos) {
            contextoA.secao = 'Anexos — Evidências';
            Object.assign(contextoB, { cor: CINZA_CLARO_ANEXOS, num: null, label: 'Anexos', corTexto: TEXTO_ESCURO_ANEXOS });
            await anexarEvidencias(pdfDoc, PDFLib, escritor, fontes, modelo, gruposAnexo, linksNota, entradaLinks, paginasDivisao, indicesDivisoria, contextoB);
        }

        // 6) Contracapa
        desenharContracapa(pdfDoc, fontes, model);

        // 7) Sumário (agora com os índices de página resolvidos) e paginação.
        desenharSumario(paginasSumario, fontes, entradasSumario, modelo);
        numerarPaginas(pdfDoc, fontes, modelo, paginasSemNumero, indicesDivisoria);

        return pdfDoc.save();
    }

    // quebrarLinhas/anexosDoModelo/calcularPaginasSumario/sanitizarTexto/
    // tituloParaLinha/corDaCategoria/misturarComBranco/sufixoCargaHoraria/
    // numeroRomano/anexosDaSecaoSemLink expostos só para teste
    // (tools/tests/specs/pdf-report.mjs) — nenhum deles depende do pdf-lib
    // estar carregado, então dá pra verificar a lógica pura mesmo com o CDN
    // bloqueado (mesmo bloqueio de rede que a suíte já aplica a
    // Tailwind/Font Awesome — ver harness.mjs).
    return {
        gerar, quebrarLinhas, anexosDoModelo, calcularPaginasSumario, sanitizarTexto, tituloParaLinha, linhaDoItem,
        corDaCategoria, misturarComBranco, sufixoCargaHoraria, numeroRomano, anexosDaSecaoSemLink, numeroVisivelDaPagina,
        layoutNuvemFlow,
    };
})();
