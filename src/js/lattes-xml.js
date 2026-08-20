/* ==========================================================================
   lattesZen — Importador do XML do Currículo Lattes
   --------------------------------------------------------------------------
   Faz o parse do XML exportado pela Plataforma Lattes (CNPq) e mapeia as
   seções para os tipos internos (lattes-types.js). Nomes de tags e atributos
   seguem o schema oficial CurriculoLattes (ver docs/CurriculoLattes.xsd).

   Estratégia: cada tipo-folha tem um grupo "DADOS-BASICOS-*" e um
   "DETALHAMENTO-*"; localizamos esses grupos por PREFIXO, o que evita
   enumerar dezenas de nomes de grupo. Título/ano/país/idioma variam de nome
   por seção, então usamos listas de candidatos.

   Este importador tem PARIDADE com o exportador (lattes-xml-export.js): todo
   campo que o exportador grava, o importador lê de volta.
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
    // DDMMAAAA (8 dígitos) -> 'AAAA-MM-DD' (formato dos campos date do lattesZen)
    function dateISO(v) {
        const s = String(v == null ? '' : v).replace(/\D/g, '');
        return s.length === 8 ? `${s.slice(4, 8)}-${s.slice(2, 4)}-${s.slice(0, 2)}` : '';
    }

    const TITLE_KEYS = ['TITULO-DO-ARTIGO', 'TITULO-DO-LIVRO', 'TITULO-DO-CAPITULO-DO-LIVRO',
        'TITULO-DO-TRABALHO-TECNICO', 'TITULO-DO-TRABALHO', 'TITULO-DO-TEXTO', 'TITULO-DO-SOFTWARE',
        'TITULO-DO-PRODUTO', 'TITULO-DO-PROCESSO', 'DENOMINACAO', 'TITULO'];
    const YEAR_KEYS = ['ANO-DO-ARTIGO', 'ANO-DO-TRABALHO', 'ANO-DO-TEXTO', 'ANO', 'ANO-DESENVOLVIMENTO',
        'ANO-SOLICITACAO', 'ANO-DA-PREMIACAO', 'ANO-DE-OBTENCAO-DO-TITULO', 'ANO-DE-CONCLUSAO'];

    function titleOf(b) { return pick(b, ...TITLE_KEYS); }
    function yearOf(b) { return pick(b, ...YEAR_KEYS); }
    function paisOf(b) { return pick(b, 'PAIS-DE-PUBLICACAO', 'PAIS-DO-EVENTO', 'PAIS'); }
    function urlOf(b) { return pick(b, 'HOME-PAGE-DO-TRABALHO', 'HOME-PAGE'); }
    // Campos comuns de DADOS-BASICOS presentes na maioria das produções.
    function comuns(b) {
        return { titulo: titleOf(b), ano: yearOf(b), pais: paisOf(b), idioma: b['IDIOMA'] || '', url: urlOf(b), doi: b['DOI'] || '' };
    }
    // Registro/patente (filho de DETALHAMENTO em patentes, software, cultivar…)
    function regOf(el) {
        const r = attrs(firstTag(el, 'REGISTRO-OU-PATENTE'));
        const h = attrs(firstTag(el, 'HISTORICO-SITUACOES-PATENTE'));
        return {
            registro: r['CODIGO-DO-REGISTRO-OU-PATENTE'] || '',
            dataDeposito: dateISO(r['DATA-PEDIDO-DE-DEPOSITO']),
            dataConcessao: dateISO(r['DATA-DE-CONCESSAO']),
            situacao: h['DESCRICAO-SITUACAO-PATENTE'] || '',
        };
    }
    // Ajusta valores de campos SELECT para a opção exata do tipo (casa por token),
    // garantindo que o rótulo importado bata com uma opção do formulário.
    function snapSelects(typeKey, fields) {
        const def = window.LattesTypes && LattesTypes.getType(typeKey);
        if (!def || !window.LattesEnums) return;
        for (const f of (def.fields || [])) {
            if (f.type !== 'select' || !f.options) continue;
            const v = fields[f.key]; if (!v || f.options.indexOf(v) >= 0) continue;
            const t = LattesEnums.tok(v);
            const match = f.options.find(o => LattesEnums.tok(o) === t);
            if (match) fields[f.key] = match;
        }
    }

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
    // Membros de banca (grupo repetível PARTICIPANTE-BANCA)
    function membrosBanca(el) {
        const nomes = [];
        for (const a of el.getElementsByTagName('PARTICIPANTE-BANCA')) {
            const at = attrs(a);
            const n = at['NOME-COMPLETO-DO-PARTICIPANTE-DA-BANCA'] || at['NOME-PARA-CITACAO-DO-PARTICIPANTE-DA-BANCA'];
            if (n) nomes.push(n);
        }
        return nomes.join('; ');
    }
    // PALAVRAS-CHAVE (PALAVRA-CHAVE-1..6) -> "chuva; seca"
    function palavrasChaveOf(el) {
        const p = attrs(firstTag(el, 'PALAVRAS-CHAVE'));
        return [1, 2, 3, 4, 5, 6].map(i => p[`PALAVRA-CHAVE-${i}`]).filter(Boolean).join('; ');
    }
    // AREA-DO-CONHECIMENTO-1 (dentro de AREAS-DO-CONHECIMENTO) -> campos do seletor em cascata
    function areaDoConhecimentoOf(el) {
        const a = attrs(firstTag(el, 'AREA-DO-CONHECIMENTO-1'));
        return {
            grandeArea: humanize(a['NOME-GRANDE-AREA-DO-CONHECIMENTO']),
            area: a['NOME-DA-AREA-DO-CONHECIMENTO'] || '',
            subarea: a['NOME-DA-SUB-AREA-DO-CONHECIMENTO'] || '',
            especialidade: a['NOME-DA-ESPECIALIDADE'] || '',
        };
    }
    // INFORMACOES-ADICIONAIS -> texto livre
    function informacoesAdicionaisOf(el) {
        return attrs(firstTag(el, 'INFORMACOES-ADICIONAIS'))['DESCRICAO-INFORMACOES-ADICIONAIS'] || '';
    }

    /* ---------------------- mapas de enumeração --------------------------- */
    const PROF_MAP = { BEM: 'Bom', RAZOAVELMENTE: 'Razoável', POUCO: 'Pouco' };
    const NAT_TRABALHO = { COMPLETO: 'Completo', RESUMO: 'Resumo', RESUMO_EXPANDIDO: 'Resumo expandido' };
    const NAT_LIVRO = { LIVRO_PUBLICADO: 'Livro publicado', LIVRO_ORGANIZADO_OU_EDICAO: 'Livro organizado' };
    const ORIENT_TIPO = { ORIENTADOR_PRINCIPAL: 'Orientador principal', CO_ORIENTADOR: 'Coorientador' };
    const PROJ_SITUACAO = { EM_ANDAMENTO: 'Em andamento', CONCLUIDO: 'Concluído', DESATIVADO: 'Desativado' };
    const simNao = v => { const s = String(v || '').toUpperCase(); return s === 'SIM' ? 'Sim' : (s === 'NAO' || s === 'NÃO' ? 'Não' : ''); };

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
    // "Outras orientações concluídas" tem NATUREZA enumerada no schema — o
    // exportador também grava um TIPO em texto livre (mesmo elemento) com o
    // rótulo exato; preferimos essa cópia e caímos no enum como alternativa.
    const OUTRA_ORIENT_CONCL_TOKEN_TO_TIPO = {
        INICIACAO_CIENTIFICA: 'Iniciação científica',
        TRABALHO_DE_CONCLUSAO_DE_CURSO_GRADUACAO: 'TCC / Graduação',
        MONOGRAFIA_DE_CONCLUSAO_DE_CURSO_APERFEICOAMENTO_E_ESPECIALIZACAO: 'Especialização / Monografia',
        'ORIENTACAO-DE-OUTRA-NATUREZA': 'Outra',
    };

    const PARTIC_MAP = {
        'PARTICIPACAO-EM-CONGRESSO': 'Congresso', 'PARTICIPACAO-EM-FEIRA': 'Feira',
        'PARTICIPACAO-EM-SEMINARIO': 'Seminário', 'PARTICIPACAO-EM-SIMPOSIO': 'Simpósio',
        'PARTICIPACAO-EM-OFICINA': 'Oficina', 'PARTICIPACAO-EM-ENCONTRO': 'Encontro',
        'PARTICIPACAO-EM-EXPOSICAO': 'Exposição', 'PARTICIPACAO-EM-OLIMPIADA': 'Olimpíada',
        'OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS': 'Outra',
    };

    const BANCA_MAP = {
        'PARTICIPACAO-EM-BANCA-DE-MESTRADO': 'Mestrado',
        'PARTICIPACAO-EM-BANCA-DE-DOUTORADO': 'Doutorado',
        'PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO': 'Exame de qualificação de doutorado',
        'PARTICIPACAO-EM-BANCA-DE-APERFEICOAMENTO-ESPECIALIZACAO': 'Curso de aperfeiçoamento/especialização',
        'PARTICIPACAO-EM-BANCA-DE-GRADUACAO': 'Graduação',
        'OUTRAS-PARTICIPACOES-EM-BANCA': 'Outra',
        'BANCA-JULGADORA-PARA-PROFESSOR-TITULAR': 'Professor titular',
        'BANCA-JULGADORA-PARA-CONCURSO-PUBLICO': 'Concurso público',
        'BANCA-JULGADORA-PARA-LIVRE-DOCENCIA': 'Livre-docência',
        'BANCA-JULGADORA-PARA-AVALIACAO-CURSOS': 'Avaliação de cursos',
        'OUTRAS-BANCAS-JULGADORAS': 'Outra',
    };
    // Mestrado é o único com TIPO (ACADEMICO/PROFISSIONALIZANTE) no schema.
    const MODALIDADE_MESTRADO_MAP = { ACADEMICO: 'Acadêmico', PROFISSIONALIZANTE: 'Profissionalizante' };
    // O schema junta qualificação de mestrado e de doutorado num só elemento;
    // distinguimos pelo atributo NATUREZA (texto livre) quando presente.
    function qualifNatureza(raw) {
        const s = String(raw || '').toLowerCase();
        if (s.indexOf('mestrado') >= 0) return 'Exame de qualificação de mestrado';
        if (s.indexOf('doutorado') >= 0) return 'Exame de qualificação de doutorado';
        return raw || 'Exame de qualificação de doutorado';
    }

    const FORMACAO_MAP = {
        'GRADUACAO': 'Graduação', 'ESPECIALIZACAO': 'Especialização', 'APERFEICOAMENTO': 'Aperfeiçoamento',
        'MESTRADO': 'Mestrado', 'MESTRADO-PROFISSIONALIZANTE': 'Mestrado',
        'DOUTORADO': 'Doutorado', 'POS-DOUTORADO': 'Pós-Doutorado',
        'LIVRE-DOCENCIA': 'Livre-docência', 'RESIDENCIA-MEDICA': 'Residência médica',
        'CURSO-TECNICO-PROFISSIONALIZANTE': 'Curso técnico',
        'ENSINO-FUNDAMENTAL-PRIMEIRO-GRAU': 'Ensino fundamental', 'ENSINO-MEDIO-SEGUNDO-GRAU': 'Ensino médio',
    };

    /* -------------------- handlers por tag (produção) -------------------- */
    // Cada handler: { tags:[...], typeKey (string|fn), map(el,b,d) -> fields }
    const HANDLERS = [
        // ---- Bibliográfica ----
        { tags: ['ARTIGO-PUBLICADO'], typeKey: 'ARTIGO_PERIODICO',
          map: (el, b, d) => Object.assign(comuns(b), {
              autores: autoresOf(el),
              periodico: d['TITULO-DO-PERIODICO-OU-REVISTA'] || '', issn: d['ISSN'] || '',
              volume: d['VOLUME'] || '', fasciculo: d['FASCICULO'] || '', paginas: paginas(d),
          }) },
        { tags: ['ARTIGO-ACEITO-PARA-PUBLICACAO'], typeKey: 'ARTIGO_ACEITO',
          map: (el, b, d) => Object.assign(comuns(b), {
              autores: autoresOf(el),
              periodico: d['TITULO-DO-PERIODICO-OU-REVISTA'] || '', issn: d['ISSN'] || '',
          }) },
        { tags: ['LIVRO-PUBLICADO-OU-ORGANIZADO'], typeKey: 'LIVRO_CAPITULO',
          map: (el, b, d) => Object.assign(comuns(b), {
              tipoObra: NAT_LIVRO[b['TIPO']] || 'Livro publicado', autores: autoresOf(el),
              editora: d['NOME-DA-EDITORA'] || '', cidade: d['CIDADE-DA-EDITORA'] || '',
              isbn: d['ISBN'] || '', edicao: d['NUMERO-DA-EDICAO-REVISAO'] || '', paginas: d['NUMERO-DE-PAGINAS'] || '',
          }) },
        { tags: ['CAPITULO-DE-LIVRO-PUBLICADO'], typeKey: 'LIVRO_CAPITULO',
          map: (el, b, d) => Object.assign(comuns(b), {
              tipoObra: 'Capítulo de livro', autores: autoresOf(el),
              tituloLivro: d['TITULO-DO-LIVRO'] || '', organizadores: d['ORGANIZADORES'] || '',
              editora: d['NOME-DA-EDITORA'] || '', cidade: d['CIDADE-DA-EDITORA'] || '',
              isbn: d['ISBN'] || '', edicao: d['NUMERO-DA-EDICAO-REVISAO'] || '', paginas: paginas(d),
          }) },
        { tags: ['TEXTO-EM-JORNAL-OU-REVISTA'], typeKey: 'TEXTO_JORNAL',
          map: (el, b, d) => Object.assign(comuns(b), {
              autores: autoresOf(el),
              veiculo: d['TITULO-DO-JORNAL-OU-REVISTA'] || '', data: dateISO(d['DATA-DE-PUBLICACAO']) || d['DATA-DE-PUBLICACAO'] || '',
              volume: d['VOLUME'] || '', paginas: paginas(d), cidade: d['LOCAL-DE-PUBLICACAO'] || '',
          }) },
        { tags: ['TRABALHO-EM-EVENTOS'], typeKey: 'TRABALHO_EVENTO',
          map: (el, b, d) => Object.assign(comuns(b), {
              autores: autoresOf(el), natureza: NAT_TRABALHO[b['NATUREZA']] || humanize(b['NATUREZA']),
              evento: d['NOME-DO-EVENTO'] || '', anais: d['TITULO-DOS-ANAIS-OU-PROCEEDINGS'] || '',
              isbn: d['ISBN'] || '', cidade: d['CIDADE-DO-EVENTO'] || '', paginas: paginas(d),
          }) },
        { tags: ['PARTITURA-MUSICAL'], typeKey: 'PARTITURA',
          map: (el, b, d) => Object.assign(comuns(b), {
              autores: autoresOf(el), natureza: humanize(b['NATUREZA']), formacao: d['FORMACAO-INSTRUMENTAL'] || '', editora: d['EDITORA'] || '',
          }) },
        { tags: ['TRADUCAO'], typeKey: 'TRADUCAO',
          map: (el, b, d) => Object.assign(comuns(b), {
              autores: autoresOf(el), natureza: humanize(b['NATUREZA']), autorOriginal: d['NOME-DO-AUTOR-TRADUZIDO'] || '',
              obraOriginal: d['TITULO-DA-OBRA-ORIGINAL'] || '', idiomaOriginal: d['IDIOMA-DA-OBRA-ORIGINAL'] || '',
              editora: d['EDITORA-DA-TRADUCAO'] || '',
          }) },
        { tags: ['PREFACIO-POSFACIO'], typeKey: 'PREFACIO',
          map: (el, b, d) => Object.assign(comuns(b), {
              autores: autoresOf(el), natureza: humanize(b['TIPO'] || b['NATUREZA']),
              obra: d['TITULO-DA-PUBLICACAO'] || '', editora: d['EDITORA-DO-PREFACIO-POSFACIO'] || '',
          }) },
        { tags: ['OUTRA-PRODUCAO-BIBLIOGRAFICA'], typeKey: 'OUTRA_BIBLIOGRAFICA',
          map: (el, b, d) => Object.assign(comuns(b), {
              autores: autoresOf(el), natureza: b['NATUREZA'] || '', editora: d['EDITORA'] || '',
          }) },

        // ---- Produção técnica ----
        { tags: ['SOFTWARE'],
          typeKey: (el) => (regOf(el).registro ? 'SOFTWARE_REGISTRADO' : 'SOFTWARE_SEM_REGISTRO'),
          map: (el, b, d) => Object.assign(comuns(b), {
              autores: autoresOf(el), plataforma: d['PLATAFORMA'] || d['AMBIENTE'] || '',
              finalidade: d['FINALIDADE'] || '', registro: regOf(el).registro,
          }) },
        { tags: ['PRODUTO-TECNOLOGICO'], typeKey: 'PRODUTO_TECNOLOGICO',
          map: (el, b, d) => Object.assign(comuns(b), {
              autores: autoresOf(el), natureza: humanize(b['TIPO-PRODUTO'] || b['NATUREZA']), finalidade: d['FINALIDADE'] || '',
              cidade: d['CIDADE-DO-PRODUTO'] || '', registro: regOf(el).registro,
          }) },
        { tags: ['PROCESSOS-OU-TECNICAS'], typeKey: 'PROCESSO_TECNICA',
          map: (el, b, d) => Object.assign(comuns(b), {
              autores: autoresOf(el), natureza: humanize(b['NATUREZA']), finalidade: d['FINALIDADE'] || '',
              instituicao: d['INSTITUICAO-FINANCIADORA'] || '', cidade: d['CIDADE-DO-PROCESSO'] || '',
          }) },
        { tags: ['TRABALHO-TECNICO'],
          // Assessoria/consultoria e extensão tecnológica são NATUREZA de trabalho
          // técnico no Lattes → devolvidas aos seus tipos próprios no lattesZen.
          typeKey: (el, b) => {
              const t = window.LattesEnums ? LattesEnums.tok(b['NATUREZA']) : '';
              if (t === 'ASSESSORIA' || t === 'CONSULTORIA') return 'ASSESSORIA_CONSULTORIA';
              if (t === 'EXTENSAO_TECNOLOGICA') return 'EXTENSAO_TECNOLOGICA';
              return 'TRABALHO_TECNICO';
          },
          map: (el, b, d) => Object.assign(comuns(b), {
              autores: autoresOf(el), natureza: humanize(b['NATUREZA']), finalidade: d['FINALIDADE'] || '',
              instituicao: d['INSTITUICAO-FINANCIADORA'] || '', cidade: d['CIDADE-DO-TRABALHO'] || '',
          }) },
        { tags: ['CARTA-MAPA-OU-SIMILAR'], typeKey: 'CARTA_MAPA',
          map: (el, b, d) => Object.assign(comuns(b), {
              autores: autoresOf(el), natureza: humanize(b['NATUREZA']), finalidade: d['FINALIDADE'] || '',
          }) },
        { tags: ['CURSO-DE-CURTA-DURACAO-MINISTRADO'], typeKey: 'CURSO_MINISTRADO',
          map: (el, b, d) => Object.assign(comuns(b), {
              autores: autoresOf(el), nivel: humanize(b['NIVEL-DO-CURSO']),
              instituicao: d['INSTITUICAO-PROMOTORA-DO-CURSO'] || '', cidade: d['CIDADE'] || '', cargaHoraria: d['DURACAO'] || '',
          }) },
        { tags: ['DESENVOLVIMENTO-DE-MATERIAL-DIDATICO-OU-INSTRUCIONAL'], typeKey: 'MATERIAL_DIDATICO',
          map: (el, b, d) => Object.assign(comuns(b), { autores: autoresOf(el), finalidade: d['FINALIDADE'] || '' }) },
        { tags: ['EDITORACAO'], typeKey: 'EDITORACAO',
          map: (el, b, d) => Object.assign(comuns(b), {
              autores: autoresOf(el), natureza: humanize(b['NATUREZA']),
              editora: d['EDITORA'] || '', cidade: d['CIDADE'] || '', paginas: d['NUMERO-DE-PAGINAS'] || '',
          }) },
        { tags: ['MANUTENCAO-DE-OBRA-ARTISTICA'], typeKey: 'MANUTENCAO_OBRA',
          map: (el, b, d) => Object.assign(comuns(b), {
              autores: autoresOf(el), finalidade: d['LOCAL'] || '', cidade: d['CIDADE'] || '',
          }) },
        { tags: ['MAQUETE'], typeKey: 'MAQUETE',
          map: (el, b, d) => Object.assign(comuns(b), { autores: autoresOf(el), finalidade: d['FINALIDADE'] || '' }) },
        { tags: ['PROGRAMA-DE-RADIO-OU-TV'], typeKey: 'MIDIA',
          map: (el, b, d) => Object.assign(comuns(b), {
              autores: autoresOf(el), tipo: humanize(b['NATUREZA']), veiculo: d['EMISSORA'] || '', cidade: d['CIDADE'] || '',
          }) },
        { tags: ['RELATORIO-DE-PESQUISA'], typeKey: 'RELATORIO_PESQUISA',
          map: (el, b, d) => Object.assign(comuns(b), {
              autores: autoresOf(el), instituicao: d['INSTITUICAO-FINANCIADORA'] || '',
          }) },
        { tags: ['MIDIA-SOCIAL-WEBSITE-BLOG'], typeKey: 'MIDIA_SOCIAL',
          map: (el, b, d) => Object.assign(comuns(b), { autores: autoresOf(el), plataforma: d['TEMA'] || '' }) },
        { tags: ['OUTRA-PRODUCAO-TECNICA'], typeKey: 'OUTRA_TECNICA',
          map: (el, b, d) => Object.assign(comuns(b), {
              autores: autoresOf(el), natureza: b['NATUREZA'] || '', finalidade: d['FINALIDADE'] || '',
              instituicao: d['INSTITUICAO-PROMOTORA'] || '', cidade: d['CIDADE'] || '',
          }) },
        { tags: ['APRESENTACAO-DE-TRABALHO'], typeKey: 'APRESENTACAO',
          map: (el, b, d) => Object.assign(comuns(b), {
              autores: autoresOf(el), natureza: humanize(b['NATUREZA']),
              evento: d['NOME-DO-EVENTO'] || '', instituicao: d['INSTITUICAO-PROMOTORA'] || '',
              cidade: d['CIDADE-DA-APRESENTACAO'] || '',
          }) },
        { tags: ['ORGANIZACAO-DE-EVENTO'], typeKey: 'ORGANIZACAO_EVENTO',
          map: (el, b, d) => Object.assign(comuns(b), {
              tipoEvento: humanize(b['TIPO']), instituicao: d['INSTITUICAO-PROMOTORA'] || '', cidade: d['CIDADE'] || '',
          }) },

        // ---- Patentes e registros ----
        { tags: ['PATENTE'], typeKey: 'PATENTE',
          map: (el, b, d) => Object.assign(comuns(b), {
              autores: autoresOf(el), categoria: d['CATEGORIA'] || '', finalidade: d['FINALIDADE'] || '',
              instituicao: d['INSTITUICAO-FINANCIADORA'] || '',
          }, regOf(el)) },
        { tags: ['DESENHO-INDUSTRIAL'], typeKey: 'DESENHO_INDUSTRIAL',
          map: (el, b, d) => Object.assign(comuns(b), {
              autores: autoresOf(el), finalidade: d['FINALIDADE'] || '', instituicao: d['INSTITUICAO-FINANCIADORA'] || '',
          }, regOf(el)) },
        { tags: ['MARCA'], typeKey: 'MARCA',
          map: (el, b, d) => Object.assign(comuns(b), {
              autores: autoresOf(el), natureza: d['NATUREZA'] || '', finalidade: d['FINALIDADE'] || '',
          }, regOf(el)) },
        { tags: ['CULTIVAR-REGISTRADA'], typeKey: 'CULTIVAR_REGISTRADA',
          map: (el, b, d) => Object.assign(comuns(b), {
              titulo: b['DENOMINACAO'] || titleOf(b), autores: autoresOf(el),
              finalidade: d['FINALIDADE'] || '', instituicao: d['INSTITUICAO-FINANCIADORA'] || '',
          }, regOf(el)) },
        { tags: ['CULTIVAR-PROTEGIDA'], typeKey: 'CULTIVAR_PROTEGIDA',
          map: (el, b, d) => Object.assign(comuns(b), {
              titulo: b['DENOMINACAO'] || titleOf(b), autores: autoresOf(el),
              finalidade: d['FINALIDADE'] || '', instituicao: d['INSTITUICAO-FINANCIADORA'] || '',
          }, regOf(el)) },
        { tags: ['TOPOGRAFIA-DE-CIRCUITO-INTEGRADO'], typeKey: 'TOPOGRAFIA_CI',
          map: (el, b, d) => Object.assign(comuns(b), {
              autores: autoresOf(el), finalidade: d['FINALIDADE'] || '', instituicao: d['INSTITUICAO-FINANCIADORA'] || '',
          }, regOf(el)) },

        // ---- Artística/cultural ----
        { tags: ['ARTES-CENICAS'], typeKey: 'ARTES_CENICAS',
          map: (el, b, d) => Object.assign(comuns(b), {
              autores: autoresOf(el), natureza: humanize(b['NATUREZA']),
              evento: d['INSTITUICAO-PROMOTORA-DO-EVENTO'] || '', cidade: d['CIDADE-DO-EVENTO'] || '',
          }) },
        { tags: ['MUSICA'], typeKey: 'MUSICA',
          map: (el, b, d) => Object.assign(comuns(b), {
              autores: autoresOf(el), natureza: humanize(b['NATUREZA']),
              evento: d['INSTITUICAO-PROMOTORA-DO-EVENTO'] || '', cidade: d['CIDADE-DO-EVENTO'] || '',
          }) },
        { tags: ['ARTES-VISUAIS'], typeKey: 'ARTES_VISUAIS',
          map: (el, b, d) => Object.assign(comuns(b), {
              autores: autoresOf(el), natureza: humanize(b['NATUREZA']),
              evento: d['INSTITUICAO-PROMOTORA-DO-EVENTO'] || '', cidade: d['CIDADE-DO-EVENTO'] || '',
          }) },
        { tags: ['OUTRA-PRODUCAO-ARTISTICA-CULTURAL'], typeKey: 'OUTRA_ARTISTICA',
          map: (el, b, d) => Object.assign(comuns(b), {
              autores: autoresOf(el), natureza: b['NATUREZA'] || '', cidade: d['CIDADE'] || '',
          }) },

        // ---- Prêmio ----
        { tags: ['PREMIO-TITULO'], typeKey: 'PREMIO', flat: true,
          map: (el) => {
              const a = attrs(el);
              return { titulo: a['NOME-DO-PREMIO-OU-TITULO'] || '', ano: a['ANO-DA-PREMIACAO'] || '',
                       entidade: a['NOME-DA-ENTIDADE-PROMOTORA'] || '' };
          } },
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
            const ref = `${categoryKey}|${typeKey}|${canon}|${fields.ano || ''}|${fields.anoInicio || ''}|${fields.anoFim || ''}`;
            if (!canon) return;                 // ignora itens sem título
            if (seenRefs.has(ref)) return;      // dedup dentro do próprio XML (mesma categoria)
            snapSelects(typeKey, fields);       // casa enums com as opções do tipo
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
                        const tk = (typeof h.typeKey === 'function') ? h.typeKey(el, b, d) : h.typeKey;
                        add(tk, h.map(el, b, d), el);
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
                let tipo = ctx.tipo;
                if (tag === 'OUTRAS-ORIENTACOES-CONCLUIDAS') tipo = b['TIPO'] || OUTRA_ORIENT_CONCL_TOKEN_TO_TIPO[b['NATUREZA']] || ctx.tipo;
                else if (tag === 'OUTRAS-ORIENTACOES-EM-ANDAMENTO') tipo = b['NATUREZA'] || ctx.tipo;
                const fields = Object.assign({
                    orientando: d['NOME-DO-ORIENTADO'] || d['NOME-DO-ORIENTANDO'] || '',
                    tipo,
                    modalidade: ctx.tipo === 'Mestrado' ? (MODALIDADE_MESTRADO_MAP[b['TIPO']] || '') : '',
                    natureza: ORIENT_TIPO[d['TIPO-DE-ORIENTACAO']] || '',
                    titulo: pick(b, 'TITULO-DO-TRABALHO', 'TITULO'),
                    curso: d['NOME-DO-CURSO'] || d['NOME-CURSO'] || '',
                    instituicao: d['NOME-DA-INSTITUICAO'] || d['NOME-INSTITUICAO'] || '',
                    bolsa: d['NOME-DA-AGENCIA'] || '',
                    pais: b['PAIS'] || '', idioma: b['IDIOMA'] || '', url: urlOf(b),
                    ano: yearOf(b),
                    palavrasChave: palavrasChaveOf(el), outrasInfo: informacoesAdicionaisOf(el),
                }, areaDoConhecimentoOf(el));
                add(tkey, fields, el);
            }
        });

        // 3) Participação em eventos/congressos
        Object.keys(PARTIC_MAP).forEach(tag => {
            for (const el of doc.getElementsByTagName(tag)) {
                const b = groupByPrefix(el, 'DADOS-BASICOS');
                const d = groupByPrefix(el, 'DETALHAMENTO');
                add('PARTICIPACAO_EVENTO', {
                    titulo: d['NOME-DO-EVENTO'] || pick(b, 'TITULO', ...TITLE_KEYS) || '',
                    natureza: PARTIC_MAP[tag],
                    formaParticipacao: humanize(b['FORMA-PARTICIPACAO'] || b['FORMA-DE-PARTICIPACAO'] || ''),
                    tipoParticipacao: humanize(b['TIPO-PARTICIPACAO'] || ''),
                    tituloApresentacao: pick(b, 'TITULO', ...TITLE_KEYS) || '',
                    ano: yearOf(b),
                    pais: b['PAIS'] || '',
                    cidade: d['CIDADE-DO-EVENTO'] || '',
                    divulgacaoCT: simNao(b['FLAG-DIVULGACAO-CIENTIFICA']),
                    url: urlOf(b),
                }, el);
            }
        });

        // 4) Bancas (trabalhos de conclusão + julgadoras)
        Object.keys(BANCA_MAP).forEach(tag => {
            for (const el of doc.getElementsByTagName(tag)) {
                const b = groupByPrefix(el, 'DADOS-BASICOS');
                const d = groupByPrefix(el, 'DETALHAMENTO');
                const julgadora = tag.indexOf('BANCA-JULGADORA') === 0 || tag === 'OUTRAS-BANCAS-JULGADORAS';
                const tipo = tag === 'PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO' ? qualifNatureza(b['NATUREZA']) : BANCA_MAP[tag];
                const fields = Object.assign({
                    tipo,
                    candidato: d['NOME-DO-CANDIDATO'] || '',
                    titulo: pick(b, 'TITULO', ...TITLE_KEYS),
                    curso: d['NOME-CURSO'] || '',
                    instituicao: d['NOME-INSTITUICAO'] || '',
                    membros: membrosBanca(el),
                    ano: yearOf(b),
                    pais: b['PAIS'] || '', idioma: b['IDIOMA'] || '', url: urlOf(b),
                    palavrasChave: palavrasChaveOf(el), outrasInfo: informacoesAdicionaisOf(el),
                }, areaDoConhecimentoOf(el));
                if (!julgadora) fields.modalidade = MODALIDADE_MESTRADO_MAP[b['TIPO']] || '';
                add(julgadora ? 'BANCA_JULGADORA' : 'BANCA_CONCLUSAO', fields, el);
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
                const bolsa = a['NOME-AGENCIA'] || '';
                if (nivel === 'Pós-Doutorado' || nivel === 'Livre-docência') {
                    add('POS_DOUTORADO', {
                        tipo: nivel, instituicao: a['NOME-INSTITUICAO'] || '', anoInicio, anoFim,
                        titulo: tituloTrab, orientador, bolsa,
                    }, el);
                } else {
                    add('FORMACAO_ACADEMICA', {
                        nivel, curso: a['NOME-CURSO'] || a['NOME-DO-CURSO'] || '',
                        instituicao: a['NOME-INSTITUICAO'] || '', anoInicio, anoFim, titulo: tituloTrab, orientador,
                        coorientador: a['NOME-DO-CO-ORIENTADOR'] || '', bolsa,
                    }, el);
                }
            }
        }

        // 5b) Formação complementar (cursos de curta duração, extensão, MBA, outros)
        const formCompl = doc.getElementsByTagName('FORMACAO-COMPLEMENTAR')[0];
        if (formCompl) {
            for (const el of formCompl.children) {
                const a = attrs(el);
                const nome = a['NOME-CURSO'] || a['NOME-DO-CURSO'];
                if (!nome) continue;
                add('FORMACAO_COMPLEMENTAR', {
                    titulo: nome,
                    anoInicio: a['ANO-DE-INICIO'] || '',
                    anoFim: a['ANO-DE-CONCLUSAO'] || '',
                    instituicao: a['NOME-INSTITUICAO'] || '',
                    cargaHoraria: a['CARGA-HORARIA'] || '',
                }, el);
            }
        }

        // 6) Atuação profissional → vínculos
        // FLAG-PERIODO não existe em VINCULOS — infere a "Situação" pela
        // presença de ANO-FIM (mesma regra usada na exportação).
        const situacaoDe = (a) => a['ANO-FIM'] ? 'Anterior (finalizado)' : (a['ANO-INICIO'] ? 'Atual (não finalizado)' : '');
        const situacaoDeFlag = (a) => a['FLAG-PERIODO'] === 'ANTERIOR' ? 'Anterior (finalizado)' : (a['FLAG-PERIODO'] === 'ATUAL' ? 'Atual (não finalizado)' : situacaoDe(a));
        for (const atu of doc.getElementsByTagName('ATUACAO-PROFISSIONAL')) {
            const nomeInst = attrs(atu)['NOME-INSTITUICAO'] || '';
            for (const v of atu.children) {
                if (v.tagName !== 'VINCULOS') continue;
                const a = attrs(v);
                const enumOuVazio = (val) => (val && val !== 'LIVRE') ? humanize(val) : '';
                add('VINCULO_PROFISSIONAL', {
                    instituicao: nomeInst,
                    vinculo: a['OUTRO-VINCULO-INFORMADO'] || enumOuVazio(a['TIPO-DE-VINCULO']),
                    vinculoEmpregaticio: simNao(a['FLAG-VINCULO-EMPREGATICIO']),
                    cargo: a['OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO'] || enumOuVazio(a['ENQUADRAMENTO-FUNCIONAL']),
                    cargaHoraria: a['CARGA-HORARIA-SEMANAL'] || '',
                    dedicacaoExclusiva: simNao(a['FLAG-DEDICACAO-EXCLUSIVA']),
                    anoInicio: a['ANO-INICIO'] || '',
                    situacao: situacaoDe(a),
                    anoFim: a['ANO-FIM'] || '',
                    titulo: a['OUTRAS-INFORMACOES'] || '',
                }, v);
            }
        }

        // 6b) Atuação profissional → atividades (direção, ensino, estágio,
        // serviço, extensão, outra, conselho — subitens de Atuação profissional)
        const ATIV = [
            { tag: 'DIRECAO-E-ADMINISTRACAO', typeKey: 'ATIV_DIRECAO', map: (a) => ({
                titulo: a['CARGO-OU-FUNCAO'] || 'Direção/administração', orgao: a['NOME-ORGAO'] || '',
                anoInicio: a['ANO-INICIO'] || '', situacao: situacaoDeFlag(a), anoFim: a['ANO-FIM'] || '' }) },
            { tag: 'ESTAGIO', typeKey: 'ATIV_ESTAGIO', map: (a) => ({
                titulo: a['ESTAGIO-REALIZADO'] || 'Estágio', orgao: a['NOME-ORGAO'] || '',
                anoInicio: a['ANO-INICIO'] || '', situacao: situacaoDeFlag(a), anoFim: a['ANO-FIM'] || '' }) },
            { tag: 'CONSELHO-COMISSAO-E-CONSULTORIA', typeKey: 'ATIV_CONSELHO', map: (a) => ({
                titulo: a['ESPECIFICACAO'] || 'Conselho/comissão', orgao: a['NOME-ORGAO'] || '',
                anoInicio: a['ANO-INICIO'] || '', situacao: situacaoDeFlag(a), anoFim: a['ANO-FIM'] || '' }) },
            { tag: 'EXTENSAO-UNIVERSITARIA', typeKey: 'ATIV_EXTENSAO', map: (a) => ({
                titulo: a['ATIVIDADE-DE-EXTENSAO-REALIZADA'] || 'Extensão universitária', orgao: a['NOME-ORGAO'] || '',
                anoInicio: a['ANO-INICIO'] || '', situacao: situacaoDeFlag(a), anoFim: a['ANO-FIM'] || '' }) },
            { tag: 'SERVICO-TECNICO-ESPECIALIZADO', typeKey: 'ATIV_SERVICO', map: (a) => ({
                titulo: a['SERVICO-REALIZADO'] || 'Serviço técnico', orgao: a['NOME-ORGAO'] || '',
                anoInicio: a['ANO-INICIO'] || '', situacao: situacaoDeFlag(a), anoFim: a['ANO-FIM'] || '' }) },
            { tag: 'OUTRA-ATIVIDADE-TECNICO-CIENTIFICA', typeKey: 'ATIV_OUTRA', map: (a) => ({
                titulo: a['ATIVIDADE-REALIZADA'] || 'Atividade técnico-científica', orgao: a['NOME-ORGAO'] || '',
                anoInicio: a['ANO-INICIO'] || '', situacao: situacaoDeFlag(a), anoFim: a['ANO-FIM'] || '' }) },
        ];
        const TIPO_ENSINO_HUMANO = {
            GRADUACAO: 'Graduação', 'POS-GRADUACAO': 'Pós-graduação', ESPECIALIZACAO: 'Especialização',
            APERFEICOAMENTO: 'Aperfeiçoamento', 'ENSINO-FUNDAMENTAL': 'Ensino fundamental', 'ENSINO-MEDIO': 'Ensino médio', OUTRO: 'Outros',
        };
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
            // Ensino (Nível + Curso + Disciplinas ministradas)
            for (const el of atu.getElementsByTagName('ENSINO')) {
                const a = attrs(el);
                add('ATIV_ENSINO', {
                    instituicao: nomeInst,
                    nivel: TIPO_ENSINO_HUMANO[a['TIPO-ENSINO']] || '',
                    curso: a['NOME-CURSO'] || '',
                    anoInicio: a['ANO-INICIO'] || '', situacao: situacaoDeFlag(a), anoFim: a['ANO-FIM'] || '',
                    disciplinas: Array.from(el.getElementsByTagName('DISCIPLINA')).map(d => (d.textContent || '').trim()).filter(Boolean).join('; '),
                }, el);
            }
            // Treinamento ministrado (TREINAMENTO-MINISTRADO > TREINAMENTO*)
            for (const el of atu.getElementsByTagName('TREINAMENTO-MINISTRADO')) {
                const a = attrs(el);
                const tags = Array.from(el.getElementsByTagName('TREINAMENTO')).map(d => (d.textContent || '').trim()).filter(Boolean).join('; ');
                if (!tags) continue;
                add('ATIV_TREINAMENTO', {
                    instituicao: nomeInst, orgao: a['NOME-ORGAO'] || '',
                    anoInicio: a['ANO-INICIO'] || '', situacao: situacaoDeFlag(a), anoFim: a['ANO-FIM'] || '',
                    titulo: tags,
                }, el);
            }
            // Pesquisa e desenvolvimento: PESQUISA-E-DESENVOLVIMENTO com período/órgão
            // vira ATIV_PESQUISA; sem período (linhas "soltas") vira LINHA_PESQUISA.
            for (const el of atu.getElementsByTagName('PESQUISA-E-DESENVOLVIMENTO')) {
                const a = attrs(el);
                const linhaEls = Array.from(el.getElementsByTagName('LINHA-DE-PESQUISA'));
                if (a['NOME-ORGAO'] || a['ANO-INICIO'] || a['ANO-FIM'] || a['FLAG-PERIODO']) {
                    const linhas = linhaEls.map(l => (attrs(l)['TITULO-DA-LINHA-DE-PESQUISA'] || '').trim()).filter(Boolean).join('; ');
                    add('ATIV_PESQUISA', {
                        instituicao: nomeInst, orgao: a['NOME-ORGAO'] || '',
                        anoInicio: a['ANO-INICIO'] || '', situacao: situacaoDeFlag(a), anoFim: a['ANO-FIM'] || '',
                        titulo: linhas,
                    }, el);
                } else {
                    for (const l of linhaEls) {
                        const la = attrs(l);
                        add('LINHA_PESQUISA', {
                            titulo: la['TITULO-DA-LINHA-DE-PESQUISA'] || '',
                            instituicao: nomeInst,
                            descricao: la['OBJETIVOS-LINHA-DE-PESQUISA'] || '',
                        }, l);
                    }
                }
            }
        }
        } catch (e) { errors.push('Atividades da atuação: ' + e.message); }

        // 6c) Projetos de pesquisa (PROJETO-DE-PESQUISA, aninhado na atuação)
        const NATUREZA_PROJETO_HUMANO = { DESENVOLVIMENTO: 'Desenvolvimento', EXTENSAO: 'Extensão', PESQUISA: 'Pesquisa', OUTRA: 'Outra' };
        const FINANCIADOR_NATUREZA_HUMANO = {
            BOLSA: 'Bolsa', AUXILIO_FINANCEIRO: 'Auxílio financeiro', REMUNERACAO: 'Remuneração',
            OUTRO: 'Outro', COOPERACAO: 'Cooperação', NAO_INFORMADO: 'Não informado',
        };
        try {
        for (const el of doc.getElementsByTagName('PROJETO-DE-PESQUISA')) {
            const a = attrs(el);
            const equipe = Array.from(el.getElementsByTagName('INTEGRANTES-DO-PROJETO')).map(it => {
                const ia = attrs(it);
                return { nome: ia['NOME-COMPLETO'] || '', coordenador: String(ia['FLAG-RESPONSAVEL'] || '').toUpperCase() === 'SIM' };
            });
            const financiadores = Array.from(el.getElementsByTagName('FINANCIADOR-DO-PROJETO')).map(it => {
                const fa = attrs(it);
                return { nome: fa['NOME-INSTITUICAO'] || '', sigla: '', pais: '', uf: '', codigoProjeto: '', valor: '', natureza: FINANCIADOR_NATUREZA_HUMANO[fa['NATUREZA']] || '' };
            });
            // "Código do projeto" não existe em FINANCIADOR-DO-PROJETO no schema —
            // na exportação usamos IDENTIFICADOR-PROJETO (1 por projeto) como o
            // código do 1º financiador; na importação devolve para lá.
            if (financiadores[0] && a['IDENTIFICADOR-PROJETO']) financiadores[0].codigoProjeto = a['IDENTIFICADOR-PROJETO'];
            const producoesCT = Array.from(el.getElementsByTagName('PRODUCAO-CT-DO-PROJETO')).map(it => {
                const pa = attrs(it);
                return { titulo: pa['TITULO-DA-PRODUCAO-CT'] || '', ano: '', tipo: pa['TIPO-PRODUCAO-CT'] || '' };
            });
            const orientacoesProjeto = Array.from(el.getElementsByTagName('ORIENTACAO')).map(it => {
                const oa = attrs(it);
                return { titulo: oa['TITULO-ORIENTACAO'] || '', ano: '', tipo: oa['TIPO-ORIENTACAO'] || '' };
            });
            const NAT2TIPO = { PESQUISA: 'PROJETO_PESQUISA', DESENVOLVIMENTO: 'PROJETO_DESENVOLVIMENTO', EXTENSAO: 'PROJETO_EXTENSAO', ENSINO: 'PROJETO_ENSINO', OUTRA: 'PROJETO_OUTRO' };
            const projTipo = NAT2TIPO[window.LattesEnums ? LattesEnums.tok(a['NATUREZA']) : ''] || 'PROJETO_PESQUISA';
            add(projTipo, {
                titulo: a['NOME-DO-PROJETO'] || '',
                descricao: a['DESCRICAO-DO-PROJETO'] || '',
                natureza: NATUREZA_PROJETO_HUMANO[a['NATUREZA']] || humanize(a['NATUREZA']),
                situacao: PROJ_SITUACAO[a['SITUACAO']] || humanize(a['SITUACAO']),
                anoInicio: a['ANO-INICIO'] || '', anoFim: a['ANO-FIM'] || '',
                potencialInovacao: simNao(a['FLAG-POTENCIAL-INOVACAO']),
                equipe, financiadores, producoesCT, orientacoesProjeto,
                qtdGraduacao: a['NUMERO-GRADUACAO'] || '', qtdEspecializacao: a['NUMERO-ESPECIALIZACAO'] || '',
                qtdMestradoAcademico: a['NUMERO-MESTRADO-ACADEMICO'] || '', qtdMestradoProfissional: a['NUMERO-MESTRADO-PROF'] || '',
                qtdDoutorado: a['NUMERO-DOUTORADO'] || '', qtdTecnicoNivelMedio: a['NUMERO_TECNICO_NIVEL_MEDIO'] || '',
            }, el);
        }
        } catch (e) { errors.push('Projetos: ' + e.message); }

        // 7) Dados gerais: identificação, endereço, idiomas, áreas, resumo, licenças…
        try {
        const clean = (s) => String(s || '').replace(/&#1[03];/g, m => m === '&#10;' ? '\n' : '').trim();
        const dgEl = doc.getElementsByTagName('DADOS-GERAIS')[0];
        if (dgEl) {
            const g = attrs(dgEl);
            if (g['NOME-COMPLETO']) {
                add('IDENTIFICACAO', {
                    titulo: g['NOME-COMPLETO'], citacoes: g['NOME-EM-CITACOES-BIBLIOGRAFICAS'] || '',
                    sexo: /^F/i.test(g['SEXO'] || '') ? 'Feminino' : (g['SEXO'] ? 'Masculino' : ''),
                    nacionalidade: g['NACIONALIDADE'] || '', pais: g['PAIS-DE-NASCIMENTO'] || '',
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
        // Áreas de atuação
        for (const el of doc.getElementsByTagName('AREA-DE-ATUACAO')) {
            const a = attrs(el);
            const titulo = a['NOME-DA-ESPECIALIDADE'] || a['NOME-DA-SUB-AREA-DO-CONHECIMENTO'] || a['NOME-DA-AREA-DO-CONHECIMENTO'] || humanize(a['NOME-GRANDE-AREA-DO-CONHECIMENTO']);
            if (!titulo) continue;
            add('AREA_ATUACAO', {
                grandeArea: humanize(a['NOME-GRANDE-AREA-DO-CONHECIMENTO']),
                area: a['NOME-DA-AREA-DO-CONHECIMENTO'] || '',
                subarea: a['NOME-DA-SUB-AREA-DO-CONHECIMENTO'] || '', especialidade: a['NOME-DA-ESPECIALIDADE'] || '',
                areaConhecimento: [humanize(a['NOME-GRANDE-AREA-DO-CONHECIMENTO']), a['NOME-DA-AREA-DO-CONHECIMENTO'], a['NOME-DA-SUB-AREA-DO-CONHECIMENTO'], a['NOME-DA-ESPECIALIDADE']].map(x => (x || '').trim()).filter(Boolean).join(' > '), // separador ASCII (compatível com ISO-8859-1)
                titulo,
            }, el);
        }
        // Licenças (apenas MATERNIDADE é enumerado no schema)
        for (const el of doc.getElementsByTagName('LICENCA')) {
            const a = attrs(el);
            const tipo = /matern/i.test(a['TIPO-LICENCA'] || '') ? 'Maternidade' : humanize(a['TIPO-LICENCA']);
            add('LICENCA', {
                titulo: 'Licença' + (tipo ? ' ' + tipo : ''), tipo,
                dataInicio: dateISO(a['DATA-INICIO-LICENCA']), dataFim: dateISO(a['DATA-FIM-LICENCA']),
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
