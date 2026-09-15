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

    function corPrincipal(rgb) { return rgb(0.075, 0.318, 0.706); } // #1351b4 (govbr-600)
    function corTexto(rgb) { return rgb(0.11, 0.11, 0.11); }
    function corMuted(rgb) { return rgb(0.42, 0.42, 0.42); }

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
        let pagina = null, y = 0;
        function novaPagina() {
            pagina = pdfDoc.addPage([PAGE_W, PAGE_H]);
            y = PAGE_H - MARGIN;
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
            if (textoSeguro) pagina.drawText(textoSeguro, { x: MARGIN + (opts.indent || 0), y, size: tamanho, font: fonte, color: opts.cor || fontes.corTexto });
            y -= leading;
            return pdfDoc.getPageCount() - 1;
        }
        function paragrafo(texto, opts) {
            opts = opts || {};
            const fonte = opts.negrito ? fontes.negrito : fontes.regular;
            const tamanho = opts.tamanho || 10;
            const largura = CONTENT_W - (opts.indent || 0);
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
        };
    }

    // Página-título de seção ("capa intermediária") — página cheia, só o
    // nome da seção centralizado; a próxima página já começa "limpa" pro
    // conteúdo real daquela seção.
    function desenharDivisoria(pdfDoc, fontes, titulo) {
        const pagina = pdfDoc.addPage([PAGE_W, PAGE_H]);
        pagina.drawRectangle({ x: 0, y: PAGE_H / 2 - 60, width: PAGE_W, height: 3, color: fontes.corAccent });
        const tamanho = 28;
        const textoSeguro = sanitizarTexto(fontes.negrito, titulo);
        const largura = fontes.negrito.widthOfTextAtSize(textoSeguro, tamanho);
        pagina.drawText(textoSeguro, { x: (PAGE_W - largura) / 2, y: PAGE_H / 2 - 20, size: tamanho, font: fontes.negrito, color: fontes.corTexto });
        return pagina;
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

    // Percorre o modelo (mesmas seções/tipos/itens da página pública) e
    // devolve a lista achatada de {item, anexo} — só evidências realmente
    // marcadas "pública" chegam aqui (buildPublicModel/itemAnexos já filtra).
    function anexosDoModelo(model) {
        const lista = [];
        model.secoes.forEach((sec) => sec.tipos.forEach((tipo) => tipo.itens.forEach((item) => {
            (item.anexos || []).forEach((anexo) => lista.push({ itemTitulo: item.titulo, anexo }));
        })));
        return lista;
    }

    // Anexa de fato os arquivos de evidência: PDF mescla página a página no
    // documento final; imagem vira uma página própria (redimensionada pra
    // caber); links e tipos não suportados (vídeo/zip) viram uma nota em
    // texto — nada é descartado silenciosamente.
    async function anexarEvidencias(pdfDoc, PDFLib, escritor, fontes, model) {
        const { PDFDocument } = PDFLib;
        const anexos = anexosDoModelo(model);
        const linksNota = [];
        for (const { itemTitulo, anexo } of anexos) {
            if (anexo.ext === 'url') { linksNota.push({ itemTitulo, anexo }); continue; }
            escritor.novaPagina();
            escritor.linha(itemTitulo, { negrito: true, tamanho: 11 });
            escritor.linha(`Evidência: ${anexo.name}`, { tamanho: 9, cor: fontes.corMuted });
            escritor.espaco(8);
            try {
                if (anexo.ext === 'pdf') {
                    const bytes = dataUriParaBytes(anexo.dataUri);
                    const origem = await PDFDocument.load(bytes, { ignoreEncryption: true });
                    const paginasCopiadas = await pdfDoc.copyPages(origem, origem.getPageIndices());
                    paginasCopiadas.forEach((p) => pdfDoc.addPage(p));
                } else if (window.AppCore.isImageExt(anexo.ext)) {
                    let dataUri = anexo.dataUri;
                    let ehPng = /^(png)$/i.test(anexo.ext);
                    if (/^(gif|webp)$/i.test(anexo.ext)) { dataUri = await converterParaPng(dataUri); ehPng = true; }
                    const bytes = dataUriParaBytes(dataUri);
                    const imagem = ehPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
                    const areaW = CONTENT_W, areaH = Math.max(60, escritor.y - MARGIN);
                    const escala = Math.min(areaW / imagem.width, areaH / imagem.height, 1);
                    const w = imagem.width * escala, h = imagem.height * escala;
                    escritor.pagina.drawImage(imagem, { x: MARGIN + (areaW - w) / 2, y: escritor.y - h, width: w, height: h });
                    escritor.y -= h + 10;
                } else {
                    escritor.paragrafo(`Arquivo do tipo ".${anexo.ext}" não pode ser incluído dentro do PDF — consulte a pasta/Google Drive configurado para abri-lo.`, { cor: fontes.corMuted });
                }
            } catch (e) {
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
        let y = PAGE_H - 220;
        if (fotoImg) {
            const lado = 130;
            const escala = Math.min(lado / fotoImg.width, lado / fotoImg.height);
            const w = fotoImg.width * escala, h = fotoImg.height * escala;
            pagina.drawImage(fotoImg, { x: (PAGE_W - w) / 2, y: y - h, width: w, height: h });
            y -= h + 30;
        }
        const nomeTam = 24;
        const nomeSeguro = sanitizarTexto(fontes.negrito, model.nome);
        const nomeLargura = fontes.negrito.widthOfTextAtSize(nomeSeguro, nomeTam);
        pagina.drawText(nomeSeguro, { x: (PAGE_W - nomeLargura) / 2, y, size: nomeTam, font: fontes.negrito, color: fontes.corTextoCapa });
        y -= 34;
        const subTam = 14;
        const subSeguro = sanitizarTexto(fontes.regular, subtitulo);
        const subLargura = fontes.regular.widthOfTextAtSize(subSeguro, subTam);
        pagina.drawText(subSeguro, { x: (PAGE_W - subLargura) / 2, y, size: subTam, font: fontes.regular, color: fontes.corTextoCapa });
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
            const fonte = i === 0 ? fontes.negrito : fontes.regular;
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
    function desenharSumario(paginasReservadas, fontes, entradas) {
        let paginaIdx = 0, pagina = paginasReservadas[0], y = PAGE_H - MARGIN;
        pagina.drawText('Sumário', { x: MARGIN, y, size: 20, font: fontes.negrito, color: fontes.corTexto });
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
            const cor = e.nivel === 0 ? fontes.corTexto : fontes.corMuted;
            const numero = e.paginaIndex != null ? String(e.paginaIndex) : '';
            pagina.drawText(sanitizarTexto(fonte, e.titulo), { x: MARGIN + indent, y, size: tamanho, font: fonte, color: cor });
            const nw = fonte.widthOfTextAtSize(numero, tamanho);
            pagina.drawText(numero, { x: PAGE_W - MARGIN - nw, y, size: tamanho, font: fonte, color: cor });
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

    // Ponto de entrada — opts.incluirTodos: catálogo inteiro (ignora
    // "Publicar na Web") ou só os itens marcados para Publicar na Web
    // (mesmo recorte da página pública). Devolve o PDF pronto (Uint8Array).
    async function gerar(opts) {
        const incluirTodos = !!(opts && opts.incluirTodos);
        const PDFLib = await carregarPdfLib();
        const { PDFDocument, StandardFonts, rgb } = PDFLib;

        const pdfDoc = await PDFDocument.create();
        const model = await window.TabPublicar.buildPublicModel({ incluirTodos });
        pdfDoc.setTitle(`Relatório completo — ${model.nome}`);
        pdfDoc.setAuthor(model.nome);
        pdfDoc.setProducer('lattesZen');
        pdfDoc.setCreator('lattesZen (https://github.com/alexsandroccarv/latteszen)');

        const fontes = {
            regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
            negrito: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
            corTexto: corTexto(rgb), corMuted: corMuted(rgb), corAccent: corPrincipal(rgb),
            corTextoCapa: rgb(1, 1, 1), corTextoCapaMuted: rgb(0.85, 0.88, 0.95), corCapaFundo: corPrincipal(rgb),
        };

        const memorialItem = (window.AppCore.state.catalogo.items || []).find((i) => i.typeKey === 'MEMORIAL');
        const memorialTexto = String((memorialItem && memorialItem.fields && memorialItem.fields.descricao) || '').trim();
        const todosAnexos = anexosDoModelo(model);
        const temAnexos = todosAnexos.length > 0;

        let fotoImg = null;
        if (model.foto) {
            try {
                const ehPng = /^data:image\/png/i.test(model.foto);
                const bytes = dataUriParaBytes(model.foto);
                fotoImg = ehPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
            } catch (_) { fotoImg = null; }
        }

        // 1) Capa
        const subtituloCapa = memorialTexto ? 'Memorial e Currículo' : 'Currículo Completo';
        desenharCapa(pdfDoc, fontes, model, subtituloCapa, fotoImg);

        // 2) Sumário — reserva as páginas agora (o texto entra por último,
        //    quando os índices de página de cada seção já são conhecidos).
        const entradasSumario = [];
        if (memorialTexto) entradasSumario.push({ titulo: 'Memorial', nivel: 0, paginaIndex: null });
        entradasSumario.push({ titulo: 'Currículo completo', nivel: 0, paginaIndex: null });
        const entradasPorSecao = new Map();
        model.secoes.forEach((sec) => {
            const entrada = { titulo: sec.num ? `${sec.num}. ${sec.label}` : sec.label, nivel: 1, paginaIndex: null };
            entradasSumario.push(entrada);
            entradasPorSecao.set(sec.id, entrada);
        });
        if (temAnexos) entradasSumario.push({ titulo: 'Anexos — Evidências', nivel: 0, paginaIndex: null });

        const numPaginasSumario = calcularPaginasSumario(entradasSumario);
        const paginasSumario = [];
        for (let i = 0; i < numPaginasSumario; i++) paginasSumario.push(pdfDoc.addPage([PAGE_W, PAGE_H]));

        const escritor = criarEscritor(pdfDoc, fontes);

        // 3) Memorial (só existe se houver texto)
        if (memorialTexto) {
            desenharDivisoria(pdfDoc, fontes, 'Memorial');
            escritor.novaPagina();
            entradasSumario[0].paginaIndex = pdfDoc.getPageCount() - 1;
            escritor.paragrafo(memorialTexto, { tamanho: 11, leading: 1.6 });
        }

        // 4) Currículo completo
        desenharDivisoria(pdfDoc, fontes, 'Currículo Completo');
        escritor.novaPagina();
        entradasSumario.find((e) => e.titulo === 'Currículo completo').paginaIndex = pdfDoc.getPageCount() - 1;
        if (!model.secoes.length) {
            escritor.paragrafo('Nenhum item cadastrado ainda.', { cor: fontes.corMuted });
        }
        model.secoes.forEach((sec) => {
            escritor.espaco(6);
            const idx = escritor.linha(sec.num ? `${sec.num}. ${sec.label}` : sec.label, { negrito: true, tamanho: 13 });
            entradasPorSecao.get(sec.id).paginaIndex = idx;
            sec.tipos.forEach((tipo) => {
                escritor.espaco(4);
                escritor.linha(tipo.label, { negrito: true, tamanho: 11, indent: 12 });
                tipo.itens.forEach((item) => {
                    const anoTxt = item.ano ? ` (${item.ano})` : '';
                    escritor.paragrafo(`${item.titulo}${anoTxt}`, { tamanho: 10, indent: 24 });
                    if (item.linha) escritor.paragrafo(item.linha, { tamanho: 9, cor: fontes.corMuted, indent: 24 });
                    escritor.espaco(3);
                });
            });
        });

        // 5) Anexos (evidências marcadas como "pública" — mescladas de verdade)
        if (temAnexos) {
            desenharDivisoria(pdfDoc, fontes, 'Anexos — Evidências');
            escritor.novaPagina();
            entradasSumario.find((e) => e.titulo === 'Anexos — Evidências').paginaIndex = pdfDoc.getPageCount() - 1;
            await anexarEvidencias(pdfDoc, PDFLib, escritor, fontes, model);
        }

        // 6) Contracapa
        desenharContracapa(pdfDoc, fontes, model);

        // 7) Sumário (agora com os índices de página resolvidos) e paginação.
        desenharSumario(paginasSumario, fontes, entradasSumario);
        numerarPaginas(pdfDoc, fontes);

        return pdfDoc.save();
    }

    // quebrarLinhas/anexosDoModelo/calcularPaginasSumario/sanitizarTexto
    // expostos só para teste (tools/tests/specs/pdf-report.mjs) — nenhum dos
    // quatro depende do pdf-lib estar carregado, então dá pra verificar a
    // lógica pura mesmo com o CDN bloqueado (mesmo bloqueio de rede que a
    // suíte já aplica a Tailwind/Font Awesome — ver harness.mjs).
    return { gerar, quebrarLinhas, anexosDoModelo, calcularPaginasSumario, sanitizarTexto };
})();
