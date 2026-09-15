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

    function corPrincipal(rgb) { return rgb(0.075, 0.318, 0.706); } // #1351b4 (govbr-600)
    function corTexto(rgb) { return rgb(0.11, 0.11, 0.11); }
    function corMuted(rgb) { return rgb(0.42, 0.42, 0.42); }

    // Modelo B ("Índice lateral colorido"): cada categoria (01-21) recebe uma
    // cor fixa, ciclando por esta paleta na ORDEM em que as categorias
    // aparecem em LattesTypes.categories — determinístico (a mesma categoria
    // sempre cai na mesma cor entre execuções). Sem número de categoria
    // (seção mesclada "Além do Currículo Lattes", Memorial, Anexos), cai num
    // cinza neutro em vez de tentar "inventar" uma cor.
    const PALETA_CATEGORIAS = [
        [0.357, 0.247, 0.851], [0.318, 0.216, 0.706], [0.075, 0.318, 0.706], [0.055, 0.486, 0.400],
        [0.184, 0.490, 0.196], [0.722, 0.349, 0.039], [0.757, 0.267, 0.227], [0.541, 0.247, 0.627],
        [0.231, 0.431, 0.561], [0.549, 0.416, 0.184], [0.698, 0.227, 0.420], [0.102, 0.541, 0.620],
    ];
    const CINZA_NEUTRO = [0.42, 0.42, 0.42];
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
    function criarEscritor(pdfDoc, fontes) {
        let pagina = null, y = 0, margemExtra = 0;
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
            if (textoSeguro) pagina.drawText(textoSeguro, { x: MARGIN + margemExtra + (opts.indent || 0), y, size: tamanho, font: fonte, color: opts.cor || fontes.corTexto });
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
            set decorador(fn) { decorador = fn; },
            // Mesmo número que numerarPaginas() vai desenhar no rodapé desta
            // página (capa não numerada; 1ª página depois dela vira "1") —
            // usado pelo cabeçalho de cada página de evidência, pra dar
            // contexto de posição sem esperar numerarPaginas() rodar (só no
            // fim, depois que o documento inteiro já foi montado).
            get numeroPagina() { return pdfDoc.getPageCount() - 1; },
        };
    }

    // Página-título de seção ("capa intermediária") — página cheia, só o
    // nome da seção centralizado; a próxima página já começa "limpa" pro
    // conteúdo real daquela seção.
    function desenharDivisoria(pdfDoc, fontes, titulo) {
        const pagina = pdfDoc.addPage([PAGE_W, PAGE_H]);
        pagina.drawRectangle({ x: 0, y: PAGE_H / 2 - 60, width: PAGE_W, height: 3, color: fontes.corAccent });
        const tamanho = 28;
        const fonte = fontes.tituloFonte;
        const textoSeguro = sanitizarTexto(fonte, titulo);
        const largura = fonte.widthOfTextAtSize(textoSeguro, tamanho);
        pagina.drawText(textoSeguro, { x: (PAGE_W - largura) / 2, y: PAGE_H / 2 - 20, size: tamanho, font: fonte, color: fontes.corTexto });
        return pagina;
    }

    // Faixa lateral colorida do Modelo B, redesenhada em toda página de
    // conteúdo (ver decorador em criarEscritor) — funciona como um índice de
    // dedo (thumb index): a cor + número da categoria dão pra achar a seção
    // certa folheando o PDF impresso, sem abrir o sumário. contexto = { cor,
    // num, label }, atualizado pelo chamador antes de cada seção/divisória.
    function desenharSidebarB(pagina, fontes, contexto) {
        const cor = fontes.rgb(contexto.cor[0], contexto.cor[1], contexto.cor[2]);
        pagina.drawRectangle({ x: 0, y: 0, width: SIDEBAR_W, height: PAGE_H, color: cor });
        if (contexto.num) {
            const numTam = 20;
            const numSeguro = sanitizarTexto(fontes.negrito, contexto.num);
            const numW = fontes.negrito.widthOfTextAtSize(numSeguro, numTam);
            pagina.drawText(numSeguro, { x: (SIDEBAR_W - numW) / 2, y: PAGE_H - 90, size: numTam, font: fontes.negrito, color: fontes.rgb(1, 1, 1) });
        }
        const lbl = sanitizarTexto(fontes.negrito, (contexto.label || '').toUpperCase());
        if (lbl) {
            pagina.drawText(lbl, { x: SIDEBAR_W - 16, y: 90, size: 7.5, font: fontes.negrito, color: fontes.rgb(1, 1, 1), rotate: fontes.degrees(90) });
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
        pagina.drawText(sanitizarTexto(fontes.negrito, num), { x: MARGIN + escritor.margemExtra + indent, y, size: tamanho, font: fontes.negrito, color: fontes.corAccent });
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
        const tituloTxt = tituloParaLinha(item);
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
        const xBase = MARGIN + escritor.margemExtra + indent;
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

    // Contador (001, 002...) no início de cada item — reinicia a cada
    // subtipo/tipo (o `contador` já vem calculado por escreverItens()
    // abaixo, sempre a partir de 1 para cada lista de itens nova). Ordem
    // padrão: "NNN ano título". Formação acadêmica/titulação foge à regra
    // (ver tituloParaLinha) — mantém a data só no final: "NNN título (ano)".
    function linhaDoItem(contador, item) {
        const num = String(contador).padStart(3, '0');
        if (item.typeKey === 'FORMACAO_ACADEMICA') {
            const anoTxt = item.ano ? ` (${item.ano})` : '';
            return `${num} ${tituloParaLinha(item)}${anoTxt}`;
        }
        const anoPrefixo = item.ano ? `${item.ano} ` : '';
        return `${num} ${anoPrefixo}${item.titulo}`;
    }

    // Escreve uma lista de itens (já ordenada) com o contador reiniciando
    // em 1 — usada tanto para tipo.itens "normais" (2 níveis: seção > tipo)
    // quanto para tipo.subgrupos.itens de Atuação (3 níveis: seção >
    // instituição > subtipo), sempre reiniciando no começo de CADA lista.
    // modelo/cor selecionam entre desenharItemA (contador colorido, linha
    // corrida) e desenharItemB (selo + chip de data + título) — ver gerar().
    function escreverItens(escritor, fontes, itens, indent, modelo, cor) {
        itens.forEach((item, i) => {
            if (modelo === 'B') desenharItemB(escritor, fontes, cor, item, i + 1, indent);
            else desenharItemA(escritor, fontes, item, i + 1, indent);
        });
    }

    // Percorre o modelo (mesmas seções/tipos/itens da página pública) e
    // devolve a lista achatada de {item, anexo} — só evidências realmente
    // marcadas "pública" chegam aqui (buildPublicModel/itemAnexos já filtra).
    function anexosDoModelo(model) {
        const lista = [];
        const registrar = (item) => (item.anexos || []).forEach((anexo) => lista.push({ itemTitulo: item.titulo, anexo }));
        model.secoes.forEach((sec) => sec.tipos.forEach((tipo) => {
            // Atuação: "tipo" é uma instituição, com os itens agrupados por
            // subtipo em tipo.subgrupos em vez de tipo.itens direto (ver
            // buildPublicModel em tab-publicar.js).
            if (tipo.subgrupos) tipo.subgrupos.forEach((sub) => sub.itens.forEach(registrar));
            else tipo.itens.forEach(registrar);
        }));
        return lista;
    }

    // Uma página de evidência: cabeçalho com o nome do item (à esquerda,
    // truncado com reticências se não couber) e o número da página do
    // relatório (à direita — mesmo número que numerarPaginas() vai
    // desenhar no rodapé), uma linha fina, e a evidência reduzida de forma
    // SEMPRE proporcional (nunca estica um eixo mais que o outro) pra caber
    // na área reservada abaixo do cabeçalho. `desenhar(pagina, area)` faz o
    // drawImage/drawPage de verdade — este helper só cuida do layout comum
    // entre os dois casos (ver anexarEvidencias).
    function desenharPaginaEvidencia(escritor, fontes, itemTitulo, anexoNome, larguraNatural, alturaNatural, desenhar) {
        escritor.novaPagina();
        const pagina = escritor.pagina;
        const xBase = MARGIN + escritor.margemExtra;
        const tam = 11;
        const numero = String(escritor.numeroPagina);
        const numLargura = fontes.regular.widthOfTextAtSize(numero, 9);
        const tituloLarguraMax = CONTENT_W - escritor.margemExtra - numLargura - 10;
        let tituloSeguro = sanitizarTexto(fontes.negrito, itemTitulo);
        if (fontes.negrito.widthOfTextAtSize(tituloSeguro, tam) > tituloLarguraMax) {
            while (tituloSeguro.length > 1 && fontes.negrito.widthOfTextAtSize(tituloSeguro + '…', tam) > tituloLarguraMax) {
                tituloSeguro = tituloSeguro.slice(0, -1);
            }
            tituloSeguro += '…';
        }
        pagina.drawText(tituloSeguro, { x: xBase, y: escritor.y, size: tam, font: fontes.negrito, color: fontes.corTexto });
        pagina.drawText(numero, { x: PAGE_W - MARGIN - numLargura, y: escritor.y + 1, size: 9, font: fontes.regular, color: fontes.corMuted });
        escritor.y -= tam * 1.4;
        escritor.linha(`Evidência: ${anexoNome}`, { tamanho: 9, cor: fontes.corMuted });
        escritor.espaco(6);
        pagina.drawLine({ start: { x: xBase, y: escritor.y + 3 }, end: { x: PAGE_W - MARGIN, y: escritor.y + 3 }, thickness: 0.5, color: fontes.corRule });
        escritor.espaco(6);

        const areaW = CONTENT_W - escritor.margemExtra, areaH = Math.max(60, escritor.y - MARGIN);
        const escala = Math.min(areaW / larguraNatural, areaH / alturaNatural, 1);
        const w = larguraNatural * escala, h = alturaNatural * escala;
        const x = xBase + (areaW - w) / 2, y = MARGIN + (areaH - h) / 2;
        desenhar(pagina, { x, y, w, h });
    }

    // Anexa de fato os arquivos de evidência: cada página de PDF (uma ou
    // várias) e cada imagem viram sua PRÓPRIA página no relatório, com
    // cabeçalho (nome do item + nº da página) e reduzidas proporcionalmente
    // pra caber no espaço abaixo dele — ver desenharPaginaEvidencia(). Links
    // e tipos não suportados (vídeo/zip) viram uma nota em texto; nada é
    // descartado silenciosamente.
    async function anexarEvidencias(pdfDoc, PDFLib, escritor, fontes, model) {
        const { PDFDocument } = PDFLib;
        const anexos = anexosDoModelo(model);
        const linksNota = [];
        for (const { itemTitulo, anexo } of anexos) {
            if (anexo.ext === 'url') { linksNota.push({ itemTitulo, anexo }); continue; }
            try {
                if (anexo.ext === 'pdf') {
                    const bytes = dataUriParaBytes(anexo.dataUri);
                    const origem = await PDFDocument.load(bytes, { ignoreEncryption: true });
                    const paginasEmbutidas = await pdfDoc.embedPdf(origem, origem.getPageIndices());
                    paginasEmbutidas.forEach((embutida) => {
                        desenharPaginaEvidencia(escritor, fontes, itemTitulo, anexo.name, embutida.width, embutida.height, (pagina, area) => {
                            pagina.drawPage(embutida, { x: area.x, y: area.y, width: area.w, height: area.h });
                        });
                    });
                } else if (window.AppCore.isImageExt(anexo.ext)) {
                    let dataUri = anexo.dataUri;
                    let ehPng = /^(png)$/i.test(anexo.ext);
                    if (/^(gif|webp)$/i.test(anexo.ext)) { dataUri = await converterParaPng(dataUri); ehPng = true; }
                    const bytes = dataUriParaBytes(dataUri);
                    const imagem = ehPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
                    desenharPaginaEvidencia(escritor, fontes, itemTitulo, anexo.name, imagem.width, imagem.height, (pagina, area) => {
                        pagina.drawImage(imagem, { x: area.x, y: area.y, width: area.w, height: area.h });
                    });
                } else {
                    escritor.novaPagina();
                    escritor.linha(itemTitulo, { negrito: true, tamanho: 11 });
                    escritor.linha(`Evidência: ${anexo.name}`, { tamanho: 9, cor: fontes.corMuted });
                    escritor.espaco(8);
                    escritor.paragrafo(`Arquivo do tipo ".${anexo.ext}" não pode ser incluído dentro do PDF — consulte a pasta/Google Drive configurado para abri-lo.`, { cor: fontes.corMuted });
                }
            } catch (e) {
                escritor.novaPagina();
                escritor.linha(itemTitulo, { negrito: true, tamanho: 11 });
                escritor.linha(`Evidência: ${anexo.name}`, { tamanho: 9, cor: fontes.corMuted });
                escritor.espaco(8);
                escritor.paragrafo(`Não foi possível incluir este arquivo automaticamente (${e.message || 'formato inválido'}).`, { cor: fontes.corMuted });
            }
        }
        if (linksNota.length) {
            escritor.novaPagina();
            escritor.linha('Evidências em link (endereço na web, sem arquivo para anexar)', { negrito: true, tamanho: 12 });
            escritor.espaco(6);
            linksNota.forEach(({ itemTitulo, anexo }) => {
                escritor.linha(itemTitulo, { negrito: true, tamanho: 10 });
                escritor.paragrafo(`${anexo.name}: ${anexo.url}`, { tamanho: 9, cor: fontes.corMuted, indent: 10 });
                escritor.espaco(4);
            });
        }
    }

    // Nome/foto/ORCID do Ego (Identificação) — mesmos dados já resolvidos
    // pelo modelo da página pública (buildPublicModel), sem reler o catálogo.
    function desenharCapa(pdfDoc, fontes, model, subtitulo, fotoImg) {
        const pagina = pdfDoc.addPage([PAGE_W, PAGE_H]);
        pagina.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: fontes.corCapaFundo });
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
        if (model.orcid) {
            y -= 44;
            const orcidTxt = `ORCID: ${model.orcid}`;
            const w = fontes.regular.widthOfTextAtSize(orcidTxt, 10);
            pagina.drawText(orcidTxt, { x: (PAGE_W - w) / 2, y, size: 10, font: fontes.regular, color: fontes.corTextoCapaMuted });
        }
        const dataTxt = `Documento gerado em ${new Date().toLocaleDateString('pt-BR')}`;
        const dw = fontes.regular.widthOfTextAtSize(dataTxt, 10);
        pagina.drawText(dataTxt, { x: (PAGE_W - dw) / 2, y: MARGIN, size: 10, font: fontes.regular, color: fontes.corTextoCapaMuted });
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
                if (modelo === 'A') {
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

    // Numera todas as páginas, EXCETO a capa (1ª) e a contracapa (última) —
    // "1" cai na 1ª página do sumário, como de costume em relatórios impressos.
    function numerarPaginas(pdfDoc, fontes) {
        const paginas = pdfDoc.getPages();
        for (let i = 1; i < paginas.length - 1; i++) {
            const numero = String(i);
            const w = fontes.regular.widthOfTextAtSize(numero, 9);
            paginas[i].drawText(numero, { x: (PAGE_W - w) / 2, y: MARGIN / 2, size: 9, font: fontes.regular, color: fontes.corMuted });
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
        const PDFLib = await carregarPdfLib();
        const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;

        const pdfDoc = await PDFDocument.create();
        const model = await window.TabPublicar.buildPublicModel({ incluirTodos, categorias, ordemAsc });
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

        let fotoImg = null;
        if (model.foto) {
            try {
                const ehPng = /^data:image\/png/i.test(model.foto);
                const bytes = dataUriParaBytes(model.foto);
                fotoImg = ehPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
            } catch (_) { fotoImg = null; }
        }

        // 1) Capa
        const subtituloCapa = !incluirCurriculo ? 'Evidências'
            : memorialTexto ? 'Memorial e Currículo' : 'Currículo Completo';
        desenharCapa(pdfDoc, fontes, model, subtituloCapa, fotoImg);

        // 2) Sumário — reserva as páginas agora (o texto entra por último,
        //    quando os índices de página de cada seção já são conhecidos).
        const entradasSumario = [];
        if (memorialTexto) entradasSumario.push({ titulo: 'Memorial', nivel: 0, paginaIndex: null });
        if (incluirCurriculo) entradasSumario.push({ titulo: 'Currículo completo', nivel: 0, paginaIndex: null });
        const entradasPorSecao = new Map();
        if (incluirCurriculo) {
            model.secoes.forEach((sec) => {
                const entrada = { titulo: sec.num ? `${sec.num}. ${sec.label}` : sec.label, nivel: 1, paginaIndex: null, num: sec.num };
                entradasSumario.push(entrada);
                entradasPorSecao.set(sec.id, entrada);
            });
        }
        if (temAnexos) entradasSumario.push({ titulo: 'Anexos — Evidências', nivel: 0, paginaIndex: null });

        const numPaginasSumario = calcularPaginasSumario(entradasSumario);
        const paginasSumario = [];
        for (let i = 0; i < numPaginasSumario; i++) paginasSumario.push(pdfDoc.addPage([PAGE_W, PAGE_H]));

        const escritor = criarEscritor(pdfDoc, fontes);
        // contextoA/contextoB alimentam o decorador (cabeçalho corrido do
        // Modelo A / faixa lateral do Modelo B), atualizados ANTES de cada
        // novaPagina()/seção — ver criarEscritor() e desenharCabecalhoA/
        // desenharSidebarB acima.
        const contextoA = { nome: model.nome, secao: '' };
        const contextoB = { cor: CINZA_NEUTRO, num: null, label: '' };
        if (modelo === 'A') escritor.decorador = (pagina) => desenharCabecalhoA(pagina, fontes, contextoA);
        else escritor.decorador = (pagina) => desenharSidebarB(pagina, fontes, contextoB);
        if (modelo === 'B') escritor.margemExtra = SIDEBAR_W + 18;

        // 3) Memorial (só existe se houver texto e incluirCurriculo)
        if (memorialTexto) {
            desenharDivisoria(pdfDoc, fontes, 'Memorial');
            contextoA.secao = 'Memorial';
            Object.assign(contextoB, { cor: CINZA_NEUTRO, num: null, label: 'Memorial' });
            escritor.novaPagina();
            entradasSumario[0].paginaIndex = pdfDoc.getPageCount() - 1;
            escritor.paragrafo(memorialTexto, { tamanho: 11, leading: 1.6 });
        }

        // 4) Currículo completo (pulado inteiro no modo "apenas evidências")
        if (incluirCurriculo) {
            desenharDivisoria(pdfDoc, fontes, 'Currículo Completo');
            contextoA.secao = 'Currículo completo';
            Object.assign(contextoB, { cor: CINZA_NEUTRO, num: null, label: 'Currículo' });
            escritor.novaPagina();
            entradasSumario.find((e) => e.titulo === 'Currículo completo').paginaIndex = pdfDoc.getPageCount() - 1;
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
                const idx = escritor.linha(sec.num ? `${sec.num}. ${sec.label}` : sec.label, { negrito: true, tamanho: 13 });
                entradasPorSecao.get(sec.id).paginaIndex = idx;
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
                            escritor.linha(sub.label, { negrito: true, tamanho: 10, indent: 20, cor: fontes.corMuted });
                            escreverItens(escritor, fontes, sub.itens, 28, modelo, contextoB.cor);
                        });
                    } else {
                        escreverItens(escritor, fontes, tipo.itens, 24, modelo, contextoB.cor);
                    }
                });
            });
        }

        // 5) Anexos (evidências marcadas como "pública" — mescladas de verdade)
        if (temAnexos) {
            desenharDivisoria(pdfDoc, fontes, 'Anexos — Evidências');
            contextoA.secao = 'Anexos — Evidências';
            Object.assign(contextoB, { cor: CINZA_NEUTRO, num: null, label: 'Anexos' });
            escritor.novaPagina();
            entradasSumario.find((e) => e.titulo === 'Anexos — Evidências').paginaIndex = pdfDoc.getPageCount() - 1;
            await anexarEvidencias(pdfDoc, PDFLib, escritor, fontes, model);
        }

        // 6) Contracapa
        desenharContracapa(pdfDoc, fontes, model);

        // 7) Sumário (agora com os índices de página resolvidos) e paginação.
        desenharSumario(paginasSumario, fontes, entradasSumario, modelo);
        numerarPaginas(pdfDoc, fontes);

        return pdfDoc.save();
    }

    // quebrarLinhas/anexosDoModelo/calcularPaginasSumario/sanitizarTexto/
    // tituloParaLinha/corDaCategoria/misturarComBranco expostos só para
    // teste (tools/tests/specs/pdf-report.mjs) — nenhum deles depende do
    // pdf-lib estar carregado, então dá pra verificar a lógica pura mesmo
    // com o CDN bloqueado (mesmo bloqueio de rede que a suíte já aplica a
    // Tailwind/Font Awesome — ver harness.mjs).
    return {
        gerar, quebrarLinhas, anexosDoModelo, calcularPaginasSumario, sanitizarTexto, tituloParaLinha, linhaDoItem,
        corDaCategoria, misturarComBranco,
    };
})();
