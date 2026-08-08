/* ==========================================================================
   lattesZen — Importador do XML do Currículo Lattes
   --------------------------------------------------------------------------
   Faz o parse do XML exportado pela Plataforma Lattes (CNPq) e mapeia as
   seções para os tipos internos (lattes-types.js). Nomes de tags e atributos
   seguem o schema oficial CurriculoLattes (ver CurriculoLattes.xsd).

   Estratégia: cada tipo-folha tem exatamente um grupo "DADOS-BASICOS-*" e um
   "DETALHAMENTO-*"; localizamos esses grupos por PREFIXO, o que evita
   enumerar dezenas de nomes de grupo. Título/ano/DOI variam de nome por
   seção, então usamos listas de candidatos.
   ========================================================================== */
window.LattesXML = (function () {

    /* ------------------------------ helpers ------------------------------ */
    function attrs(el) {
        const o = {};
        if (!el) return o;
        for (const a of el.attributes) o[a.name] = a.value;
        return o;
    }
    function firstTag(el, tag) { return el ? (el.getElementsByTagName(tag)[0] || null) : null; }
    // Atributos do primeiro filho DIRETO cujo nome começa com `prefix`
    function groupByPrefix(el, prefix) {
        if (!el) return {};
        for (const c of el.children) {
            if (c.tagName && c.tagName.indexOf(prefix) === 0) return attrs(c);
        }
        return {};
    }
    function pick(obj, ...keys) {
        for (const k of keys) if (obj[k] != null && obj[k] !== '') return obj[k];
        return '';
    }
    function paginas(d) {
        return [d['PAGINA-INICIAL'], d['PAGINA-FINAL']].filter(Boolean).join('-');
    }
    function humanize(v) {
        return v ? v.replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase()) : '';
    }

    const TITLE_KEYS = ['TITULO-DO-ARTIGO', 'TITULO-DO-LIVRO', 'TITULO-DO-CAPITULO-DO-LIVRO',
        'TITULO-DO-TRABALHO-TECNICO', 'TITULO-DO-TRABALHO', 'TITULO-DO-TEXTO', 'TITULO-DO-SOFTWARE',
        'TITULO-DO-PRODUTO', 'TITULO-DO-PROCESSO', 'TITULO'];
    const YEAR_KEYS = ['ANO-DO-ARTIGO', 'ANO-DO-TRABALHO', 'ANO-DO-TEXTO', 'ANO', 'ANO-DESENVOLVIMENTO',
        'ANO-DA-PREMIACAO', 'ANO-DE-OBTENCAO-DO-TITULO', 'ANO-DE-CONCLUSAO'];

    function titleOf(b) { return pick(b, ...TITLE_KEYS); }
    function yearOf(b) { return pick(b, ...YEAR_KEYS); }

    // Coleta autores (grupo repetível AUTORES)
    function autoresOf(el) {
        const nomes = [];
        for (const a of el.getElementsByTagName('AUTORES')) {
            const at = attrs(a);
            const n = at['NOME-COMPLETO-DO-AUTOR'] || at['NOME-PARA-CITACAO'];
            if (n) nomes.push(n);
        }
        return nomes.join('; ');
    }

    /* ---------------------- mapas de enumeração --------------------------- */
    const NAT_TRABALHO = { COMPLETO: 'Completo', RESUMO: 'Resumo', RESUMO_EXPANDIDO: 'Resumo expandido' };
    const NAT_LIVRO = { LIVRO_PUBLICADO: 'Livro publicado', LIVRO_ORGANIZADO_OU_EDICAO: 'Livro organizado' };

    const ORIENT_MAP = {
        'ORIENTACOES-CONCLUIDAS-PARA-MESTRADO':          { tipo: 'Mestrado', situacao: 'Concluída' },
        'ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO':         { tipo: 'Doutorado', situacao: 'Concluída' },
        'ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO':     { tipo: 'Pós-Doutorado', situacao: 'Concluída' },
        'OUTRAS-ORIENTACOES-CONCLUIDAS':                 { tipo: 'Outra', situacao: 'Concluída' },
        'ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO':           { tipo: 'Mestrado', situacao: 'Em andamento' },
        'ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO':          { tipo: 'Doutorado', situacao: 'Em andamento' },
        'ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO':      { tipo: 'Pós-Doutorado', situacao: 'Em andamento' },
        'ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO': { tipo: 'Especialização / Monografia', situacao: 'Em andamento' },
        'ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO':          { tipo: 'TCC / Graduação', situacao: 'Em andamento' },
        'ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA': { tipo: 'Iniciação científica', situacao: 'Em andamento' },
        'OUTRAS-ORIENTACOES-EM-ANDAMENTO':               { tipo: 'Outra', situacao: 'Em andamento' },
    };

    const PARTIC_MAP = {
        'PARTICIPACAO-EM-CONGRESSO': 'Congresso', 'PARTICIPACAO-EM-FEIRA': 'Feira',
        'PARTICIPACAO-EM-SEMINARIO': 'Seminário', 'PARTICIPACAO-EM-SIMPOSIO': 'Simpósio',
        'PARTICIPACAO-EM-OFICINA': 'Oficina', 'PARTICIPACAO-EM-ENCONTRO': 'Encontro',
        'PARTICIPACAO-EM-EXPOSICAO': 'Exposição', 'PARTICIPACAO-EM-OLIMPIADA': 'Olimpíada',
        'OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS': 'Outro',
    };

    const BANCA_MAP = {
        'PARTICIPACAO-EM-BANCA-DE-MESTRADO': 'Mestrado',
        'PARTICIPACAO-EM-BANCA-DE-DOUTORADO': 'Doutorado',
        'PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO': 'Qualificação',
        'PARTICIPACAO-EM-BANCA-DE-APERFEICOAMENTO-ESPECIALIZACAO': 'Especialização / Aperfeiçoamento',
        'PARTICIPACAO-EM-BANCA-DE-GRADUACAO': 'TCC / Graduação',
        'OUTRAS-PARTICIPACOES-EM-BANCA': 'Outra',
        'BANCA-JULGADORA-PARA-PROFESSOR-TITULAR': 'Professor titular',
        'BANCA-JULGADORA-PARA-CONCURSO-PUBLICO': 'Concurso público',
        'BANCA-JULGADORA-PARA-LIVRE-DOCENCIA': 'Livre-docência',
        'BANCA-JULGADORA-PARA-AVALIACAO-CURSOS': 'Avaliação de cursos',
        'OUTRAS-BANCAS-JULGADORAS': 'Outra',
    };

    const FORMACAO_MAP = {
        'GRADUACAO': 'Graduação', 'ESPECIALIZACAO': 'Especialização', 'APERFEICOAMENTO': 'Aperfeiçoamento',
        'MESTRADO': 'Mestrado', 'MESTRADO-PROFISSIONALIZANTE': 'Mestrado',
        'DOUTORADO': 'Doutorado', 'POS-DOUTORADO': 'Pós-Doutorado',
        'LIVRE-DOCENCIA': 'Livre-docência', 'RESIDENCIA-MEDICA': 'Residência médica',
    };

    /* -------------------- handlers por tag (produção) -------------------- */
    // Cada handler: { tags:[...], typeKey, map(el,b,d) -> fields }
    const HANDLERS = [
        { tags: ['ARTIGO-PUBLICADO', 'ARTIGO-ACEITO-PARA-PUBLICACAO'], typeKey: 'ARTIGO_PERIODICO',
          map: (el, b, d) => ({
              titulo: titleOf(b), ano: yearOf(b), doi: b['DOI'] || '', autores: autoresOf(el),
              periodico: d['TITULO-DO-PERIODICO-OU-REVISTA'] || '', issn: d['ISSN'] || '',
              volume: d['VOLUME'] || '', fasciculo: d['FASCICULO'] || '', paginas: paginas(d),
          }) },
        { tags: ['LIVRO-PUBLICADO-OU-ORGANIZADO'], typeKey: 'LIVRO',
          map: (el, b, d) => ({
              titulo: titleOf(b), ano: yearOf(b), autores: autoresOf(el),
              natureza: NAT_LIVRO[b['TIPO']] || humanize(b['TIPO']),
              editora: d['NOME-DA-EDITORA'] || '', cidade: d['CIDADE-DA-EDITORA'] || '',
              isbn: d['ISBN'] || '', edicao: d['NUMERO-DA-EDICAO-REVISAO'] || '', paginas: d['NUMERO-DE-PAGINAS'] || '',
          }) },
        { tags: ['CAPITULO-DE-LIVRO-PUBLICADO'], typeKey: 'CAPITULO_LIVRO',
          map: (el, b, d) => ({
              titulo: titleOf(b), ano: yearOf(b), autores: autoresOf(el),
              tituloLivro: d['TITULO-DO-LIVRO'] || '', organizadores: d['ORGANIZADORES'] || '',
              editora: d['NOME-DA-EDITORA'] || '', isbn: d['ISBN'] || '', paginas: paginas(d),
          }) },
        { tags: ['TRABALHO-EM-EVENTOS'], typeKey: 'TRABALHO_EVENTO',
          map: (el, b, d) => ({
              titulo: titleOf(b), ano: yearOf(b), doi: b['DOI'] || '', autores: autoresOf(el),
              natureza: NAT_TRABALHO[b['NATUREZA']] || humanize(b['NATUREZA']),
              evento: d['NOME-DO-EVENTO'] || '', anais: d['TITULO-DOS-ANAIS-OU-PROCEEDINGS'] || '',
              cidade: d['CIDADE-DO-EVENTO'] || '', paginas: paginas(d),
          }) },
        { tags: ['TEXTO-EM-JORNAL-OU-REVISTA'], typeKey: 'TEXTO_JORNAL',
          map: (el, b, d) => ({
              titulo: titleOf(b), ano: yearOf(b), autores: autoresOf(el),
              veiculo: d['TITULO-DO-JORNAL-OU-REVISTA'] || '', data: d['DATA-DE-PUBLICACAO'] || '', paginas: paginas(d),
          }) },

        // ---- Produção técnica ----
        { tags: ['SOFTWARE'], typeKey: 'SOFTWARE',
          map: (el, b, d) => ({
              titulo: titleOf(b), ano: yearOf(b), autores: autoresOf(el),
              plataforma: d['PLATAFORMA'] || d['AMBIENTE'] || '', finalidade: d['FINALIDADE'] || b['FINALIDADE'] || '',
          }) },
        { tags: ['PATENTE'], typeKey: 'PATENTE',
          map: (el, b, d) => {
              const reg = attrs(firstTag(el, 'REGISTRO-OU-PATENTE'));
              return {
                  titulo: titleOf(b), ano: yearOf(b), autores: autoresOf(el),
                  categoria: d['CATEGORIA'] || '', finalidade: d['FINALIDADE'] || '',
                  registro: reg['CODIGO-DO-REGISTRO-OU-PATENTE'] || '', instituicao: d['INSTITUICAO-FINANCIADORA'] || '',
              };
          } },
        { tags: ['PRODUTO-TECNOLOGICO'], typeKey: 'PRODUTO_TECNOLOGICO',
          map: (el, b, d) => ({
              titulo: titleOf(b), ano: yearOf(b), autores: autoresOf(el),
              finalidade: d['FINALIDADE'] || '',
          }) },
        { tags: ['TRABALHO-TECNICO'], typeKey: 'TRABALHO_TECNICO',
          map: (el, b, d) => ({
              titulo: titleOf(b), ano: yearOf(b), natureza: humanize(b['NATUREZA']),
              instituicao: d['INSTITUICAO-FINANCIADORA'] || '', finalidade: d['FINALIDADE'] || '',
          }) },
        { tags: ['APRESENTACAO-DE-TRABALHO'], typeKey: 'APRESENTACAO',
          map: (el, b, d) => ({
              titulo: titleOf(b), ano: yearOf(b), natureza: humanize(b['NATUREZA']),
              evento: d['NOME-DO-EVENTO'] || '', instituicao: d['INSTITUICAO-PROMOTORA'] || '',
              cidade: d['CIDADE-DA-APRESENTACAO'] || '',
          }) },
        { tags: ['CURSO-DE-CURTA-DURACAO-MINISTRADO'], typeKey: 'CURSO_MINISTRADO',
          map: (el, b, d) => ({
              titulo: titleOf(b), ano: yearOf(b),
              instituicao: d['INSTITUICAO-PROMOTORA-DO-CURSO'] || '', cargaHoraria: d['DURACAO'] || '',
          }) },
        { tags: ['DESENVOLVIMENTO-DE-MATERIAL-DIDATICO-OU-INSTRUCIONAL'], typeKey: 'MATERIAL_DIDATICO',
          map: (el, b, d) => ({ titulo: titleOf(b), ano: yearOf(b), autores: autoresOf(el), finalidade: d['FINALIDADE'] || '' }) },
        { tags: ['ORGANIZACAO-DE-EVENTO'], typeKey: 'ORGANIZACAO_EVENTO',
          map: (el, b, d) => ({
              titulo: titleOf(b), ano: yearOf(b), tipoEvento: humanize(b['TIPO']),
              instituicao: d['INSTITUICAO-PROMOTORA'] || '', cidade: d['CIDADE'] || '',
          }) },
        { tags: ['EDITORACAO'], typeKey: 'EDITORACAO',
          map: (el, b, d) => ({
              titulo: titleOf(b), ano: yearOf(b), natureza: humanize(b['NATUREZA']),
              editora: d['EDITORA'] || '', cidade: d['CIDADE'] || '', paginas: d['NUMERO-DE-PAGINAS'] || '',
          }) },

        // ---- Prêmio ----
        { tags: ['PREMIO-TITULO'], typeKey: 'PREMIO',
          map: (el, b) => {
              const a = attrs(el);
              return { titulo: a['NOME-DO-PREMIO-OU-TITULO'] || '', ano: a['ANO-DA-PREMIACAO'] || '',
                       entidade: a['NOME-DA-ENTIDADE-PROMOTORA'] || '' };
          }, flat: true },
    ];

    /* --------------------------- parse principal ------------------------- */
    function parse(xmlText) {
        const errors = [];
        const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
        if (doc.querySelector('parsererror')) {
            return { items: [], summary: {}, errors: ['XML inválido ou corrompido.'] };
        }

        const items = [];
        const summary = {};
        const seenRefs = new Set();

        function add(typeKey, fields, el) {
            const canon = (fields.titulo || fields.curso || fields.orientando || fields.candidato || fields.instituicao || '')
                .toLowerCase().replace(/\s+/g, ' ').trim();
            const ref = `${typeKey}|${canon}|${fields.ano || fields.anoFim || ''}`;
            if (!canon) return;                 // ignora itens sem título
            if (seenRefs.has(ref)) return;      // dedup dentro do próprio XML
            seenRefs.add(ref);
            items.push({ typeKey, fields, lattesRef: ref });
            summary[typeKey] = (summary[typeKey] || 0) + 1;
        }

        // 1) Handlers baseados em DADOS-BASICOS/DETALHAMENTO
        HANDLERS.forEach(h => {
            h.tags.forEach(tag => {
                for (const el of doc.getElementsByTagName(tag)) {
                    try {
                        const b = h.flat ? attrs(el) : groupByPrefix(el, 'DADOS-BASICOS');
                        const d = h.flat ? {} : groupByPrefix(el, 'DETALHAMENTO');
                        add(h.typeKey, h.map(el, b, d), el);
                    } catch (e) { errors.push(`${tag}: ${e.message}`); }
                }
            });
        });

        // 2) Orientações (concluídas + em andamento)
        Object.keys(ORIENT_MAP).forEach(tag => {
            const ctx = ORIENT_MAP[tag];
            for (const el of doc.getElementsByTagName(tag)) {
                const b = groupByPrefix(el, 'DADOS-BASICOS');
                const d = groupByPrefix(el, 'DETALHAMENTO');
                add('ORIENTACAO', {
                    orientando: d['NOME-DO-ORIENTADO'] || d['NOME-DO-ORIENTANDO'] || '',
                    tipo: ctx.tipo, situacao: ctx.situacao,
                    titulo: pick(b, 'TITULO-DO-TRABALHO', 'TITULO'),
                    instituicao: d['NOME-DA-INSTITUICAO'] || d['NOME-INSTITUICAO'] || '',
                    ano: yearOf(b),
                }, el);
            }
        });

        // 3) Participação em eventos/congressos
        Object.keys(PARTIC_MAP).forEach(tag => {
            for (const el of doc.getElementsByTagName(tag)) {
                const b = groupByPrefix(el, 'DADOS-BASICOS');
                const d = groupByPrefix(el, 'DETALHAMENTO');
                add('PARTICIPACAO_EVENTO', {
                    titulo: pick(b, 'TITULO', ...TITLE_KEYS) || d['NOME-DO-EVENTO'] || '',
                    ano: yearOf(b), natureza: 'Participação', tipoEvento: PARTIC_MAP[tag],
                    cidade: d['CIDADE-DO-EVENTO'] || '',
                }, el);
            }
        });

        // 4) Bancas (trabalhos de conclusão + julgadoras)
        Object.keys(BANCA_MAP).forEach(tag => {
            for (const el of doc.getElementsByTagName(tag)) {
                const b = groupByPrefix(el, 'DADOS-BASICOS');
                const d = groupByPrefix(el, 'DETALHAMENTO');
                add('BANCA', {
                    tipo: BANCA_MAP[tag],
                    candidato: d['NOME-DO-CANDIDATO'] || '',
                    titulo: pick(b, 'TITULO', ...TITLE_KEYS),
                    instituicao: d['NOME-INSTITUICAO'] || '',
                    ano: yearOf(b),
                }, el);
            }
        });

        // 5) Formação acadêmica / titulação (atributos no próprio elemento do nível)
        const formCont = doc.getElementsByTagName('FORMACAO-ACADEMICA-TITULACAO')[0];
        if (formCont) {
            for (const el of formCont.children) {
                const nivel = FORMACAO_MAP[el.tagName];
                if (!nivel) continue;
                const a = attrs(el);
                add('FORMACAO_ACADEMICA', {
                    nivel,
                    curso: a['NOME-CURSO'] || a['NOME-DO-CURSO'] || '',
                    instituicao: a['NOME-INSTITUICAO'] || '',
                    anoInicio: a['ANO-DE-INICIO'] || '',
                    anoFim: a['ANO-DE-CONCLUSAO'] || a['ANO-DE-OBTENCAO-DO-TITULO'] || '',
                    titulo: pick(a, 'TITULO-DO-TRABALHO-DE-CONCLUSAO-DE-CURSO', 'TITULO-DA-MONOGRAFIA',
                        'TITULO-DA-DISSERTACAO-TESE', 'TITULO-DA-RESIDENCIA-MEDICA', 'TITULO-DO-TRABALHO'),
                    orientador: pick(a, 'NOME-DO-ORIENTADOR', 'NOME-COMPLETO-DO-ORIENTADOR', 'NOME-ORIENTADOR-GRAD'),
                }, el);
            }
        }

        // 5b) Formação complementar (cursos de curta duração, extensão, etc.)
        const formCompl = doc.getElementsByTagName('FORMACAO-COMPLEMENTAR')[0];
        if (formCompl) {
            for (const el of formCompl.children) {
                if (!el.tagName || el.tagName.indexOf('FORMACAO-COMPLEMENTAR-') !== 0) continue;
                const a = attrs(el);
                add('FORMACAO_COMPLEMENTAR', {
                    titulo: a['NOME-CURSO'] || a['NOME-DO-CURSO'] || '',
                    ano: a['ANO-DE-CONCLUSAO'] || a['ANO-DE-INICIO'] || '',
                    instituicao: a['NOME-INSTITUICAO'] || '',
                    cargaHoraria: a['CARGA-HORARIA'] || '',
                }, el);
            }
        }

        // 6) Atuação profissional → vínculos
        for (const atu of doc.getElementsByTagName('ATUACAO-PROFISSIONAL')) {
            const nomeInst = attrs(atu)['NOME-INSTITUICAO'] || '';
            for (const v of atu.children) {
                if (v.tagName !== 'VINCULOS') continue;
                const a = attrs(v);
                add('VINCULO_PROFISSIONAL', {
                    instituicao: nomeInst,
                    vinculo: a['TIPO-DE-VINCULO'] ? humanize(a['TIPO-DE-VINCULO']) : (a['OUTRO-VINCULO-INFORMADO'] || ''),
                    cargo: a['ENQUADRAMENTO-FUNCIONAL'] ? humanize(a['ENQUADRAMENTO-FUNCIONAL']) : (a['OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO'] || ''),
                    anoInicio: a['ANO-INICIO'] || '',
                    anoFim: a['ANO-FIM'] || '',
                    titulo: a['OUTRAS-INFORMACOES'] || '',
                }, v);
            }
        }

        // Titular
        const dg = doc.getElementsByTagName('DADOS-GERAIS')[0];
        const titular = dg ? (attrs(dg)['NOME-COMPLETO'] || '') : '';

        return { items, summary, errors, titular };
    }

    return { parse };
})();
