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
    // Reduz qualquer data (aaaa, ou um `datebr` completo — canônico sem
    // separador, ou dd/mm/aaaa de item salvo antes desta migração) ao ano
    // de 4 dígitos (sempre os ÚLTIMOS 4, nunca "os primeiros 4 dígitos
    // encontrados" — mesma lógica de AppCore.anoDe()). Assim a assinatura de
    // um item com data completa (ex.: ATIV_CONSELHO) casa com o mesmo item
    // reimportado do Lattes, que traz só o ano — sem duplicar.
    function _sigYear(v) { const d = String(v == null ? '' : v).replace(/\D/g, ''); return d.length >= 4 ? d.slice(-4) : ''; }
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
        for (const it of state.catalogo.items) for (const s of itemSignatures(it)) if (!map.has(s)) map.set(s, it);
        return map;
    }
