/* ==========================================================================
   lattesZen — Deduplicação de importação por assinatura de conteúdo
   --------------------------------------------------------------------------
   Extraído de tab-config.js (issue de refatoração). Nenhuma mudança de
   conteúdo, só saiu do arquivo único original.
   ========================================================================== */
const { state } = window.AppCore;


    /* ----------------------- Deduplicação de importação -----------------------
       Uma "assinatura de conteúdo" identifica o MESMO item entre importações,
       independente da categoria e resistente a edições locais. Casa três casos:
       (1) re-importar um item já importado (mesma assinatura viva);
       (2) item importado e depois EDITADO localmente — a assinatura ORIGINAL do
           Lattes fica gravada em `lattesRef` (imutável) e continua casando;
       (3) item criado MANUALMENTE no lattesZen que depois passa a existir no
           Lattes — casa pela assinatura viva e é "adotado" (recebe lattesRef).
       Assim NUNCA se cria duplicata a cada nova importação do XML.           */
    function _canonTitle(f) {
        // Cadeia de campos-título por prioridade. Inclui os campos preservados no
        // round-trip de tipos sem "titulo" próprio (ex.: Áreas de atuação usam a
        // hierarquia especialidade/subárea/área), para que também deduplicem.
        return String((f && (f.titulo || f.curso || f.orientando || f.candidato
            || f.especialidade || f.subarea || f.area || f.instituicao)) || '')
            .toLowerCase().replace(/\s+/g, ' ').trim();
    }
    // Reduz qualquer data (aaaa, aaaa-mm-dd ou dd/mm/aaaa) ao ano de 4 dígitos.
    // Assim a assinatura de um item com data completa (ex.: ATIV_CONSELHO) casa
    // com o mesmo item reimportado do Lattes, que traz só o ano — sem duplicar.
    function _sigYear(v) { const m = String(v == null ? '' : v).match(/\d{4}/); return m ? m[0] : ''; }
    export function itemSignature(typeKey, fields) {
        const c = _canonTitle(fields);
        return c ? `${typeKey}|${c}|${_sigYear(fields && fields.ano)}|${_sigYear(fields && fields.anoInicio)}|${_sigYear(fields && fields.anoFim)}` : '';
    }
    // Assinatura(s) derivada(s) de um item existente: a viva (campos atuais) e a
    // original gravada em lattesRef (formato cat|type|canon|ano|ini|fim → tira a categoria).
    export function itemSignatures(it) {
        const out = [];
        const live = itemSignature(it.typeKey, it.fields || {});
        if (live) out.push(live);
        if (it.lattesRef) {
            const parts = String(it.lattesRef).split('|');
            if (parts.length >= 2) { const s = parts.slice(1).join('|'); if (s) out.push(s); }
        }
        return out;
    }
    // Mapa assinatura -> item existente (primeira ocorrência vence).
    export function existingSignatureMap() {
        const map = new Map();
        for (const it of state.items) for (const s of itemSignatures(it)) if (!map.has(s)) map.set(s, it);
        return map;
    }
