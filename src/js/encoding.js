/* ==========================================================================
   lattesZen — Camada de CODIFICAÇÃO (compatibilidade com o Lattes)
   --------------------------------------------------------------------------
   O Currículo Lattes usa ISO-8859-1 (Latin-1). Internamente o lattesZen
   trabalha com strings Unicode (JS/UTF-16) e persiste em JSON/UTF-8 — o que é
   lossless. As conversões acontecem nas BORDAS:

     ENTRADA  (import XML):  bytes ISO-8859-1 → string Unicode  (decodeBuffer)
     SAÍDA    (export XML):  string Unicode  → bytes ISO-8859-1 (encodeLatin1Xml)

   Como um documento ISO-8859-1 não representa caracteres acima de U+00FF,
   na saída esses caracteres são emitidos como ENTIDADES NUMÉRICAS XML (&#N;),
   que são válidas independentemente do encoding do documento. Também há um
   normalizador de pontuação (aspas curvas, travessão, reticências…) para
   manter o texto limpo e reduzir o uso de entidades.
   ========================================================================== */
window.LzEncoding = (function () {

    /* ----------------------------- ENTRADA ------------------------------- */
    // Detecta o encoding declarado no cabeçalho XML (default utf-8) e decodifica.
    function detectEncoding(buffer) {
        const head = new TextDecoder('ascii').decode(new Uint8Array(buffer.slice(0, 200)));
        const m = head.match(/encoding=["']([^"']+)["']/i);
        return (m ? m[1] : 'utf-8').toLowerCase();
    }
    function decodeBuffer(buffer, encoding) {
        const enc = encoding || detectEncoding(buffer);
        try { return new TextDecoder(enc).decode(buffer); }
        catch (_) { return new TextDecoder('iso-8859-1').decode(buffer); }
    }
    async function decodeXmlFile(file) {
        return decodeBuffer(await file.arrayBuffer());
    }

    /* --------------------------- NORMALIZAÇÃO ---------------------------- */
    // Mapeia pontuação Unicode comum para equivalentes representáveis em Latin-1.
    const NORM = {
        '‘': "'", '’': "'", '‚': "'", '‛': "'",   // aspas simples curvas
        '“': '"', '”': '"', '„': '"', '‟': '"',   // aspas duplas curvas
        '–': '-', '—': '-', '―': '-', '−': '-',   // travessões / menos
        '…': '...',                                              // reticências
        ' ': ' ', ' ': ' ', ' ': ' ',                  // espaços especiais
        '•': '-', 'ʼ': "'", '⁄': '/',
    };
    const NORM_RE = new RegExp('[' + Object.keys(NORM).join('') + ']', 'g');
    function normalizePunctuation(s) {
        return String(s == null ? '' : s).replace(NORM_RE, c => NORM[c] || c);
    }

    /* ----------------------------- VALIDAÇÃO ----------------------------- */
    // Retorna a lista de caracteres fora do ISO-8859-1 (code point > 255).
    function findNonLatin1(s) {
        const out = [];
        for (const ch of String(s == null ? '' : s)) {
            const cp = ch.codePointAt(0);
            if (cp > 255) out.push({ ch, cp });
        }
        return out;
    }
    function isLatin1Compatible(s) { return findNonLatin1(s).length === 0; }

    /* ------------------------------ SAÍDA -------------------------------- */
    // Escapa caracteres reservados de XML.
    function xmlEscape(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    }
    // String Unicode → string cujos caracteres são todos ≤ U+00FF (os demais
    // viram entidade numérica &#N;), pronta para virar bytes Latin-1.
    function toLatin1XmlString(s) {
        let out = '';
        for (const ch of String(s == null ? '' : s)) {
            const cp = ch.codePointAt(0);
            out += cp > 255 ? `&#${cp};` : ch;
        }
        return out;
    }
    // Empacota uma string (já ≤255 por caractere) em bytes ISO-8859-1.
    function latin1Bytes(s) {
        const bytes = new Uint8Array(s.length);
        for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 0xFF;
        return bytes;
    }
    // Conversor de SAÍDA completo: texto Unicode → Uint8Array em ISO-8859-1
    // (com entidades numéricas para o que estiver fora do Latin-1).
    function encodeLatin1Xml(s) {
        return latin1Bytes(toLatin1XmlString(s));
    }
    // Serializa um documento XML inteiro para Blob ISO-8859-1 (uso futuro no
    // exportador para o Lattes). Recebe a string XML já montada.
    function xmlBlobLatin1(xmlString) {
        return new Blob([encodeLatin1Xml(xmlString)], { type: 'application/xml' });
    }

    return {
        // entrada
        detectEncoding, decodeBuffer, decodeXmlFile,
        // normalização / validação
        normalizePunctuation, findNonLatin1, isLatin1Compatible,
        // saída
        xmlEscape, toLatin1XmlString, latin1Bytes, encodeLatin1Xml, xmlBlobLatin1,
    };
})();
