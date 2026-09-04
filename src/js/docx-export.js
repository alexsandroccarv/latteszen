/* ==========================================================================
   lattesZen — Geração de .docx (Word) sem dependências externas
   --------------------------------------------------------------------------
   Um .docx é um arquivo ZIP com XML dentro (OOXML). Aqui vai um empacotador
   ZIP mínimo (método "store", sem compressão — válido e mais simples que
   implementar DEFLATE) e um conjunto pequeno de helpers para montar o
   documento (parágrafos, negrito, tabelas com bordas). Mantém o app sem
   dependências de runtime (ver package.json).
   ========================================================================== */
window.LzDocx = (function () {
    /* ------------------------------- ZIP (store) ------------------------------- */
    const CRC_TABLE = (() => {
        const t = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            t[n] = c >>> 0;
        }
        return t;
    })();
    function crc32(bytes) {
        let c = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    }
    function strToBytes(s) { return new TextEncoder().encode(s); }

    // Empacota arquivos (sem compressão — método 0) num ZIP válido: cabeçalho
    // local + dados por arquivo, seguidos do diretório central e do EOCD.
    function buildZip(files) {
        const localParts = [];
        const centralParts = [];
        let offset = 0;
        const DOS_TIME = 0, DOS_DATE = 0x21; // data fixa (não relevante p/ arquivo gerado)
        files.forEach(f => {
            const nameBytes = strToBytes(f.name);
            const data = f.data;
            const crc = crc32(data);
            const size = data.length;

            const local = new Uint8Array(30 + nameBytes.length);
            const ldv = new DataView(local.buffer);
            ldv.setUint32(0, 0x04034b50, true);
            ldv.setUint16(4, 20, true);
            ldv.setUint16(6, 0, true);
            ldv.setUint16(8, 0, true);
            ldv.setUint16(10, DOS_TIME, true);
            ldv.setUint16(12, DOS_DATE, true);
            ldv.setUint32(14, crc, true);
            ldv.setUint32(18, size, true);
            ldv.setUint32(22, size, true);
            ldv.setUint16(26, nameBytes.length, true);
            ldv.setUint16(28, 0, true);
            local.set(nameBytes, 30);
            localParts.push(local, data);

            const central = new Uint8Array(46 + nameBytes.length);
            const cdv = new DataView(central.buffer);
            cdv.setUint32(0, 0x02014b50, true);
            cdv.setUint16(4, 20, true);
            cdv.setUint16(6, 20, true);
            cdv.setUint16(8, 0, true);
            cdv.setUint16(10, 0, true);
            cdv.setUint16(12, DOS_TIME, true);
            cdv.setUint16(14, DOS_DATE, true);
            cdv.setUint32(16, crc, true);
            cdv.setUint32(20, size, true);
            cdv.setUint32(24, size, true);
            cdv.setUint16(28, nameBytes.length, true);
            cdv.setUint16(30, 0, true);
            cdv.setUint16(32, 0, true);
            cdv.setUint16(34, 0, true);
            cdv.setUint16(36, 0, true);
            cdv.setUint32(38, 0, true);
            cdv.setUint32(42, offset, true);
            central.set(nameBytes, 46);
            centralParts.push(central);

            offset += local.length + data.length;
        });

        const centralSize = centralParts.reduce((a, p) => a + p.length, 0);
        const centralOffset = offset;
        const eocd = new Uint8Array(22);
        const edv = new DataView(eocd.buffer);
        edv.setUint32(0, 0x06054b50, true);
        edv.setUint16(8, files.length, true);
        edv.setUint16(10, files.length, true);
        edv.setUint32(12, centralSize, true);
        edv.setUint32(16, centralOffset, true);

        const parts = [...localParts, ...centralParts, eocd];
        const total = parts.reduce((a, p) => a + p.length, 0);
        const out = new Uint8Array(total);
        let pos = 0;
        parts.forEach(p => { out.set(p, pos); pos += p.length; });
        return out;
    }

    /* ------------------------------- OOXML (Word) ------------------------------- */
    function escXml(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function run(text, opts) {
        opts = opts || {};
        const props = [];
        if (opts.bold) props.push('<w:b/>');
        if (opts.italic) props.push('<w:i/>');
        if (opts.size) props.push(`<w:sz w:val="${opts.size}"/><w:szCs w:val="${opts.size}"/>`);
        const rPr = props.length ? `<w:rPr>${props.join('')}</w:rPr>` : '';
        return `<w:r>${rPr}<w:t xml:space="preserve">${escXml(text)}</w:t></w:r>`;
    }
    function para(runsOrText, opts) {
        opts = opts || {};
        const runsXml = Array.isArray(runsOrText) ? runsOrText.join('') : run(runsOrText, opts);
        const pPrParts = [];
        if (opts.style) pPrParts.push(`<w:pStyle w:val="${opts.style}"/>`);
        if (opts.align) pPrParts.push(`<w:jc w:val="${opts.align}"/>`);
        pPrParts.push(`<w:spacing w:after="${opts.spacingAfter != null ? opts.spacingAfter : 120}"/>`);
        const pPr = `<w:pPr>${pPrParts.join('')}</w:pPr>`;
        return `<w:p>${pPr}${runsXml}</w:p>`;
    }
    // Aplica o estilo nomeado "Heading{level}" — o Word (em qualquer idioma)
    // reconhece esse ID reservado e mostra o nome traduzido próprio da UI
    // (ex.: "Título 2"/"Título 3" no Word em português), além de habilitar
    // navegação por título e sumário automático. Mantém também a formatação
    // direta (negrito/tamanho) para ficar legível em visualizadores que
    // ignorem o styles.xml.
    function heading(text, level) {
        const sizes = { 1: 28, 2: 24, 3: 22 }; // meios-pontos: 14pt / 12pt / 11pt
        return para(text, { bold: true, size: sizes[level] || 22, spacingAfter: 160, style: 'Heading' + (level || 1) });
    }
    function cell(text, opts) {
        opts = opts || {};
        const width = opts.width || 1500;
        const content = para(text, { bold: !!opts.bold, size: opts.size || 18, spacingAfter: 0 });
        return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${opts.shade ? `<w:shd w:val="clear" w:fill="${opts.shade}"/>` : ''}</w:tcPr>${content}</w:tc>`;
    }
    function row(cells) { return `<w:tr>${cells.join('')}</w:tr>`; }
    function table(rows, colWidths) {
        const grid = colWidths.map(w => `<w:gridCol w:w="${w}"/>`).join('');
        const borderSides = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'];
        const borders = '<w:tblBorders>' + borderSides.map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`).join('') + '</w:tblBorders>';
        return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${borders}</w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rows.join('')}</w:tbl>`;
    }

    const CONTENT_TYPES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
        + '</Types>';
    const RELS_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        + '</Relationships>';
    const DOCUMENT_RELS_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        + '</Relationships>';

    // Estilos de parágrafo nomeados com os IDs reservados "Heading1/2/3" —
    // é esse ID (não o w:name) que o Word usa para exibir o nome traduzido
    // ("Título 1/2/3" em português) e habilitar o painel de navegação e
    // sumário automático por título.
    function headingStyleXml(id, size, outlineLvl, spacingBefore) {
        return `<w:style w:type="paragraph" w:styleId="${id}">`
            + `<w:name w:val="heading ${outlineLvl + 1}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/>`
            + `<w:uiPriority w:val="9"/><w:qFormat/>`
            + `<w:pPr><w:outlineLvl w:val="${outlineLvl}"/><w:spacing w:before="${spacingBefore}" w:after="160"/></w:pPr>`
            + `<w:rPr><w:b/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr>`
            + '</w:style>';
    }
    const STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        + '<w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>'
        + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'
        + headingStyleXml('Heading1', 28, 0, 240)
        + headingStyleXml('Heading2', 24, 1, 200)
        + headingStyleXml('Heading3', 22, 2, 160)
        + '</w:styles>';

    function buildDocumentXml(bodyXml) {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            + `<w:body>${bodyXml}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body>`
            + '</w:document>';
    }

    // Monta os bytes finais do .docx a partir do XML do corpo do documento.
    function buildDocx(bodyXml) {
        const files = [
            { name: '[Content_Types].xml', data: strToBytes(CONTENT_TYPES_XML) },
            { name: '_rels/.rels', data: strToBytes(RELS_XML) },
            { name: 'word/_rels/document.xml.rels', data: strToBytes(DOCUMENT_RELS_XML) },
            { name: 'word/document.xml', data: strToBytes(buildDocumentXml(bodyXml)) },
            { name: 'word/styles.xml', data: strToBytes(STYLES_XML) },
        ];
        return buildZip(files);
    }

    return { escXml, run, para, heading, cell, row, table, buildDocx };
})();
