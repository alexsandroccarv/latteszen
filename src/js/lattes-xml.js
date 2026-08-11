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
        'TITULO-DO-PRODUTO', 'TITULO-DO-PROCESSO', 'DENOMINACAO', 'TITULO'];
    const YEAR_KEYS = ['ANO-DO-ARTIGO', 'ANO-DO-TRABALHO', 'ANO-DO-TEXTO', 'ANO', 'ANO-DESENVOLVIMENTO',
        'ANO-SOLICITACAO', 'ANO-DA-PREMIACAO', 'ANO-DE-OBTENCAO-DO-TITULO', 'ANO-DE-CONCLUSAO'];

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
    const PROF_MAP = { BEM: 'Bom', RAZOAVELMENTE: 'Razoável', POUCO: 'Pouco' };
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
        'CURSO-TECNICO-PROFISSIONALIZANTE': 'Curso técnico',
        'ENSINO-FUNDAMENTAL-PRIMEIRO-GRAU': 'Ensino fundamental', 'ENSINO-MEDIO-SEGUNDO-GRAU': 'Ensino médio',
    };

    /* -------------------- handlers por tag (produção) -------------------- */
    // Cada handler: { tags:[...], typeKey, map(el,b,d) -> fields }
    const HANDLERS = [
        { tags: ['ARTIGO-PUBLICADO'], typeKey: 'ARTIGO_PERIODICO',
          map: (el, b, d) => ({
              titulo: titleOf(b), ano: yearOf(b), doi: b['DOI'] || '', autores: autoresOf(el),
              periodico: d['TITULO-DO-PERIODICO-OU-REVISTA'] || '', issn: d['ISSN'] || '',
              volume: d['VOLUME'] || '', fasciculo: d['FASCICULO'] || '', paginas: paginas(d),
          }) },
        { tags: ['ARTIGO-ACEITO-PARA-PUBLICACAO'], typeKey: 'ARTIGO_ACEITO',
          map: (el, b, d) => ({
              titulo: titleOf(b), ano: yearOf(b), doi: b['DOI'] || '', autores: autoresOf(el),
              periodico: d['TITULO-DO-PERIODICO-OU-REVISTA'] || '', issn: d['ISSN'] || '',
          }) },
        { tags: ['LIVRO-PUBLICADO-OU-ORGANIZADO'], typeKey: 'LIVRO_CAPITULO',
          map: (el, b, d) => ({
              tipoObra: NAT_LIVRO[b['TIPO']] || 'Livro publicado',
              titulo: titleOf(b), ano: yearOf(b), autores: autoresOf(el),
              editora: d['NOME-DA-EDITORA'] || '', cidade: d['CIDADE-DA-EDITORA'] || '',
              isbn: d['ISBN'] || '', edicao: d['NUMERO-DA-EDICAO-REVISAO'] || '', paginas: d['NUMERO-DE-PAGINAS'] || '',
          }) },
        { tags: ['CAPITULO-DE-LIVRO-PUBLICADO'], typeKey: 'LIVRO_CAPITULO',
          map: (el, b, d) => ({
              tipoObra: 'Capítulo de livro',
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
        { tags: ['SOFTWARE'], typeKey: 'SOFTWARE_SEM_REGISTRO',
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
        { tags: ['DESENHO-INDUSTRIAL'], typeKey: 'DESENHO_INDUSTRIAL',
          map: (el, b, d) => ({
              titulo: titleOf(b), ano: yearOf(b), autores: autoresOf(el),
              finalidade: d['FINALIDADE'] || '', instituicao: d['INSTITUICAO-FINANCIADORA'] || '',
          }) },
        { tags: ['MARCA'], typeKey: 'MARCA',
          map: (el, b, d) => ({
              titulo: titleOf(b), ano: yearOf(b), autores: autoresOf(el),
              natureza: humanize(d['NATUREZA']), finalidade: d['FINALIDADE'] || '',
          }) },
        { tags: ['CULTIVAR-REGISTRADA'], typeKey: 'CULTIVAR_REGISTRADA',
          map: (el, b, d) => ({
              titulo: b['DENOMINACAO'] || titleOf(b), ano: yearOf(b), autores: autoresOf(el),
              finalidade: d['FINALIDADE'] || '', instituicao: d['INSTITUICAO-FINANCIADORA'] || '',
          }) },
        { tags: ['CULTIVAR-PROTEGIDA'], typeKey: 'CULTIVAR_PROTEGIDA',
          map: (el, b, d) => ({
              titulo: b['DENOMINACAO'] || titleOf(b), ano: yearOf(b), autores: autoresOf(el),
              finalidade: d['FINALIDADE'] || '', instituicao: d['INSTITUICAO-FINANCIADORA'] || '',
          }) },
        { tags: ['TOPOGRAFIA-DE-CIRCUITO-INTEGRADO'], typeKey: 'TOPOGRAFIA_CI',
          map: (el, b, d) => ({
              titulo: titleOf(b), ano: yearOf(b), autores: autoresOf(el),
              finalidade: d['FINALIDADE'] || '', instituicao: d['INSTITUICAO-FINANCIADORA'] || '',
          }) },
        { tags: ['PRODUTO-TECNOLOGICO'], typeKey: 'PRODUTO_TECNOLOGICO',
          map: (el, b, d) => ({
              titulo: titleOf(b), ano: yearOf(b), autores: autoresOf(el),
              finalidade: d['FINALIDADE'] || '',
          }) },
        { tags: ['PROCESSOS-OU-TECNICAS'], typeKey: 'PROCESSO_TECNICA',
          map: (el, b, d) => ({
              titulo: titleOf(b), ano: yearOf(b), autores: autoresOf(el),
              natureza: humanize(b['NATUREZA']), finalidade: d['FINALIDADE'] || '',
              instituicao: d['INSTITUICAO-FINANCIADORA'] || '', cidade: d['CIDADE-DO-PROCESSO'] || '',
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

        const primaryCat = (window.LattesTypes && window.LattesTypes.primaryCategory) || (() => 'PRODUCOES');

        function add(typeKey, fields, el) {
            const canon = (fields.titulo || fields.curso || fields.orientando || fields.candidato || fields.instituicao || '')
                .toLowerCase().replace(/\s+/g, ' ').trim();
            const categoryKey = primaryCat(typeKey);
            // A referência inclui a CATEGORIA: o mesmo item em categorias
            // diferentes é tratado como registros distintos (atrelados à origem).
            const ref = `${categoryKey}|${typeKey}|${canon}|${fields.ano || ''}|${fields.anoInicio || ''}|${fields.anoFim || ''}`;
            if (!canon) return;                 // ignora itens sem título
            if (seenRefs.has(ref)) return;      // dedup dentro do próprio XML (mesma categoria)
            seenRefs.add(ref);
            items.push({ typeKey, categoryKey, fields, lattesRef: ref });
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
                const tkey = ctx.situacao === 'Concluída' ? 'ORIENTACAO_CONCLUIDA' : 'ORIENTACAO_ANDAMENTO';
                add(tkey, {
                    orientando: d['NOME-DO-ORIENTADO'] || d['NOME-DO-ORIENTANDO'] || '',
                    tipo: ctx.tipo,
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
                const simNao = v => { const s = String(v || '').toUpperCase(); return s === 'SIM' ? 'Sim' : (s === 'NAO' || s === 'NÃO' ? 'Não' : ''); };
                add('PARTICIPACAO_EVENTO', {
                    titulo: d['NOME-DO-EVENTO'] || pick(b, 'TITULO', ...TITLE_KEYS) || '',
                    natureza: PARTIC_MAP[tag],
                    formaParticipacao: humanize(b['FORMA-DE-PARTICIPACAO'] || ''),
                    tituloApresentacao: pick(b, 'TITULO', ...TITLE_KEYS) || '',
                    ano: yearOf(b),
                    pais: b['PAIS'] || '',
                    cidade: d['CIDADE-DO-EVENTO'] || '',
                    divulgacaoCT: simNao(b['FLAG-DIVULGACAO-CIENTIFICA']),
                    url: b['HOME-PAGE-DO-TRABALHO'] || '',
                }, el);
            }
        });

        // 4) Bancas (trabalhos de conclusão + julgadoras)
        Object.keys(BANCA_MAP).forEach(tag => {
            for (const el of doc.getElementsByTagName(tag)) {
                const b = groupByPrefix(el, 'DADOS-BASICOS');
                const d = groupByPrefix(el, 'DETALHAMENTO');
                const julgadora = tag.indexOf('BANCA-JULGADORA') === 0 || tag === 'OUTRAS-BANCAS-JULGADORAS';
                add(julgadora ? 'BANCA_JULGADORA' : 'BANCA_CONCLUSAO', {
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
                const tituloTrab = pick(a, 'TITULO-DO-TRABALHO-DE-CONCLUSAO-DE-CURSO', 'TITULO-DA-MONOGRAFIA',
                    'TITULO-DA-DISSERTACAO-TESE', 'TITULO-DA-RESIDENCIA-MEDICA', 'TITULO-DO-TRABALHO');
                const orientador = pick(a, 'NOME-DO-ORIENTADOR', 'NOME-COMPLETO-DO-ORIENTADOR', 'NOME-ORIENTADOR-GRAD');
                const anoInicio = a['ANO-DE-INICIO'] || '';
                const anoFim = a['ANO-DE-CONCLUSAO'] || a['ANO-DE-OBTENCAO-DO-TITULO'] || '';
                if (nivel === 'Pós-Doutorado' || nivel === 'Livre-docência') {
                    add('POS_DOUTORADO', { tipo: nivel, instituicao: a['NOME-INSTITUICAO'] || '', anoInicio, anoFim, titulo: tituloTrab, orientador }, el);
                } else {
                    add('FORMACAO_ACADEMICA', {
                        nivel, curso: a['NOME-CURSO'] || a['NOME-DO-CURSO'] || '',
                        instituicao: a['NOME-INSTITUICAO'] || '', anoInicio, anoFim, titulo: tituloTrab, orientador,
                    }, el);
                }
            }
        }

        // 5b) Formação complementar (cursos de curta duração, extensão, etc.)
        const formCompl = doc.getElementsByTagName('FORMACAO-COMPLEMENTAR')[0];
        if (formCompl) {
            // Aceita qualquer filho com nome de curso (FORMACAO-COMPLEMENTAR-* e também OUTROS)
            for (const el of formCompl.children) {
                const a = attrs(el);
                const nome = a['NOME-CURSO'] || a['NOME-DO-CURSO'];
                if (!nome) continue;
                add('FORMACAO_COMPLEMENTAR', {
                    titulo: nome,
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
                // Quando TIPO/ENQUADRAMENTO é "LIVRE" (ou vazio), o valor real do
                // vínculo/cargo está nos campos OUTRO-*-INFORMADO.
                const enumOuVazio = (val) => (val && val !== 'LIVRE') ? humanize(val) : '';
                add('VINCULO_PROFISSIONAL', {
                    instituicao: nomeInst,
                    vinculo: a['OUTRO-VINCULO-INFORMADO'] || enumOuVazio(a['TIPO-DE-VINCULO']),
                    cargo: a['OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO'] || enumOuVazio(a['ENQUADRAMENTO-FUNCIONAL']),
                    anoInicio: a['ANO-INICIO'] || '',
                    anoFim: a['ANO-FIM'] || '',
                    titulo: a['OUTRAS-INFORMACOES'] || '',
                }, v);
            }
        }

        // 6b) Atuação profissional → atividades (ensino, direção, conselho, extensão, serviço, outras)
        const ATIV = [
            { tag: 'ENSINO', typeKey: 'ATIV_ENSINO', map: (a, el) => ({
                titulo: a['NOME-CURSO'] || humanize(a['TIPO-ENSINO']) || 'Ensino',
                anoInicio: a['ANO-INICIO'] || '', anoFim: a['ANO-FIM'] || '',
                disciplinas: Array.from(el.getElementsByTagName('DISCIPLINA')).map(d => (d.textContent || '').trim()).filter(Boolean).join('; '),
            }) },
            { tag: 'DIRECAO-E-ADMINISTRACAO', typeKey: 'ATIV_DIRECAO', map: (a) => ({
                titulo: a['CARGO-OU-FUNCAO'] || 'Direção/administração', orgao: a['NOME-ORGAO'] || '',
                anoInicio: a['ANO-INICIO'] || '', anoFim: a['ANO-FIM'] || '' }) },
            { tag: 'CONSELHO-COMISSAO-E-CONSULTORIA', typeKey: 'ATIV_CONSELHO', map: (a) => ({
                titulo: a['NOME-ORGAO'] || 'Conselho/comissão', papel: a['ESPECIFICACAO'] || '',
                anoInicio: a['ANO-INICIO'] || '', anoFim: a['ANO-FIM'] || '' }) },
            { tag: 'EXTENSAO-UNIVERSITARIA', typeKey: 'ATIV_EXTENSAO', map: (a) => ({
                titulo: a['ATIVIDADE-DE-EXTENSAO-REALIZADA'] || 'Extensão universitária', orgao: a['NOME-ORGAO'] || '',
                anoInicio: a['ANO-INICIO'] || '', anoFim: a['ANO-FIM'] || '' }) },
            { tag: 'SERVICO-TECNICO-ESPECIALIZADO', typeKey: 'ATIV_SERVICO', map: (a) => ({
                titulo: a['SERVICO-REALIZADO'] || 'Serviço técnico', orgao: a['NOME-ORGAO'] || '',
                anoInicio: a['ANO-INICIO'] || '', anoFim: a['ANO-FIM'] || '' }) },
            { tag: 'OUTRA-ATIVIDADE-TECNICO-CIENTIFICA', typeKey: 'ATIV_OUTRA', map: (a) => ({
                titulo: a['ATIVIDADE-REALIZADA'] || 'Atividade técnico-científica', orgao: a['NOME-ORGAO'] || '',
                anoInicio: a['ANO-INICIO'] || '', anoFim: a['ANO-FIM'] || '' }) },
        ];
        try {
        for (const atu of doc.getElementsByTagName('ATUACAO-PROFISSIONAL')) {
            const nomeInst = attrs(atu)['NOME-INSTITUICAO'] || '';
            ATIV.forEach(h => {
                for (const el of atu.getElementsByTagName(h.tag)) {
                    const f = h.map(attrs(el), el);
                    f.instituicao = nomeInst;
                    add(h.typeKey, f, el);
                }
            });
        }
        } catch (e) { errors.push('Atividades da atuação: ' + e.message); }

        // 7) Dados gerais: identificação, endereço, idiomas, áreas de atuação,
        //    resumo do CV e outras informações relevantes.
        try {
        const clean = (s) => String(s || '').replace(/&#1[03];/g, m => m === '&#10;' ? '\n' : '').trim();
        const dgEl = doc.getElementsByTagName('DADOS-GERAIS')[0];
        if (dgEl) {
            const g = attrs(dgEl);
            if (g['NOME-COMPLETO']) {
                add('IDENTIFICACAO', {
                    titulo: g['NOME-COMPLETO'], citacoes: g['NOME-EM-CITACOES-BIBLIOGRAFICAS'] || '',
                    orcid: g['ORCID-ID'] || '',
                }, dgEl);
            }
            const resumo = firstTag(dgEl, 'RESUMO-CV');
            if (resumo) {
                const t = attrs(resumo)['TEXTO-RESUMO-CV-RH'] || '';
                if (t) add('RESUMO_CV', { titulo: 'Texto inicial do Currículo Lattes', descricao: clean(t) }, resumo);
            }
            const outras = firstTag(dgEl, 'OUTRAS-INFORMACOES-RELEVANTES');
            if (outras) {
                const t = attrs(outras)['OUTRAS-INFORMACOES-RELEVANTES'] || '';
                if (t) add('OUTRAS_INFO', { titulo: 'Outras informações relevantes', descricao: clean(t) }, outras);
            }
            const endProf = firstTag(dgEl, 'ENDERECO-PROFISSIONAL');
            if (endProf) {
                const e = attrs(endProf);
                const log = e['LOGRADOURO-COMPLEMENTO'] || e['NOME-INSTITUICAO-EMPRESA'] || '';
                if (log) add('ENDERECO', { titulo: log, tipo: 'Profissional', cidade: e['CIDADE'] || '', uf: e['UF'] || '', cep: e['CEP'] || '' }, endProf);
            }
        }
        // Idiomas
        for (const el of doc.getElementsByTagName('IDIOMA')) {
            const a = attrs(el);
            const hab = [
                ['Leitura', a['PROFICIENCIA-DE-LEITURA']], ['Fala', a['PROFICIENCIA-DE-FALA']],
                ['Escrita', a['PROFICIENCIA-DE-ESCRITA']], ['Compreensão', a['PROFICIENCIA-DE-COMPREENSAO']],
            ].filter(([, v]) => v && PROF_MAP[v]).map(([k, v]) => `${k}: ${PROF_MAP[v]}`).join('; ');
            add('IDIOMAS', { titulo: a['DESCRICAO-DO-IDIOMA'] || a['IDIOMA'] || '', habilidades: hab }, el);
        }
        // Áreas de atuação (categoria 03)
        for (const el of doc.getElementsByTagName('AREA-DE-ATUACAO')) {
            const a = attrs(el);
            const titulo = a['NOME-DA-ESPECIALIDADE'] || a['NOME-DA-SUB-AREA-DO-CONHECIMENTO'] || a['NOME-DA-AREA-DO-CONHECIMENTO'] || humanize(a['NOME-GRANDE-AREA-DO-CONHECIMENTO']);
            if (!titulo) continue;
            add('AREA_ATUACAO', {
                grandeArea: humanize(a['NOME-GRANDE-AREA-DO-CONHECIMENTO']),
                area: a['NOME-DA-AREA-DO-CONHECIMENTO'] || '',
                subarea: a['NOME-DA-SUB-AREA-DO-CONHECIMENTO'] || '', especialidade: a['NOME-DA-ESPECIALIDADE'] || '',
                areaConhecimento: [humanize(a['NOME-GRANDE-AREA-DO-CONHECIMENTO']), a['NOME-DA-AREA-DO-CONHECIMENTO'], a['NOME-DA-SUB-AREA-DO-CONHECIMENTO'], a['NOME-DA-ESPECIALIDADE']].map(x => (x || '').trim()).filter(Boolean).join(' › '),
                titulo,
            }, el);
        }
        } catch (e) { errors.push('Dados gerais: ' + e.message); }

        // Titular
        const dg = doc.getElementsByTagName('DADOS-GERAIS')[0];
        const titular = dg ? (attrs(dg)['NOME-COMPLETO'] || '') : '';

        return { items, summary, errors, titular };
    }

    return { parse };
})();
