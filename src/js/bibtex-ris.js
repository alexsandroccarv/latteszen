/* ==========================================================================
   lattesZen — Parser de BibTeX/RIS (issue #6)
   --------------------------------------------------------------------------
   Faz o parse de um arquivo .bib (BibTeX) ou .ris (RIS) num formato
   normalizado, independente do lattesZen: cada entrada vira
   { tipoOriginal, titulo, autores[], ano, periodico, issn, isbn, volume,
     fasciculo, paginaInicial, paginaFinal, editora, doi, url }.

   O mapeamento desse formato normalizado para os tipos/campos do lattesZen
   (lattes-types.js) fica em app.js — este arquivo só entende BibTeX/RIS,
   não a taxonomia do Lattes.

   Tolerância: não é um parser BibTeX/RIS completo (não cobre @string,
   abreviações, todos os macros LaTeX etc.) — cobre os casos comuns de
   exportação do Zotero/Mendeley/EndNote/Google Scholar.
   ========================================================================== */
window.LzBibRis = (function () {

    /* ------------------------------ BibTeX -------------------------------- */
    // Mapa dos macros LaTeX de acentuação mais comuns em bibliografia em
    // português/espanhol/francês. Não é exaustivo — é o suficiente para não
    // deixar "S\~{a}o Paulo" ou "Fran\c{c}a" ilegíveis após a importação.
    const LATEX_ACCENTS = {
        "\\'a": 'á', "\\'e": 'é', "\\'i": 'í', "\\'o": 'ó', "\\'u": 'ú',
        "\\'A": 'Á', "\\'E": 'É', "\\'I": 'Í', "\\'O": 'Ó', "\\'U": 'Ú',
        '\\`a': 'à', '\\`e': 'è', '\\`o': 'ò', '\\`A': 'À',
        '\\~a': 'ã', '\\~o': 'õ', '\\~n': 'ñ', '\\~A': 'Ã', '\\~O': 'Õ', '\\~N': 'Ñ',
        '\\^a': 'â', '\\^e': 'ê', '\\^o': 'ô', '\\^A': 'Â', '\\^E': 'Ê', '\\^O': 'Ô',
        '\\"o': 'ö', '\\"u': 'ü', '\\"a': 'ä', '\\"O': 'Ö', '\\"U': 'Ü',
        '\\c{c}': 'ç', '\\c c': 'ç', '\\c{C}': 'Ç', '\\c C': 'Ç',
    };
    function unescapeLatex(s) {
        let out = String(s == null ? '' : s);
        // Duas formas equivalentes de escrever o mesmo acento — normaliza para
        // uma só antes de consultar o mapa: "{\'e}" → "\'e" (chave protetora ao
        // redor do macro) e "\'{e}" → "\'e" (chave só ao redor da letra).
        out = out.replace(/\{(\\[`'^~"][a-zA-Z]|\\c\{?[a-zA-Z]\}?)\}/g, '$1');
        out = out.replace(/\\([`'^~"])\{([a-zA-Z])\}/g, '\\$1$2');
        out = out.replace(/\\c\{([a-zA-Z])\}/g, '\\c $1');
        Object.keys(LATEX_ACCENTS).forEach((k) => { out = out.split(k).join(LATEX_ACCENTS[k]); });
        out = out.replace(/[{}]/g, ''); // chaves remanescentes (ex.: proteção de maiúsculas em siglas)
        return out.replace(/\s+/g, ' ').trim();
    }
    // Extrai as entradas @tipo{...} do texto, respeitando chaves aninhadas nos
    // valores (ex.: title = {Um Título com {Sigla} no Meio}).
    function splitBibEntries(text) {
        const out = [];
        const n = text.length;
        let i = 0;
        while (i < n) {
            const at = text.indexOf('@', i);
            if (at === -1) break;
            let j = at + 1;
            while (j < n && /[a-zA-Z]/.test(text[j])) j++;
            const tipo = text.slice(at + 1, j).toLowerCase();
            while (j < n && /\s/.test(text[j])) j++;
            if (j >= n || (text[j] !== '{' && text[j] !== '(')) { i = at + 1; continue; }
            const abre = text[j], fecha = abre === '{' ? '}' : ')';
            let depth = 1, k = j + 1;
            while (k < n && depth > 0) {
                if (text[k] === abre) depth++;
                else if (text[k] === fecha) depth--;
                k++;
            }
            if (tipo && tipo !== 'comment' && tipo !== 'string' && tipo !== 'preamble') {
                out.push({ tipo, corpo: text.slice(j + 1, k - 1) });
            }
            i = k;
        }
        return out;
    }
    // Extrai os campos "nome = {valor}" (ou "valor", ou valor nu) do corpo de
    // uma entrada, ignorando a citekey inicial. Tolerante a vírgulas dentro de
    // valores entre chaves/aspas (não quebra o parse no meio de um título).
    function parseBibFields(corpo) {
        const fields = {};
        const n = corpo.length;
        let pos = corpo.indexOf(',');
        if (pos === -1) return fields;
        pos++;
        while (pos < n) {
            while (pos < n && /[\s,]/.test(corpo[pos])) pos++;
            if (pos >= n) break;
            const start = pos;
            while (pos < n && /[a-zA-Z0-9_-]/.test(corpo[pos])) pos++;
            const nome = corpo.slice(start, pos).toLowerCase();
            while (pos < n && /\s/.test(corpo[pos])) pos++;
            if (!nome || corpo[pos] !== '=') { pos++; continue; } // campo malformado — avança e tenta o próximo
            pos++;
            while (pos < n && /\s/.test(corpo[pos])) pos++;
            let valor = '';
            if (corpo[pos] === '{') {
                let depth = 1, s = pos + 1, k = s;
                while (k < n && depth > 0) {
                    if (corpo[k] === '{') depth++;
                    else if (corpo[k] === '}') depth--;
                    k++;
                }
                valor = corpo.slice(s, k - 1);
                pos = k;
            } else if (corpo[pos] === '"') {
                let depth = 0, s = pos + 1, k = s;
                while (k < n) {
                    if (corpo[k] === '{') depth++;
                    else if (corpo[k] === '}') depth--;
                    else if (corpo[k] === '"' && depth === 0) break;
                    k++;
                }
                valor = corpo.slice(s, k);
                pos = k + 1;
            } else {
                const s = pos;
                while (pos < n && corpo[pos] !== ',') pos++;
                valor = corpo.slice(s, pos).trim();
            }
            fields[nome] = unescapeLatex(valor);
        }
        return fields;
    }
    // "Sobrenome, Nome" ou "Nome Sobrenome", múltiplos separados por " and ".
    function parseBibAuthors(s) {
        if (!s) return [];
        return String(s).split(/\s+and\s+/i).map((tok) => {
            tok = tok.trim();
            if (!tok) return '';
            const virgula = tok.indexOf(',');
            if (virgula > -1) return `${tok.slice(virgula + 1).trim()} ${tok.slice(0, virgula).trim()}`.trim();
            return tok;
        }).filter(Boolean);
    }
    function parsePages(s) {
        if (!s) return [null, null];
        const partes = String(s).split(/-{1,2}/).map((x) => x.trim()).filter(Boolean);
        return [partes[0] || null, partes[1] || partes[0] || null];
    }
    function normalizeBibEntry({ tipo, corpo }) {
        const f = parseBibFields(corpo);
        const [ini, fim] = parsePages(f.pages);
        const ano = (f.year || '').match(/\d{4}/);
        return {
            tipoOriginal: tipo, titulo: f.title || '', autores: parseBibAuthors(f.author),
            ano: ano ? ano[0] : '', periodico: f.journal || f.booktitle || '',
            issn: f.issn || '', isbn: f.isbn || '', volume: f.volume || '', fasciculo: f.number || '',
            paginaInicial: ini || '', paginaFinal: fim || '', editora: f.publisher || '',
            doi: f.doi || '', url: f.url || '',
        };
    }
    function parseBibTeX(text) {
        return splitBibEntries(text).map(normalizeBibEntry);
    }

    /* -------------------------------- RIS ---------------------------------- */
    // Tags que podem se repetir (múltiplos autores) — o resto sobrescreve.
    const RIS_AUTOR_TAGS = new Set(['AU', 'A1', 'A2', 'A3']);
    function parseRIS(text) {
        const linhas = String(text).split(/\r\n|\r|\n/);
        const registros = [];
        let atual = null;
        for (const linha of linhas) {
            const m = linha.match(/^([A-Z][A-Z0-9])\s*-\s?(.*)$/);
            if (!m) continue;
            const tag = m[1], valor = m[2].trim();
            if (tag === 'TY') { if (atual) registros.push(atual); atual = { tipo: valor, fields: {} }; continue; }
            if (tag === 'ER') { if (atual) registros.push(atual); atual = null; continue; }
            if (!atual) continue;
            if (RIS_AUTOR_TAGS.has(tag)) (atual.fields.autores || (atual.fields.autores = [])).push(valor);
            else atual.fields[tag] = valor;
        }
        if (atual) registros.push(atual);
        return registros.map(normalizeRisEntry);
    }
    function normalizeRisEntry({ tipo, fields: f }) {
        const autores = (f.autores || []).map((tok) => {
            const virgula = tok.indexOf(',');
            if (virgula > -1) return `${tok.slice(virgula + 1).trim()} ${tok.slice(0, virgula).trim()}`.trim();
            return tok;
        });
        const ano = (f.PY || f.Y1 || '').match(/\d{4}/);
        return {
            tipoOriginal: tipo, titulo: f.TI || f.T1 || f.CT || f.BT || '', autores,
            ano: ano ? ano[0] : '', periodico: f.JO || f.JF || f.T2 || f.BT || '',
            issn: f.SN || '', isbn: f.SN || '', volume: f.VL || '', fasciculo: f.IS || '',
            paginaInicial: f.SP || '', paginaFinal: f.EP || '', editora: f.PB || '',
            doi: f.DO || '', url: f.UR || '',
        };
    }

    /* ------------------------------ API pública ---------------------------- */
    // Detecta o formato pelo conteúdo (não pela extensão do arquivo, que a
    // usuária pode ter renomeado) e retorna { formato, entradas }.
    function parse(text) {
        const s = String(text == null ? '' : text);
        if (/^[A-Z][A-Z0-9]\s*-/m.test(s) && !/^﻿?\s*@/.test(s)) return { formato: 'ris', entradas: parseRIS(s) };
        if (s.indexOf('@') !== -1) return { formato: 'bibtex', entradas: parseBibTeX(s) };
        return { formato: 'desconhecido', entradas: [] };
    }

    return { parse };
})();
