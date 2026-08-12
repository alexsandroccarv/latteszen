/* ==========================================================================
   lattesZen — Exportador do XML do Currículo Lattes
   --------------------------------------------------------------------------
   window.LattesXMLExport.build(items, settings) -> string XML (Unicode).
   O documento segue FIELMENTE o schema oficial docs/CurriculoLattes.xsd
   (raiz CURRICULO-VITAE). A serialização final em ISO-8859-1 é feita pela
   camada LzEncoding (xmlBlobLatin1 / encodeLatin1Xml).

   Princípios de conformidade:
   - Só emitimos seções/agrupadores que tenham conteúdo (todos são
     minOccurs=0, exceto DADOS-GERAIS).
   - A ORDEM dos elementos-filhos respeita a sequência do XSD.
   - Atributos obrigatórios (use="required") são sempre preenchidos:
     CURRICULO-VITAE/@SISTEMA-ORIGEM-XML e
     DADOS-GERAIS/@{NOME-COMPLETO, NOME-EM-CITACOES-BIBLIOGRAFICAS,
     NACIONALIDADE, PERMISSAO-DE-DIVULGACAO}.
   - Atributos com enumeração só recebem tokens válidos; quando não há
     mapeamento seguro, o atributo é OMITIDO (todos são opcionais).
   - Texto livre é escapado; caracteres fora do Latin-1 viram entidades na
     etapa de codificação.
   ========================================================================== */
window.LattesXMLExport = (function () {

    // A Plataforma Lattes só importa XML de origens reconhecidas. "LATTES_OFFLINE"
    // é a origem do próprio fluxo de importação offline do CNPq (a mesma do XML
    // real da plataforma) — origens não reconhecidas (ex.: "LATTESZEN") são
    // rejeitadas na importação, mesmo com XML estruturalmente válido.
    const SISTEMA_ORIGEM = 'LATTES_OFFLINE';
    // dd/mm/aaaa e hh/mm/ss atuais no formato do Lattes (DDMMAAAA / HHMMSS)
    function pad(n) { return String(n).padStart(2, '0'); }
    function agoraData(d) { return pad(d.getDate()) + pad(d.getMonth() + 1) + d.getFullYear(); }
    function agoraHora(d) { return pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()); }

    /* ------------------------------ helpers ------------------------------ */
    function esc(s) {
        if (window.LzEncoding && LzEncoding.xmlEscape) return LzEncoding.xmlEscape(s);
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    }
    const clean = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();

    // Serializa atributos, omitindo vazios/nulos. Preserva a ordem de inserção.
    function attrStr(attrs) {
        let s = '';
        if (!attrs) return s;
        for (const k in attrs) {
            const t = clean(attrs[k]);
            if (t === '') continue;
            s += ` ${k}="${esc(t)}"`;
        }
        return s;
    }
    // Elemento. children: string | array de strings. Vazio → self-closing.
    function el(tag, attrs, children) {
        let inner = Array.isArray(children) ? children.filter(Boolean).join('') : (children || '');
        const a = attrStr(attrs);
        return inner === '' ? `<${tag}${a}/>` : `<${tag}${a}>${inner}</${tag}>`;
    }
    // Agrupador (wrapper): só emite se houver conteúdo.
    function wrap(tag, children) {
        const inner = Array.isArray(children) ? children.filter(Boolean).join('') : (children || '');
        return inner === '' ? '' : `<${tag}>${inner}</${tag}>`;
    }

    const year = (v) => { const m = String(v == null ? '' : v).match(/\d{4}/); return m ? m[0] : ''; };
    // Converte 'AAAA-MM-DD' ou 'DD/MM/AAAA' em DDMMAAAA; senão ''.
    function ddmmaaaa(v) {
        const s = clean(v);
        let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) return m[3] + m[2] + m[1];
        m = s.match(/^(\d{2})[/](\d{2})[/](\d{4})$/);
        if (m) return m[1] + m[2] + m[3];
        return '';
    }
    // status do curso a partir do ano de conclusão
    const statusCurso = (fim) => (year(fim) ? 'CONCLUIDO' : 'EM_ANDAMENTO');

    // AUTORES* a partir de "Sobrenome, N.; Outro, X."
    function autoresEls(str) {
        const nomes = String(str == null ? '' : str).split(';').map(clean).filter(Boolean);
        return nomes.map((n, i) => el('AUTORES', {
            'NOME-COMPLETO-DO-AUTOR': n, 'NOME-PARA-CITACAO': n, 'ORDEM-DE-AUTORIA': String(i + 1),
        })).join('');
    }
    // PARTICIPANTE-BANCA* a partir de "Fulano; Beltrano"
    function participantesBanca(str) {
        const nomes = String(str == null ? '' : str).split(';').map(clean).filter(Boolean);
        return nomes.map((n, i) => el('PARTICIPANTE-BANCA', {
            'NOME-COMPLETO-DO-PARTICIPANTE-DA-BANCA': n,
            'NOME-PARA-CITACAO-DO-PARTICIPANTE-DA-BANCA': n,
            'ORDEM-PARTICIPANTE': String(i + 1),
        })).join('');
    }
    // páginas "100-115" → {ini, fim}
    function paginas(v) {
        const s = clean(v); const m = s.match(/(\d+)\s*[-–a]\s*(\d+)/);
        if (m) return { ini: m[1], fim: m[2] };
        return { ini: s.replace(/[^\d]/g, ''), fim: '' };
    }

    /* ---- Enums do XSD: emitir apenas tokens válidos (senão omite) ---- */
    const ENUMS = {
        'DADOS-BASICOS-DO-TRABALHO|NATUREZA': ['COMPLETO', 'RESUMO', 'RESUMO_EXPANDIDO', 'NAO_INFORMADO'],
        'DADOS-BASICOS-DO-LIVRO|TIPO': ['LIVRO_PUBLICADO', 'LIVRO_ORGANIZADO_OU_EDICAO', 'NAO_INFORMADO'],
        'DADOS-BASICOS-DA-APRESENTACAO-DE-TRABALHO|NATUREZA': ['COMUNICACAO', 'CONFERENCIA', 'CONGRESSO', 'SEMINARIO', 'SIMPOSIO', 'OUTRA', 'NAO_INFORMADO'],
        'DADOS-BASICOS-DE-CURSOS-CURTA-DURACAO-MINISTRADO|NIVEL-DO-CURSO': ['EXTENSAO', 'APERFEICOAMENTO', 'ESPECIALIZACAO', 'OUTRA', 'NAO_INFORMADO'],
        'DADOS-BASICOS-DO-TRABALHO-TECNICO|NATUREZA': ['ASSESSORIA', 'CONSULTORIA', 'PARECER', 'ELABORACAO_DE_PROJETO', 'RELATORIO_TECNICO', 'SERVICOS_NA_AREA_DA_SAUDE', 'OUTRA', 'NAO_INFORMADO'],
        'DADOS-BASICOS-DO-PRODUTO-TECNOLOGICO|TIPO-PRODUTO': ['PILOTO', 'PROJETO', 'PROTOTIPO', 'OUTRO', 'NAO_INFORMADO'],
        'DADOS-BASICOS-DO-PROCESSOS-OU-TECNICAS|NATUREZA': ['ANALITICA', 'INSTRUMENTAL', 'PEDAGOGICA', 'PROCESSUAL', 'TERAPEUTICA', 'OUTRA', 'NAO_INFORMADO'],
        'DADOS-BASICOS-DA-PARTITURA|NATUREZA': ['CANTO', 'CORAL', 'ORQUESTRA', 'OUTRO', 'NAO_INFORMADO'],
        'DADOS-BASICOS-DO-PREFACIO-POSFACIO|TIPO': ['PREFACIO', 'POSFACIO', 'APRESENTACAO', 'INTRODUCAO'],
        'DADOS-BASICOS-DA-TRADUCAO|NATUREZA': ['ARTIGO', 'LIVRO', 'OUTRO', 'NAO_INFORMADO'],
        'DADOS-BASICOS-DE-EDITORACAO|NATUREZA': ['LIVRO', 'ANAIS', 'CATALOGO', 'COLETANEA', 'ENCICLOPEDIA', 'PERIODICO', 'OUTRA', 'NAO_INFORMADO'],
        'DADOS-BASICOS-DE-CARTA-MAPA-OU-SIMILAR|NATUREZA': ['AEROFOTOGRAMA', 'CARTA', 'FOTOGRAMA', 'MAPA', 'OUTRA', 'NAO_INFORMADO'],
        'DADOS-BASICOS-DA-ORGANIZACAO-DE-EVENTO|TIPO': ['CONCERTO', 'CONCURSO', 'CONGRESSO', 'EXPOSICAO', 'FESTIVAL', 'FEIRA', 'OLIMPIADA', 'OUTRO', 'NAO_INFORMADO'],
        'DADOS-BASICOS-DO-PROGRAMA-DE-RADIO-OU-TV|NATUREZA': ['ENTREVISTA', 'MESA_REDONDA', 'COMENTARIO', 'PROGRAMA', 'OUTRA', 'NAO_INFORMADO'],
        'DADOS-BASICOS-DA-MIDIA-SOCIAL-WEBSITE-BLOG|NATUREZA': ['REDE_SOCIAL', 'FORUM', 'BLOG', 'SITE'],
        'DADOS-BASICOS-DE-ARTES-CENICAS|NATUREZA': ['AUDIOVISUAL', 'CIRCENSE', 'COREOGRAFICA', 'DIVERSAS', 'OPERISTICA', 'PERFORMATICA', 'RADIALISTICA', 'TEATRAL', 'OUTRA'],
        'DADOS-BASICOS-DE-ARTES-VISUAIS|NATUREZA': ['INTERVENCAO_URBANA', 'LIVRO_DE_ARTISTA', 'PERFORMANCE', 'PINTURA', 'PROGRAMACAO_VISUAL', 'VIDEO', 'WEBART', 'ANIMACAO', 'INSTALACAO', 'COMPUTACAO_GRAFICA', 'DESENHO', 'DIVERSAS', 'ESCULTURA', 'FILME', 'FOTOGRAFIA', 'GRAVURA', 'ILUSTRACAO', 'OUTRA'],
        'DADOS-BASICOS-DA-MUSICA|NATUREZA': ['APRESENTACAO_DE_OBRA', 'ARRANJO', 'AUDIOVISUAL', 'COMPOSICAO', 'DIVERSAS', 'INTERPRETACAO', 'PUBLICACAO_DE_PARTITURA', 'REGISTRO_FONOGRAFICO', 'TRILHA_SONORA', 'OUTRA'],
    };
    Object.keys(ENUMS).forEach(k => { ENUMS[k] = new Set(ENUMS[k]); });
    // Token válido do enum p/ (elemento, atributo); '' se não corresponder (omite).
    function tok(elem, attr, value) {
        const set = ENUMS[elem + '|' + attr];
        const t = (window.LattesEnums ? LattesEnums.token(value) : String(value || '').toUpperCase());
        return (set && set.has(t)) ? t : '';
    }
    const NAT_TRABALHO = { 'Completo': 'COMPLETO', 'Resumo': 'RESUMO', 'Resumo expandido': 'RESUMO_EXPANDIDO' };
    const GRANDE_AREA = {
        'CIENCIAS EXATAS E DA TERRA': 'CIENCIAS_EXATAS_E_DA_TERRA',
        'CIENCIAS BIOLOGICAS': 'CIENCIAS_BIOLOGICAS',
        'ENGENHARIAS': 'ENGENHARIAS',
        'CIENCIAS DA SAUDE': 'CIENCIAS_DA_SAUDE',
        'CIENCIAS AGRARIAS': 'CIENCIAS_AGRARIAS',
        'CIENCIAS SOCIAIS APLICADAS': 'CIENCIAS_SOCIAIS_APLICADAS',
        'CIENCIAS HUMANAS': 'CIENCIAS_HUMANAS',
        'LINGUISTICA LETRAS E ARTES': 'LINGUISTICA_LETRAS_E_ARTES',
    };
    function grandeAreaToken(s) {
        const norm = String(s == null ? '' : s).toUpperCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')  // remove acentos
            .replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
        return GRANDE_AREA[norm] || '';
    }
    // TIPO-DE-ORIENTACAO é enumerado {ORIENTADOR_PRINCIPAL, CO_ORIENTADOR}
    const orientTipo = (v) => (/co/i.test(String(v == null ? '' : v)) ? 'CO_ORIENTADOR' : 'ORIENTADOR_PRINCIPAL');
    const PROF = { 'bom': 'BEM', 'razoavel': 'RAZOAVELMENTE', 'pouco': 'POUCO' };
    function proficiencia(v) {
        const n = String(v == null ? '' : v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
        return PROF[n] || '';
    }

    /* ---------------------- construtores por seção ----------------------- */
    // Helper de produção padrão: SEQUENCIA-PRODUCAO + DADOS-BASICOS + DETALHAMENTO + AUTORES*
    function producao(leafTag, seq, dbTag, dbAttrs, detTag, detAttrs, autoresStr, detChildren) {
        const db = el(dbTag, dbAttrs);
        const det = el(detTag, detAttrs, detChildren || '');
        return el(leafTag, { 'SEQUENCIA-PRODUCAO': String(seq) }, [db, det, autoresEls(autoresStr)].join(''));
    }

    /* ============================ 01 DADOS-GERAIS ======================== */
    function buildDadosGerais(byType, all) {
        const ident = (byType('IDENTIFICACAO')[0] || { fields: {} }).fields;
        const nome = clean(ident.titulo) || 'Currículo';
        const citacoes = clean(ident.citacoes) || nome;
        const nacionalidade = clean(ident.nacionalidade) || 'Brasileira';

        // SEXO é #REQUIRED no formato de importação do Lattes (MASCULINO|FEMININO).
        const sexo = (clean(ident.sexo).toUpperCase().indexOf('F') === 0) ? 'FEMININO' : 'MASCULINO';
        const dgAttrs = {
            'NOME-COMPLETO': nome,
            'NOME-EM-CITACOES-BIBLIOGRAFICAS': citacoes,
            'NACIONALIDADE': nacionalidade,
            'SEXO': sexo,
            'PAIS-DE-NASCIMENTO': clean(ident.pais),
            'PERMISSAO-DE-DIVULGACAO': 'NAO',
            'ORCID-ID': clean(ident.orcid),
        };

        const children = [];
        // RESUMO-CV
        const resumo = (byType('RESUMO_CV')[0] || {}).fields;
        if (resumo && clean(resumo.descricao)) children.push(el('RESUMO-CV', { 'TEXTO-RESUMO-CV-RH': resumo.descricao }));
        // OUTRAS-INFORMACOES-RELEVANTES
        const outras = (byType('OUTRAS_INFO')[0] || {}).fields;
        if (outras && clean(outras.descricao)) children.push(el('OUTRAS-INFORMACOES-RELEVANTES', { 'OUTRAS-INFORMACOES-RELEVANTES': outras.descricao }));
        // ENDERECO
        const end = (byType('ENDERECO')[0] || {}).fields;
        if (end && (clean(end.titulo) || clean(end.cidade))) {
            const prof = el('ENDERECO-PROFISSIONAL', {
                'LOGRADOURO-COMPLEMENTO': end.titulo, 'CIDADE': end.cidade, 'UF': end.uf, 'CEP': end.cep,
            });
            children.push(el('ENDERECO', {}, prof));
        }
        // FORMACAO-ACADEMICA-TITULACAO
        const form = buildFormacao(byType);
        if (form) children.push(form);
        // ATUACOES-PROFISSIONAIS
        const atu = buildAtuacoes(all);
        if (atu) children.push(atu);
        // AREAS-DE-ATUACAO
        const areas = byType('AREA_ATUACAO').map((it, i) => {
            const f = it.fields;
            return el('AREA-DE-ATUACAO', {
                'SEQUENCIA-AREA-DE-ATUACAO': String(i + 1),
                'NOME-GRANDE-AREA-DO-CONHECIMENTO': grandeAreaToken(f.grandeArea),
                'NOME-DA-AREA-DO-CONHECIMENTO': f.area,
                'NOME-DA-SUB-AREA-DO-CONHECIMENTO': f.subarea,
                'NOME-DA-ESPECIALIDADE': f.especialidade,
            });
        }).join('');
        if (areas) children.push(wrap('AREAS-DE-ATUACAO', areas));
        // IDIOMAS
        const idiomas = byType('IDIOMAS').map(it => {
            const f = it.fields; const hab = {};
            // habilidades vem como "Leitura: Bom; Fala: Razoável; ..."
            String(f.habilidades || '').split(';').forEach(par => {
                const m = par.split(':'); if (m.length < 2) return;
                const k = clean(m[0]).toLowerCase(); const v = proficiencia(m[1]);
                if (k.indexOf('leitura') === 0) hab.leitura = v;
                else if (k.indexOf('fala') === 0) hab.fala = v;
                else if (k.indexOf('escrita') === 0) hab.escrita = v;
                else if (k.indexOf('compreens') === 0) hab.compreensao = v;
            });
            return el('IDIOMA', {
                'DESCRICAO-DO-IDIOMA': f.titulo,
                'PROFICIENCIA-DE-LEITURA': hab.leitura, 'PROFICIENCIA-DE-FALA': hab.fala,
                'PROFICIENCIA-DE-ESCRITA': hab.escrita, 'PROFICIENCIA-DE-COMPREENSAO': hab.compreensao,
            });
        }).join('');
        if (idiomas) children.push(wrap('IDIOMAS', idiomas));
        // PREMIOS-TITULOS
        const premios = byType('PREMIO').map(it => {
            const f = it.fields;
            return el('PREMIO-TITULO', {
                'NOME-DO-PREMIO-OU-TITULO': f.titulo, 'NOME-DA-ENTIDADE-PROMOTORA': f.entidade, 'ANO-DA-PREMIACAO': year(f.ano),
            });
        }).join('');
        if (premios) children.push(wrap('PREMIOS-TITULOS', premios));
        // Obs.: LICENCA não existe no formato de importação do Lattes (nem no DTD
        // nem no XML real da plataforma) — fica catalogável só localmente.

        return el('DADOS-GERAIS', dgAttrs, children.join(''));
    }

    // FORMACAO-ACADEMICA-TITULACAO — agrupa por nível, na ordem do XSD.
    function buildFormacao(byType) {
        const fa = byType('FORMACAO_ACADEMICA');
        const pd = byType('POS_DOUTORADO');
        const buckets = {
            GRADUACAO: [], ESPECIALIZACAO: [], MESTRADO: [], DOUTORADO: [],
            'POS-DOUTORADO': [], 'LIVRE-DOCENCIA': [], 'CURSO-TECNICO-PROFISSIONALIZANTE': [],
            'ENSINO-FUNDAMENTAL-PRIMEIRO-GRAU': [], 'ENSINO-MEDIO-SEGUNDO-GRAU': [],
            'RESIDENCIA-MEDICA': [], APERFEICOAMENTO: [],
        };
        const NIVEL_EL = {
            'Graduação': 'GRADUACAO', 'Especialização': 'ESPECIALIZACAO', 'Aperfeiçoamento': 'APERFEICOAMENTO',
            'Mestrado': 'MESTRADO', 'Doutorado': 'DOUTORADO', 'Residência médica': 'RESIDENCIA-MEDICA',
            'Curso técnico': 'CURSO-TECNICO-PROFISSIONALIZANTE',
            'Ensino fundamental': 'ENSINO-FUNDAMENTAL-PRIMEIRO-GRAU', 'Ensino médio': 'ENSINO-MEDIO-SEGUNDO-GRAU',
        };
        fa.forEach((it, i) => {
            const f = it.fields; const elname = NIVEL_EL[f.nivel] || 'GRADUACAO';
            // Atributos comuns a todos os níveis
            const base = {
                'SEQUENCIA-FORMACAO': String(i + 1), 'NIVEL': (f.nivel || '').toUpperCase(),
                'NOME-INSTITUICAO': f.instituicao, 'STATUS-DO-CURSO': statusCurso(f.anoFim),
                'ANO-DE-INICIO': year(f.anoInicio), 'ANO-DE-CONCLUSAO': year(f.anoFim),
            };
            // Ensino fundamental/médio não têm NOME-CURSO nem agência/título.
            if (elname === 'GRADUACAO') { base['NOME-CURSO'] = f.curso; base['NOME-AGENCIA'] = f.bolsa; base['TITULO-DO-TRABALHO-DE-CONCLUSAO-DE-CURSO'] = f.titulo; base['NOME-DO-ORIENTADOR'] = f.orientador; }
            else if (elname === 'ESPECIALIZACAO' || elname === 'APERFEICOAMENTO') { base['NOME-CURSO'] = f.curso; base['NOME-AGENCIA'] = f.bolsa; base['TITULO-DA-MONOGRAFIA'] = f.titulo; base['NOME-DO-ORIENTADOR'] = f.orientador; }
            else if (elname === 'MESTRADO' || elname === 'DOUTORADO') { base['NOME-CURSO'] = f.curso; base['NOME-AGENCIA'] = f.bolsa; base['ANO-DE-OBTENCAO-DO-TITULO'] = year(f.anoFim); base['TITULO-DA-DISSERTACAO-TESE'] = f.titulo; base['NOME-COMPLETO-DO-ORIENTADOR'] = f.orientador; base['NOME-DO-CO-ORIENTADOR'] = f.coorientador; }
            else if (elname === 'CURSO-TECNICO-PROFISSIONALIZANTE') { base['NOME-CURSO'] = f.curso; base['NOME-AGENCIA'] = f.bolsa; }
            else if (elname === 'RESIDENCIA-MEDICA') { base['NOME-AGENCIA'] = f.bolsa; base['TITULO-DA-RESIDENCIA-MEDICA'] = f.titulo; }
            buckets[elname].push(el(elname, base));
        });
        pd.forEach((it, i) => {
            const f = it.fields;
            if (/livre/i.test(f.tipo || '')) {
                buckets['LIVRE-DOCENCIA'].push(el('LIVRE-DOCENCIA', {
                    'SEQUENCIA-FORMACAO': String(i + 1), 'NIVEL': 'LIVRE-DOCENCIA', 'NOME-INSTITUICAO': f.instituicao,
                    'ANO-DE-OBTENCAO-DO-TITULO': year(f.anoFim), 'TITULO-DO-TRABALHO': f.titulo,
                }));
            } else {
                buckets['POS-DOUTORADO'].push(el('POS-DOUTORADO', {
                    'SEQUENCIA-FORMACAO': String(i + 1), 'NIVEL': 'POS-DOUTORADO', 'NOME-INSTITUICAO': f.instituicao,
                    'ANO-DE-INICIO': year(f.anoInicio), 'ANO-DE-CONCLUSAO': year(f.anoFim),
                    'TITULO-DO-TRABALHO': f.titulo, 'NOME-AGENCIA': f.bolsa,
                }));
            }
        });
        const order = ['GRADUACAO', 'ESPECIALIZACAO', 'MESTRADO', 'DOUTORADO', 'POS-DOUTORADO', 'LIVRE-DOCENCIA',
            'CURSO-TECNICO-PROFISSIONALIZANTE', 'ENSINO-FUNDAMENTAL-PRIMEIRO-GRAU', 'ENSINO-MEDIO-SEGUNDO-GRAU',
            'RESIDENCIA-MEDICA', 'APERFEICOAMENTO'];
        const inner = order.map(k => buckets[k].join('')).join('');
        return inner ? el('FORMACAO-ACADEMICA-TITULACAO', {}, inner) : '';
    }

    // ATUACOES-PROFISSIONAIS — agrupa vínculos e atividades por instituição.
    function buildAtuacoes(all) {
        const vincs = all.filter(i => i.typeKey === 'VINCULO_PROFISSIONAL');
        const ATIV = {
            ATIV_DIRECAO: { wrap: 'ATIVIDADES-DE-DIRECAO-E-ADMINISTRACAO', leaf: 'DIRECAO-E-ADMINISTRACAO', extra: (f) => ({ 'CARGO-OU-FUNCAO': f.titulo, 'NOME-ORGAO': f.orgao }) },
            ATIV_CONSELHO: { wrap: 'ATIVIDADES-DE-CONSELHO-COMISSAO-E-CONSULTORIA', leaf: 'CONSELHO-COMISSAO-E-CONSULTORIA', extra: (f) => ({ 'ESPECIFICACAO': f.papel, 'NOME-ORGAO': f.titulo || f.orgao }) },
            ATIV_EXTENSAO: { wrap: 'ATIVIDADES-DE-EXTENSAO-UNIVERSITARIA', leaf: 'EXTENSAO-UNIVERSITARIA', extra: (f) => ({ 'ATIVIDADE-DE-EXTENSAO-REALIZADA': f.titulo, 'NOME-ORGAO': f.orgao }) },
            ATIV_SERVICO: { wrap: 'ATIVIDADES-DE-SERVICO-TECNICO-ESPECIALIZADO', leaf: 'SERVICO-TECNICO-ESPECIALIZADO', extra: (f) => ({ 'SERVICO-REALIZADO': f.titulo, 'NOME-ORGAO': f.orgao }) },
            ATIV_OUTRA: { wrap: 'OUTRAS-ATIVIDADES-TECNICO-CIENTIFICA', leaf: 'OUTRA-ATIVIDADE-TECNICO-CIENTIFICA', extra: (f) => ({ 'ATIVIDADE-REALIZADA': f.titulo, 'NOME-ORGAO': f.orgao }) },
        };
        const ensino = all.filter(i => i.typeKey === 'ATIV_ENSINO');
        const linhas = all.filter(i => i.typeKey === 'LINHA_PESQUISA');
        // NATUREZA do projeto: enum do Lattes = (DESENVOLVIMENTO|EXTENSAO|PESQUISA|OUTRA).
        // "Ensino" não existe no enum → mapeia para OUTRA.
        const NAT_PROJ = { PROJETO_PESQUISA: 'PESQUISA', PROJETO_DESENVOLVIMENTO: 'DESENVOLVIMENTO', PROJETO_EXTENSAO: 'EXTENSAO', PROJETO_ENSINO: 'OUTRA', PROJETO_OUTRO: 'OUTRA' };
        const projetos = all.filter(i => NAT_PROJ[i.typeKey]);

        // agrupa por instituição
        const instMap = new Map();
        const getInst = (nome) => { const k = nome || '(sem instituição)'; if (!instMap.has(k)) instMap.set(k, { nome, vincs: [], ensino: [], linhas: [], ativ: {} }); return instMap.get(k); };
        vincs.forEach(it => getInst(it.fields.instituicao).vincs.push(it));
        ensino.forEach(it => getInst(it.fields.instituicao).ensino.push(it));
        linhas.forEach(it => getInst(it.fields.instituicao).linhas.push(it));
        all.forEach(it => { if (ATIV[it.typeKey]) { const g = getInst(it.fields.instituicao); (g.ativ[it.typeKey] = g.ativ[it.typeKey] || []).push(it); } });

        const blocos = [];
        for (const g of instMap.values()) {
            const seq = [];
            // 1) VINCULOS*
            g.vincs.forEach(it => {
                const f = it.fields;
                const de = /exclusiv/i.test(f.regime || '') ? 'SIM' : '';
                seq.push(el('VINCULOS', {
                    'TIPO-DE-VINCULO': 'LIVRE', 'ENQUADRAMENTO-FUNCIONAL': 'LIVRE',
                    'OUTRO-VINCULO-INFORMADO': f.vinculo, 'OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO': f.cargo,
                    'CARGA-HORARIA-SEMANAL': f.cargaHoraria, 'FLAG-DEDICACAO-EXCLUSIVA': de,
                    'ANO-INICIO': year(f.anoInicio), 'ANO-FIM': year(f.anoFim), 'OUTRAS-INFORMACOES': f.titulo,
                }));
            });
            // 2) ATIVIDADES-DE-DIRECAO-E-ADMINISTRACAO (na ordem do XSD)
            (g.ativ.ATIV_DIRECAO || []).length && seq.push(wrap('ATIVIDADES-DE-DIRECAO-E-ADMINISTRACAO',
                g.ativ.ATIV_DIRECAO.map(it => el('DIRECAO-E-ADMINISTRACAO', Object.assign({ 'ANO-INICIO': year(it.fields.anoInicio), 'ANO-FIM': year(it.fields.anoFim) }, ATIV.ATIV_DIRECAO.extra(it.fields)))).join('')));
            // 2b) ATIVIDADES-DE-PESQUISA-E-DESENVOLVIMENTO (linhas de pesquisa)
            g.linhas.length && seq.push(wrap('ATIVIDADES-DE-PESQUISA-E-DESENVOLVIMENTO',
                el('PESQUISA-E-DESENVOLVIMENTO', {}, g.linhas.map(it => el('LINHA-DE-PESQUISA', {
                    'TITULO-DA-LINHA-DE-PESQUISA': it.fields.titulo, 'OBJETIVOS-LINHA-DE-PESQUISA': it.fields.descricao,
                })).join(''))));
            // 3) ATIVIDADES-DE-ENSINO
            g.ensino.length && seq.push(wrap('ATIVIDADES-DE-ENSINO', g.ensino.map(it => {
                const f = it.fields;
                const disc = String(f.disciplinas || '').split(';').map(clean).filter(Boolean).map(d => el('DISCIPLINA', {}, esc(d))).join('');
                return el('ENSINO', { 'ANO-INICIO': year(f.anoInicio), 'ANO-FIM': year(f.anoFim), 'NOME-CURSO': f.titulo }, disc);
            }).join('')));
            // 4) ATIVIDADES-DE-SERVICO-TECNICO-ESPECIALIZADO
            (g.ativ.ATIV_SERVICO || []).length && seq.push(wrap('ATIVIDADES-DE-SERVICO-TECNICO-ESPECIALIZADO',
                g.ativ.ATIV_SERVICO.map(it => el('SERVICO-TECNICO-ESPECIALIZADO', Object.assign({ 'ANO-INICIO': year(it.fields.anoInicio), 'ANO-FIM': year(it.fields.anoFim) }, ATIV.ATIV_SERVICO.extra(it.fields)))).join('')));
            // 5) ATIVIDADES-DE-EXTENSAO-UNIVERSITARIA
            (g.ativ.ATIV_EXTENSAO || []).length && seq.push(wrap('ATIVIDADES-DE-EXTENSAO-UNIVERSITARIA',
                g.ativ.ATIV_EXTENSAO.map(it => el('EXTENSAO-UNIVERSITARIA', Object.assign({ 'ANO-INICIO': year(it.fields.anoInicio), 'ANO-FIM': year(it.fields.anoFim) }, ATIV.ATIV_EXTENSAO.extra(it.fields)))).join('')));
            // 6) OUTRAS-ATIVIDADES-TECNICO-CIENTIFICA
            (g.ativ.ATIV_OUTRA || []).length && seq.push(wrap('OUTRAS-ATIVIDADES-TECNICO-CIENTIFICA',
                g.ativ.ATIV_OUTRA.map(it => el('OUTRA-ATIVIDADE-TECNICO-CIENTIFICA', Object.assign({ 'ANO-INICIO': year(it.fields.anoInicio), 'ANO-FIM': year(it.fields.anoFim) }, ATIV.ATIV_OUTRA.extra(it.fields)))).join('')));
            // 7) ATIVIDADES-DE-CONSELHO-COMISSAO-E-CONSULTORIA
            (g.ativ.ATIV_CONSELHO || []).length && seq.push(wrap('ATIVIDADES-DE-CONSELHO-COMISSAO-E-CONSULTORIA',
                g.ativ.ATIV_CONSELHO.map(it => el('CONSELHO-COMISSAO-E-CONSULTORIA', Object.assign({ 'ANO-INICIO': year(it.fields.anoInicio), 'ANO-FIM': year(it.fields.anoFim) }, ATIV.ATIV_CONSELHO.extra(it.fields)))).join('')));

            const inner = seq.filter(Boolean).join('');
            if (inner) blocos.push(el('ATUACAO-PROFISSIONAL', { 'NOME-INSTITUICAO': g.nome }, inner));
        }
        // Projetos (não têm instituição no modelo) → bloco próprio de atuação.
        if (projetos.length) {
            const parts = projetos.map(it => {
                const f = it.fields;
                const equipe = clean(f.coordenador) ? el('EQUIPE-DO-PROJETO', {}, el('INTEGRANTES-DO-PROJETO', { 'NOME-COMPLETO': f.coordenador, 'NOME-PARA-CITACAO': f.coordenador, 'ORDEM-DE-INTEGRACAO': '1', 'FLAG-RESPONSAVEL': 'SIM' })) : '';
                const fin = clean(f.financiador) ? el('FINANCIADORES-DO-PROJETO', {}, el('FINANCIADOR-DO-PROJETO', { 'NOME-INSTITUICAO': f.financiador })) : '';
                return el('PARTICIPACAO-EM-PROJETO', {}, el('PROJETO-DE-PESQUISA', {
                    'ANO-INICIO': year(f.anoInicio), 'ANO-FIM': year(f.anoFim), 'NOME-DO-PROJETO': f.titulo,
                    'SITUACAO': (window.LattesEnums ? LattesEnums.token(f.situacao) : ''), 'NATUREZA': NAT_PROJ[it.typeKey],
                    'DESCRICAO-DO-PROJETO': f.descricao,
                }, equipe + fin));
            }).join('');
            blocos.push(el('ATUACAO-PROFISSIONAL', {}, wrap('ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO', parts)));
        }
        return blocos.length ? el('ATUACOES-PROFISSIONAIS', {}, blocos.join('')) : '';
    }

    /* ====================== 05.1 PRODUCAO-BIBLIOGRAFICA ================== */
    function buildBibliografica(pick) {
        let seq = 0; const S = () => String(++seq);

        const trabalhos = pick('TRABALHO_EVENTO').map(f => {
            const p = paginas(f.paginas);
            return producao('TRABALHO-EM-EVENTOS', S(),
                'DADOS-BASICOS-DO-TRABALHO', { 'NATUREZA': tok('DADOS-BASICOS-DO-TRABALHO', 'NATUREZA', f.natureza), 'TITULO-DO-TRABALHO': f.titulo, 'ANO-DO-TRABALHO': year(f.ano), 'PAIS-DO-EVENTO': f.pais, 'IDIOMA': f.idioma, 'DOI': f.doi, 'HOME-PAGE-DO-TRABALHO': f.url },
                'DETALHAMENTO-DO-TRABALHO', { 'NOME-DO-EVENTO': f.evento, 'CIDADE-DO-EVENTO': f.cidade, 'TITULO-DOS-ANAIS-OU-PROCEEDINGS': f.anais, 'ISBN': f.isbn, 'PAGINA-INICIAL': p.ini, 'PAGINA-FINAL': p.fim },
                f.autores);
        }).join('');

        const artigos = pick('ARTIGO_PERIODICO').map(f => {
            const p = paginas(f.paginas);
            return producao('ARTIGO-PUBLICADO', S(),
                'DADOS-BASICOS-DO-ARTIGO', { 'TITULO-DO-ARTIGO': f.titulo, 'ANO-DO-ARTIGO': year(f.ano), 'PAIS-DE-PUBLICACAO': f.pais, 'IDIOMA': f.idioma, 'DOI': f.doi, 'HOME-PAGE-DO-TRABALHO': f.url },
                'DETALHAMENTO-DO-ARTIGO', { 'TITULO-DO-PERIODICO-OU-REVISTA': f.periodico, 'ISSN': f.issn, 'VOLUME': f.volume, 'FASCICULO': f.fasciculo, 'PAGINA-INICIAL': p.ini, 'PAGINA-FINAL': p.fim },
                f.autores);
        }).join('');

        const aceitos = pick('ARTIGO_ACEITO').map(f =>
            producao('ARTIGO-ACEITO-PARA-PUBLICACAO', S(),
                'DADOS-BASICOS-DO-ARTIGO', { 'TITULO-DO-ARTIGO': f.titulo, 'ANO-DO-ARTIGO': year(f.ano), 'IDIOMA': f.idioma, 'DOI': f.doi, 'HOME-PAGE-DO-TRABALHO': f.url },
                'DETALHAMENTO-DO-ARTIGO', { 'TITULO-DO-PERIODICO-OU-REVISTA': f.periodico, 'ISSN': f.issn },
                f.autores)).join('');

        // Livros e capítulos
        const livrosArr = [], capsArr = [];
        pick('LIVRO_CAPITULO').forEach(f => {
            const p = paginas(f.paginas);
            if (/cap/i.test(f.tipoObra || '')) {
                capsArr.push(producao('CAPITULO-DE-LIVRO-PUBLICADO', S(),
                    'DADOS-BASICOS-DO-CAPITULO', { 'TITULO-DO-CAPITULO-DO-LIVRO': f.titulo, 'ANO': year(f.ano), 'PAIS-DE-PUBLICACAO': f.pais, 'IDIOMA': f.idioma, 'HOME-PAGE-DO-TRABALHO': f.url },
                    'DETALHAMENTO-DO-CAPITULO', { 'TITULO-DO-LIVRO': f.tituloLivro, 'PAGINA-INICIAL': p.ini, 'PAGINA-FINAL': p.fim, 'ISBN': f.isbn, 'ORGANIZADORES': f.organizadores, 'NUMERO-DA-EDICAO-REVISAO': f.edicao, 'CIDADE-DA-EDITORA': f.cidade, 'NOME-DA-EDITORA': f.editora },
                    f.autores));
            } else {
                livrosArr.push(producao('LIVRO-PUBLICADO-OU-ORGANIZADO', S(),
                    'DADOS-BASICOS-DO-LIVRO', { 'TIPO': tok('DADOS-BASICOS-DO-LIVRO', 'TIPO', f.tipoObra), 'TITULO-DO-LIVRO': f.titulo, 'ANO': year(f.ano), 'PAIS-DE-PUBLICACAO': f.pais, 'IDIOMA': f.idioma, 'HOME-PAGE-DO-TRABALHO': f.url },
                    'DETALHAMENTO-DO-LIVRO', { 'NUMERO-DE-PAGINAS': f.paginas, 'ISBN': f.isbn, 'NUMERO-DA-EDICAO-REVISAO': f.edicao, 'CIDADE-DA-EDITORA': f.cidade, 'NOME-DA-EDITORA': f.editora },
                    f.autores));
            }
        });
        const livrosCaps = wrap('LIVROS-E-CAPITULOS', [wrap('LIVROS-PUBLICADOS-OU-ORGANIZADOS', livrosArr.join('')), wrap('CAPITULOS-DE-LIVROS-PUBLICADOS', capsArr.join(''))].join(''));

        const textos = pick('TEXTO_JORNAL').map(f => {
            const p = paginas(f.paginas);
            return producao('TEXTO-EM-JORNAL-OU-REVISTA', S(),
                'DADOS-BASICOS-DO-TEXTO', { 'TITULO-DO-TEXTO': f.titulo, 'ANO-DO-TEXTO': year(f.ano), 'PAIS-DE-PUBLICACAO': f.pais, 'IDIOMA': f.idioma, 'HOME-PAGE-DO-TRABALHO': f.url },
                'DETALHAMENTO-DO-TEXTO', { 'TITULO-DO-JORNAL-OU-REVISTA': f.veiculo, 'DATA-DE-PUBLICACAO': ddmmaaaa(f.data), 'VOLUME': f.volume, 'PAGINA-INICIAL': p.ini, 'PAGINA-FINAL': p.fim, 'LOCAL-DE-PUBLICACAO': f.cidade },
                f.autores);
        }).join('');

        // DEMAIS: outra biblio, partitura, prefácio, tradução
        const outraBib = pick('OUTRA_BIBLIOGRAFICA').map(f =>
            producao('OUTRA-PRODUCAO-BIBLIOGRAFICA', S(),
                'DADOS-BASICOS-DE-OUTRA-PRODUCAO', { 'NATUREZA': f.natureza, 'TITULO': f.titulo, 'ANO': year(f.ano), 'PAIS-DE-PUBLICACAO': f.pais, 'IDIOMA': f.idioma, 'HOME-PAGE-DO-TRABALHO': f.url },
                'DETALHAMENTO-DE-OUTRA-PRODUCAO', { 'EDITORA': f.editora },
                f.autores)).join('');
        const partituras = pick('PARTITURA').map(f =>
            producao('PARTITURA-MUSICAL', S(),
                'DADOS-BASICOS-DA-PARTITURA', { 'NATUREZA': tok('DADOS-BASICOS-DA-PARTITURA', 'NATUREZA', f.natureza), 'TITULO': f.titulo, 'ANO': year(f.ano), 'PAIS-DE-PUBLICACAO': f.pais, 'IDIOMA': f.idioma, 'HOME-PAGE-DO-TRABALHO': f.url },
                'DETALHAMENTO-DA-PARTITURA', { 'FORMACAO-INSTRUMENTAL': f.formacao, 'EDITORA': f.editora },
                f.autores)).join('');
        const prefacios = pick('PREFACIO').map(f =>
            producao('PREFACIO-POSFACIO', S(),
                'DADOS-BASICOS-DO-PREFACIO-POSFACIO', { 'TIPO': tok('DADOS-BASICOS-DO-PREFACIO-POSFACIO', 'TIPO', f.natureza), 'TITULO': f.titulo, 'ANO': year(f.ano), 'PAIS-DE-PUBLICACAO': f.pais, 'IDIOMA': f.idioma, 'HOME-PAGE-DO-TRABALHO': f.url },
                'DETALHAMENTO-DO-PREFACIO-POSFACIO', { 'TITULO-DA-PUBLICACAO': f.obra, 'EDITORA-DO-PREFACIO-POSFACIO': f.editora },
                f.autores)).join('');
        const traducoes = pick('TRADUCAO').map(f =>
            producao('TRADUCAO', S(),
                'DADOS-BASICOS-DA-TRADUCAO', { 'NATUREZA': tok('DADOS-BASICOS-DA-TRADUCAO', 'NATUREZA', f.natureza), 'TITULO': f.titulo, 'ANO': year(f.ano), 'PAIS-DE-PUBLICACAO': f.pais, 'IDIOMA': f.idioma, 'HOME-PAGE-DO-TRABALHO': f.url },
                'DETALHAMENTO-DA-TRADUCAO', { 'NOME-DO-AUTOR-TRADUZIDO': f.autorOriginal, 'TITULO-DA-OBRA-ORIGINAL': f.obraOriginal, 'IDIOMA-DA-OBRA-ORIGINAL': f.idiomaOriginal, 'EDITORA-DA-TRADUCAO': f.editora },
                f.autores)).join('');
        const demais = wrap('DEMAIS-TIPOS-DE-PRODUCAO-BIBLIOGRAFICA', outraBib + partituras + prefacios + traducoes);

        const inner = [wrap('TRABALHOS-EM-EVENTOS', trabalhos), wrap('ARTIGOS-PUBLICADOS', artigos), livrosCaps, wrap('TEXTOS-EM-JORNAIS-OU-REVISTAS', textos), demais, wrap('ARTIGOS-ACEITOS-PARA-PUBLICACAO', aceitos)].join('');
        return inner ? el('PRODUCAO-BIBLIOGRAFICA', {}, inner) : '';
    }

    /* ========================= 05.2 PRODUCAO-TECNICA ===================== */
    // Situação da patente → HISTORICO-SITUACOES-PATENTE (DESCRICAO livre + STATUS required).
    function histSituacao(f) {
        const s = clean(f.situacao);
        return s ? el('HISTORICO-SITUACOES-PATENTE', { 'DESCRICAO-SITUACAO-PATENTE': s, 'STATUS-SITUACAO-PATENTE': 'SIM' }) : '';
    }
    function registroPatente(f) {
        return el('REGISTRO-OU-PATENTE', {
            'CODIGO-DO-REGISTRO-OU-PATENTE': f.registro, 'TITULO-PATENTE': f.titulo,
            'DATA-PEDIDO-DE-DEPOSITO': ddmmaaaa(f.dataDeposito), 'DATA-DE-CONCESSAO': ddmmaaaa(f.dataConcessao),
            'INSTITUICAO-DEPOSITO-REGISTRO': f.instituicao,
        });
    }
    function buildTecnica(pick) {
        let seq = 0; const S = () => String(++seq);

        const cultivarReg = pick('CULTIVAR_REGISTRADA').map(f => producao('CULTIVAR-REGISTRADA', S(),
            'DADOS-BASICOS-DA-CULTIVAR', { 'DENOMINACAO': f.titulo, 'ANO-SOLICITACAO': year(f.ano), 'PAIS': f.pais },
            'DETALHAMENTO-DA-CULTIVAR', { 'FINALIDADE': f.finalidade, 'INSTITUICAO-FINANCIADORA': f.instituicao }, f.autores, registroPatente(f))).join('');
        const softwares = pick('SOFTWARE_SEM_REGISTRO', 'SOFTWARE_REGISTRADO').map(f => producao('SOFTWARE', S(),
            'DADOS-BASICOS-DO-SOFTWARE', { 'TITULO-DO-SOFTWARE': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'IDIOMA': f.idioma, 'HOME-PAGE-DO-TRABALHO': f.url },
            'DETALHAMENTO-DO-SOFTWARE', { 'FINALIDADE': f.finalidade, 'PLATAFORMA': f.plataforma, 'AMBIENTE': f.plataforma }, f.autores, f.registro ? registroPatente(f) : '')).join('');
        const patentes = pick('PATENTE').map(f => producao('PATENTE', S(),
            'DADOS-BASICOS-DA-PATENTE', { 'TITULO': f.titulo, 'ANO-DESENVOLVIMENTO': year(f.ano), 'PAIS': f.pais, 'HOME-PAGE': f.url },
            'DETALHAMENTO-DA-PATENTE', { 'FINALIDADE': f.finalidade, 'INSTITUICAO-FINANCIADORA': f.instituicao, 'CATEGORIA': f.categoria }, f.autores, registroPatente(f))).join('');
        const cultivarProt = pick('CULTIVAR_PROTEGIDA').map(f => producao('CULTIVAR-PROTEGIDA', S(),
            'DADOS-BASICOS-DA-CULTIVAR', { 'DENOMINACAO': f.titulo, 'ANO-SOLICITACAO': year(f.ano), 'PAIS': f.pais },
            'DETALHAMENTO-DA-CULTIVAR', { 'FINALIDADE': f.finalidade, 'INSTITUICAO-FINANCIADORA': f.instituicao }, f.autores, registroPatente(f))).join('');
        const desenhos = pick('DESENHO_INDUSTRIAL').map(f => producao('DESENHO-INDUSTRIAL', S(),
            'DADOS-BASICOS-DO-DESENHO-INDUSTRIAL', { 'TITULO': f.titulo, 'ANO-DESENVOLVIMENTO': year(f.ano), 'PAIS': f.pais },
            'DETALHAMENTO-DO-DESENHO-INDUSTRIAL', { 'FINALIDADE': f.finalidade, 'INSTITUICAO-FINANCIADORA': f.instituicao }, f.autores, registroPatente(f))).join('');
        const marcas = pick('MARCA').map(f => producao('MARCA', S(),
            'DADOS-BASICOS-DA-MARCA', { 'TITULO': f.titulo, 'ANO-DESENVOLVIMENTO': year(f.ano), 'PAIS': f.pais },
            'DETALHAMENTO-DA-MARCA', { 'FINALIDADE': f.finalidade, 'NATUREZA': f.natureza }, f.autores, registroPatente(f))).join('');
        const topografias = pick('TOPOGRAFIA_CI').map(f => producao('TOPOGRAFIA-DE-CIRCUITO-INTEGRADO', S(),
            'DADOS-BASICOS-DA-TOPOGRAFIA-DE-CIRCUITO-INTEGRADO', { 'TITULO': f.titulo, 'ANO-DESENVOLVIMENTO': year(f.ano), 'PAIS': f.pais },
            'DETALHAMENTO-DA-TOPOGRAFIA-DE-CIRCUITO-INTEGRADO', { 'FINALIDADE': f.finalidade, 'INSTITUICAO-FINANCIADORA': f.instituicao }, f.autores, registroPatente(f))).join('');
        const produtos = pick('PRODUTO_TECNOLOGICO').map(f => producao('PRODUTO-TECNOLOGICO', S(),
            'DADOS-BASICOS-DO-PRODUTO-TECNOLOGICO', { 'TIPO-PRODUTO': tok('DADOS-BASICOS-DO-PRODUTO-TECNOLOGICO', 'TIPO-PRODUTO', f.natureza), 'TITULO-DO-PRODUTO': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'IDIOMA': f.idioma, 'HOME-PAGE-DO-TRABALHO': f.url },
            'DETALHAMENTO-DO-PRODUTO-TECNOLOGICO', { 'FINALIDADE': f.finalidade, 'CIDADE-DO-PRODUTO': f.cidade }, f.autores, f.registro ? registroPatente(f) : '')).join('');
        const processos = pick('PROCESSO_TECNICA').map(f => producao('PROCESSOS-OU-TECNICAS', S(),
            'DADOS-BASICOS-DO-PROCESSOS-OU-TECNICAS', { 'NATUREZA': tok('DADOS-BASICOS-DO-PROCESSOS-OU-TECNICAS', 'NATUREZA', f.natureza), 'TITULO-DO-PROCESSO': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'IDIOMA': f.idioma, 'HOME-PAGE-DO-TRABALHO': f.url },
            'DETALHAMENTO-DO-PROCESSOS-OU-TECNICAS', { 'FINALIDADE': f.finalidade, 'INSTITUICAO-FINANCIADORA': f.instituicao, 'CIDADE-DO-PROCESSO': f.cidade }, f.autores)).join('');
        // Trabalho técnico + Assessoria/Consultoria + Extensão tecnológica: no Lattes
        // são o MESMO elemento (TRABALHO-TECNICO), distintos apenas pela NATUREZA.
        const tecItens = pick('TRABALHO_TECNICO')
            .concat(pick('ASSESSORIA_CONSULTORIA').map(f => Object.assign({}, f, { natureza: f.natureza || 'Assessoria' })))
            .concat(pick('EXTENSAO_TECNOLOGICA').map(f => Object.assign({}, f, { natureza: 'Outra' })));
        const trabTec = tecItens.map(f => producao('TRABALHO-TECNICO', S(),
            'DADOS-BASICOS-DO-TRABALHO-TECNICO', { 'NATUREZA': tok('DADOS-BASICOS-DO-TRABALHO-TECNICO', 'NATUREZA', f.natureza), 'TITULO-DO-TRABALHO-TECNICO': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'IDIOMA': f.idioma, 'HOME-PAGE-DO-TRABALHO': f.url },
            'DETALHAMENTO-DO-TRABALHO-TECNICO', { 'FINALIDADE': f.finalidade, 'INSTITUICAO-FINANCIADORA': f.instituicao, 'CIDADE-DO-TRABALHO': f.cidade }, f.autores)).join('');

        // DEMAIS-TIPOS-DE-PRODUCAO-TECNICA (na ordem do XSD)
        const apres = pick('APRESENTACAO').map(f => producao('APRESENTACAO-DE-TRABALHO', S(),
            'DADOS-BASICOS-DA-APRESENTACAO-DE-TRABALHO', { 'NATUREZA': tok('DADOS-BASICOS-DA-APRESENTACAO-DE-TRABALHO', 'NATUREZA', f.natureza), 'TITULO': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'IDIOMA': f.idioma },
            'DETALHAMENTO-DA-APRESENTACAO-DE-TRABALHO', { 'NOME-DO-EVENTO': f.evento, 'INSTITUICAO-PROMOTORA': f.instituicao, 'CIDADE-DA-APRESENTACAO': f.cidade }, f.autores)).join('');
        const cartas = pick('CARTA_MAPA').map(f => producao('CARTA-MAPA-OU-SIMILAR', S(),
            'DADOS-BASICOS-DE-CARTA-MAPA-OU-SIMILAR', { 'NATUREZA': tok('DADOS-BASICOS-DE-CARTA-MAPA-OU-SIMILAR', 'NATUREZA', f.natureza), 'TITULO': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'IDIOMA': f.idioma, 'HOME-PAGE-DO-TRABALHO': f.url },
            'DETALHAMENTO-DE-CARTA-MAPA-OU-SIMILAR', { 'FINALIDADE': f.finalidade }, f.autores)).join('');
        const cursos = pick('CURSO_MINISTRADO').map(f => producao('CURSO-DE-CURTA-DURACAO-MINISTRADO', S(),
            'DADOS-BASICOS-DE-CURSOS-CURTA-DURACAO-MINISTRADO', { 'NIVEL-DO-CURSO': tok('DADOS-BASICOS-DE-CURSOS-CURTA-DURACAO-MINISTRADO', 'NIVEL-DO-CURSO', f.nivel), 'TITULO': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'IDIOMA': f.idioma, 'HOME-PAGE-DO-TRABALHO': f.url },
            'DETALHAMENTO-DE-CURSOS-CURTA-DURACAO-MINISTRADO', { 'INSTITUICAO-PROMOTORA-DO-CURSO': f.instituicao, 'CIDADE': f.cidade, 'DURACAO': f.cargaHoraria }, f.autores)).join('');
        const materiais = pick('MATERIAL_DIDATICO').map(f => producao('DESENVOLVIMENTO-DE-MATERIAL-DIDATICO-OU-INSTRUCIONAL', S(),
            'DADOS-BASICOS-DO-MATERIAL-DIDATICO-OU-INSTRUCIONAL', { 'TITULO': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'IDIOMA': f.idioma, 'HOME-PAGE-DO-TRABALHO': f.url },
            'DETALHAMENTO-DO-MATERIAL-DIDATICO-OU-INSTRUCIONAL', { 'FINALIDADE': f.finalidade }, f.autores)).join('');
        const editoracoes = pick('EDITORACAO').map(f => producao('EDITORACAO', S(),
            'DADOS-BASICOS-DE-EDITORACAO', { 'NATUREZA': tok('DADOS-BASICOS-DE-EDITORACAO', 'NATUREZA', f.natureza), 'TITULO': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'IDIOMA': f.idioma, 'HOME-PAGE-DO-TRABALHO': f.url },
            'DETALHAMENTO-DE-EDITORACAO', { 'NUMERO-DE-PAGINAS': f.paginas, 'EDITORA': f.editora, 'CIDADE': f.cidade }, f.autores)).join('');
        const manut = pick('MANUTENCAO_OBRA').map(f => producao('MANUTENCAO-DE-OBRA-ARTISTICA', S(),
            'DADOS-BASICOS-DE-MANUTENCAO-DE-OBRA-ARTISTICA', { 'TITULO': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'IDIOMA': f.idioma },
            'DETALHAMENTO-DE-MANUTENCAO-DE-OBRA-ARTISTICA', { 'LOCAL': f.finalidade, 'CIDADE': f.cidade }, f.autores)).join('');
        const maquetes = pick('MAQUETE').map(f => producao('MAQUETE', S(),
            'DADOS-BASICOS-DA-MAQUETE', { 'TITULO': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'IDIOMA': f.idioma, 'HOME-PAGE-DO-TRABALHO': f.url },
            'DETALHAMENTO-DA-MAQUETE', { 'FINALIDADE': f.finalidade }, f.autores)).join('');
        // "Olimpíada" no DTD tem acento (OLIMPÍADA), incompatível com o XSD
        // (OLIMPIADA). Para valer nos dois, mapeia esse caso raro para "Outro".
        const orgEventos = pick('ORGANIZACAO_EVENTO').map(f => producao('ORGANIZACAO-DE-EVENTO', S(),
            'DADOS-BASICOS-DA-ORGANIZACAO-DE-EVENTO', { 'TIPO': tok('DADOS-BASICOS-DA-ORGANIZACAO-DE-EVENTO', 'TIPO', /olimp/i.test(f.tipoEvento || '') ? 'Outro' : f.tipoEvento), 'TITULO': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'HOME-PAGE-DO-TRABALHO': f.url },
            'DETALHAMENTO-DA-ORGANIZACAO-DE-EVENTO', { 'INSTITUICAO-PROMOTORA': f.instituicao, 'CIDADE': f.cidade }, f.autores)).join('');
        const midias = pick('MIDIA').map(f => producao('PROGRAMA-DE-RADIO-OU-TV', S(),
            'DADOS-BASICOS-DO-PROGRAMA-DE-RADIO-OU-TV', { 'NATUREZA': tok('DADOS-BASICOS-DO-PROGRAMA-DE-RADIO-OU-TV', 'NATUREZA', f.tipo), 'TITULO': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'IDIOMA': f.idioma, 'HOME-PAGE': f.url },
            'DETALHAMENTO-DO-PROGRAMA-DE-RADIO-OU-TV', { 'EMISSORA': f.veiculo, 'CIDADE': f.cidade }, f.autores)).join('');
        const relatorios = pick('RELATORIO_PESQUISA').map(f => producao('RELATORIO-DE-PESQUISA', S(),
            'DADOS-BASICOS-DO-RELATORIO-DE-PESQUISA', { 'TITULO': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'IDIOMA': f.idioma, 'HOME-PAGE-DO-TRABALHO': f.url },
            'DETALHAMENTO-DO-RELATORIO-DE-PESQUISA', { 'INSTITUICAO-FINANCIADORA': f.instituicao }, f.autores)).join('');
        const midiaSocial = pick('MIDIA_SOCIAL').map(f => producao('MIDIA-SOCIAL-WEBSITE-BLOG', S(),
            'DADOS-BASICOS-DA-MIDIA-SOCIAL-WEBSITE-BLOG', { 'NATUREZA': tok('DADOS-BASICOS-DA-MIDIA-SOCIAL-WEBSITE-BLOG', 'NATUREZA', f.plataforma), 'TITULO': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'IDIOMA': f.idioma, 'HOME-PAGE': f.url },
            'DETALHAMENTO-DA-MIDIA-SOCIAL-WEBSITE-BLOG', { 'TEMA': f.plataforma }, f.autores)).join('');
        const outrasTec = pick('OUTRA_TECNICA').map(f => producao('OUTRA-PRODUCAO-TECNICA', S(),
            'DADOS-BASICOS-DE-OUTRA-PRODUCAO-TECNICA', { 'NATUREZA': f.natureza, 'TITULO': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'IDIOMA': f.idioma, 'HOME-PAGE-DO-TRABALHO': f.url },
            'DETALHAMENTO-DE-OUTRA-PRODUCAO-TECNICA', { 'FINALIDADE': f.finalidade, 'INSTITUICAO-PROMOTORA': f.instituicao, 'CIDADE': f.cidade }, f.autores)).join('');

        const demais = wrap('DEMAIS-TIPOS-DE-PRODUCAO-TECNICA',
            apres + cartas + cursos + materiais + editoracoes + manut + maquetes + orgEventos + midias + relatorios + midiaSocial + outrasTec);

        const inner = cultivarReg + softwares + patentes + cultivarProt + desenhos + marcas + topografias + produtos + processos + trabTec + demais;
        return inner ? el('PRODUCAO-TECNICA', {}, inner) : '';
    }

    /* ===================== 05.3/10 OUTRA-PRODUCAO ======================== */
    function buildOutraProducao(pick, orientConcl) {
        let seq = 0; const S = () => String(++seq);
        // PRODUCAO-ARTISTICA-CULTURAL (ordem do XSD: ...OUTRA..., ARTES-CENICAS, ARTES-VISUAIS, MUSICA)
        const outraArt = pick('OUTRA_ARTISTICA').map(f => producao('OUTRA-PRODUCAO-ARTISTICA-CULTURAL', S(),
            'DADOS-BASICOS-DE-OUTRA-PRODUCAO-ARTISTICA-CULTURAL', { 'NATUREZA': f.natureza, 'TITULO': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'IDIOMA': f.idioma, 'HOME-PAGE': f.url },
            'DETALHAMENTO-DE-OUTRA-PRODUCAO-ARTISTICA-CULTURAL', { 'CIDADE': f.cidade }, f.autores)).join('');
        const cenicas = pick('ARTES_CENICAS').map(f => producao('ARTES-CENICAS', S(),
            'DADOS-BASICOS-DE-ARTES-CENICAS', { 'NATUREZA': tok('DADOS-BASICOS-DE-ARTES-CENICAS', 'NATUREZA', f.natureza), 'TITULO': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'IDIOMA': f.idioma, 'HOME-PAGE': f.url },
            'DETALHAMENTO-DE-ARTES-CENICAS', { 'INSTITUICAO-PROMOTORA-DO-EVENTO': f.evento, 'CIDADE-DO-EVENTO': f.cidade }, f.autores)).join('');
        const visuais = pick('ARTES_VISUAIS').map(f => producao('ARTES-VISUAIS', S(),
            'DADOS-BASICOS-DE-ARTES-VISUAIS', { 'NATUREZA': tok('DADOS-BASICOS-DE-ARTES-VISUAIS', 'NATUREZA', f.natureza), 'TITULO': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'IDIOMA': f.idioma, 'HOME-PAGE': f.url },
            'DETALHAMENTO-DE-ARTES-VISUAIS', { 'INSTITUICAO-PROMOTORA-DO-EVENTO': f.evento, 'CIDADE-DO-EVENTO': f.cidade }, f.autores)).join('');
        const musicas = pick('MUSICA').map(f => producao('MUSICA', S(),
            'DADOS-BASICOS-DA-MUSICA', { 'NATUREZA': tok('DADOS-BASICOS-DA-MUSICA', 'NATUREZA', f.natureza), 'TITULO': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'IDIOMA': f.idioma, 'HOME-PAGE': f.url },
            'DETALHAMENTO-DA-MUSICA', { 'INSTITUICAO-PROMOTORA-DO-EVENTO': f.evento, 'CIDADE-DO-EVENTO': f.cidade }, f.autores)).join('');
        const artistica = wrap('PRODUCAO-ARTISTICA-CULTURAL', outraArt + cenicas + visuais + musicas);

        const inner = artistica + orientConcl;
        return inner ? el('OUTRA-PRODUCAO', {}, inner) : '';
    }

    // ORIENTACOES-CONCLUIDAS (vai dentro de OUTRA-PRODUCAO)
    function buildOrientacoesConcluidas(items) {
        const concl = items.filter(i => i.typeKey === 'ORIENTACAO_CONCLUIDA');
        if (!concl.length) return '';
        const buckets = { M: [], D: [], PD: [], O: [] };
        let seq = 0; const S = () => String(++seq);
        concl.forEach(it => {
            const f = it.fields; const t = f.tipo || '';
            const det = (tag) => ({ 'TIPO-DE-ORIENTACAO': orientTipo(f.natureza), 'NOME-DO-ORIENTADO': f.orientando, 'NOME-DA-INSTITUICAO': f.instituicao, 'NOME-DO-CURSO': f.curso, 'NOME-DA-AGENCIA': f.bolsa });
            if (/mestrado/i.test(t)) buckets.M.push(producao('ORIENTACOES-CONCLUIDAS-PARA-MESTRADO', S(), 'DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO', { 'TITULO': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'IDIOMA': f.idioma }, 'DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO', det(), ''));
            else if (/doutorado/i.test(t) && !/p[óo]s/i.test(t)) buckets.D.push(producao('ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO', S(), 'DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO', { 'TITULO': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'IDIOMA': f.idioma }, 'DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO', det(), ''));
            else if (/p[óo]s/i.test(t)) buckets.PD.push(producao('ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO', S(), 'DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO', { 'TITULO': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'IDIOMA': f.idioma }, 'DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO', det(), ''));
            else buckets.O.push(producao('OUTRAS-ORIENTACOES-CONCLUIDAS', S(), 'DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-CONCLUIDAS', { 'TITULO': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'IDIOMA': f.idioma }, 'DETALHAMENTO-DE-OUTRAS-ORIENTACOES-CONCLUIDAS', { 'NOME-DO-ORIENTADO': f.orientando, 'NOME-DA-INSTITUICAO': f.instituicao, 'NOME-DO-CURSO': f.curso, 'NOME-DA-AGENCIA': f.bolsa }, ''));
        });
        return wrap('ORIENTACOES-CONCLUIDAS', buckets.M.join('') + buckets.D.join('') + buckets.PD.join('') + buckets.O.join(''));
    }

    /* ==================== DADOS-COMPLEMENTARES =========================== */
    function buildComplementares(byType, items) {
        // FORMACAO-COMPLEMENTAR → OUTROS
        let sf = 0;
        const compl = byType('FORMACAO_COMPLEMENTAR').map(it => {
            const f = it.fields;
            return el('OUTROS', {
                'SEQUENCIA-FORMACAO': String(++sf), 'NIVEL': 'OUTROS', 'CARGA-HORARIA': f.cargaHoraria,
                'NOME-INSTITUICAO': f.instituicao, 'NOME-CURSO': f.titulo,
                'STATUS-DO-CURSO': statusCurso(f.anoFim),
                'ANO-DE-INICIO': year(f.anoInicio), 'ANO-DE-CONCLUSAO': year(f.anoFim),
            });
        }).join('');
        const formComplWrap = compl ? el('FORMACAO-COMPLEMENTAR', {}, compl) : '';

        // BANCAS de conclusão
        const bancaConcl = buildBancasConclusao(byType('BANCA_CONCLUSAO'));
        // BANCAS julgadoras
        const bancaJulg = buildBancasJulgadoras(byType('BANCA_JULGADORA'));
        // PARTICIPACAO-EM-EVENTOS-CONGRESSOS
        const particip = buildParticipacaoEventos(byType('PARTICIPACAO_EVENTO'));
        // ORIENTACOES-EM-ANDAMENTO
        const orientAnd = buildOrientacoesAndamento(byType('ORIENTACAO_ANDAMENTO'));

        const inner = [formComplWrap, bancaConcl, bancaJulg, particip, orientAnd].filter(Boolean).join('');
        return inner ? el('DADOS-COMPLEMENTARES', {}, inner) : '';
    }

    function buildBancasConclusao(list) {
        if (!list.length) return '';
        const b = { M: [], D: [], Q: [], AE: [], G: [], O: [] };
        let seq = 0; const S = () => String(++seq);
        list.forEach(it => {
            const f = it.fields; const t = f.tipo || '';
            const det = { 'NOME-DO-CANDIDATO': f.candidato, 'NOME-INSTITUICAO': f.instituicao, 'NOME-CURSO': f.curso };
            const part = participantesBanca(f.membros);
            const mk = (leaf, dbTag, detTag) => el(leaf, { 'SEQUENCIA-PRODUCAO': S() }, el(dbTag, { 'TITULO': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'IDIOMA': f.idioma }) + el(detTag, det) + part);
            if (/mestrado/i.test(t)) b.M.push(mk('PARTICIPACAO-EM-BANCA-DE-MESTRADO', 'DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-MESTRADO', 'DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-MESTRADO'));
            else if (/doutorado/i.test(t)) b.D.push(mk('PARTICIPACAO-EM-BANCA-DE-DOUTORADO', 'DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-DOUTORADO', 'DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-DOUTORADO'));
            else if (/qualific/i.test(t)) b.Q.push(mk('PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO', 'DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO', 'DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-EXAME-QUALIFICACAO'));
            else if (/especial|aperfei/i.test(t)) b.AE.push(mk('PARTICIPACAO-EM-BANCA-DE-APERFEICOAMENTO-ESPECIALIZACAO', 'DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-APERFEICOAMENTO-ESPECIALIZACAO', 'DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-APERFEICOAMENTO-ESPECIALIZACAO'));
            else if (/gradua|tcc/i.test(t)) b.G.push(mk('PARTICIPACAO-EM-BANCA-DE-GRADUACAO', 'DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-GRADUACAO', 'DETALHAMENTO-DA-PARTICIPACAO-EM-BANCA-DE-GRADUACAO'));
            else b.O.push(el('OUTRAS-PARTICIPACOES-EM-BANCA', { 'SEQUENCIA-PRODUCAO': S() }, el('DADOS-BASICOS-DE-OUTRAS-PARTICIPACOES-EM-BANCA', { 'TITULO': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'IDIOMA': f.idioma }) + el('DETALHAMENTO-DE-OUTRAS-PARTICIPACOES-EM-BANCA', det) + part));
        });
        return wrap('PARTICIPACAO-EM-BANCA-TRABALHOS-CONCLUSAO', b.M.join('') + b.D.join('') + b.Q.join('') + b.AE.join('') + b.G.join('') + b.O.join(''));
    }

    function buildBancasJulgadoras(list) {
        if (!list.length) return '';
        const b = { T: [], C: [], L: [], A: [], O: [] };
        let seq = 0; const S = () => String(++seq);
        list.forEach(it => {
            const f = it.fields; const t = f.tipo || '';
            const det = { 'NOME-INSTITUICAO': f.instituicao };
            const part = participantesBanca(f.membros);
            const mk = (leaf, dbTag, detTag) => el(leaf, { 'SEQUENCIA-PRODUCAO': S() }, el(dbTag, { 'TITULO': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'IDIOMA': f.idioma }) + el(detTag, det) + part);
            if (/titular/i.test(t)) b.T.push(mk('BANCA-JULGADORA-PARA-PROFESSOR-TITULAR', 'DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-PROFESSOR-TITULAR', 'DETALHAMENTO-DA-BANCA-JULGADORA-PARA-PROFESSOR-TITULAR'));
            else if (/concurso/i.test(t)) b.C.push(mk('BANCA-JULGADORA-PARA-CONCURSO-PUBLICO', 'DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-CONCURSO-PUBLICO', 'DETALHAMENTO-DA-BANCA-JULGADORA-PARA-CONCURSO-PUBLICO'));
            else if (/livre/i.test(t)) b.L.push(mk('BANCA-JULGADORA-PARA-LIVRE-DOCENCIA', 'DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-LIVRE-DOCENCIA', 'DETALHAMENTO-DA-BANCA-JULGADORA-PARA-LIVRE-DOCENCIA'));
            else if (/avalia/i.test(t)) b.A.push(mk('BANCA-JULGADORA-PARA-AVALIACAO-CURSOS', 'DADOS-BASICOS-DA-BANCA-JULGADORA-PARA-AVALIACAO-CURSOS', 'DETALHAMENTO-DA-BANCA-JULGADORA-PARA-AVALIACAO-CURSOS'));
            else b.O.push(el('OUTRAS-BANCAS-JULGADORAS', { 'SEQUENCIA-PRODUCAO': S() }, el('DADOS-BASICOS-DE-OUTRAS-BANCAS-JULGADORAS', { 'TITULO': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'IDIOMA': f.idioma }) + el('DETALHAMENTO-DE-OUTRAS-BANCAS-JULGADORAS', det) + part));
        });
        return wrap('PARTICIPACAO-EM-BANCA-JULGADORA', b.T.join('') + b.C.join('') + b.L.join('') + b.A.join('') + b.O.join(''));
    }

    function buildParticipacaoEventos(list) {
        if (!list.length) return '';
        const map = {
            'Congresso': ['PARTICIPACAO-EM-CONGRESSO', 'DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO', 'DETALHAMENTO-DA-PARTICIPACAO-EM-CONGRESSO'],
            'Feira': ['PARTICIPACAO-EM-FEIRA', 'DADOS-BASICOS-DA-PARTICIPACAO-EM-FEIRA', 'DETALHAMENTO-DA-PARTICIPACAO-EM-FEIRA'],
            'Seminário': ['PARTICIPACAO-EM-SEMINARIO', 'DADOS-BASICOS-DA-PARTICIPACAO-EM-SEMINARIO', 'DETALHAMENTO-DA-PARTICIPACAO-EM-SEMINARIO'],
            'Simpósio': ['PARTICIPACAO-EM-SIMPOSIO', 'DADOS-BASICOS-DA-PARTICIPACAO-EM-SIMPOSIO', 'DETALHAMENTO-DA-PARTICIPACAO-EM-SIMPOSIO'],
            'Oficina': ['PARTICIPACAO-EM-OFICINA', 'DADOS-BASICOS-DA-PARTICIPACAO-EM-OFICINA', 'DETALHAMENTO-DA-PARTICIPACAO-EM-OFICINA'],
            'Encontro': ['PARTICIPACAO-EM-ENCONTRO', 'DADOS-BASICOS-DA-PARTICIPACAO-EM-ENCONTRO', 'DETALHAMENTO-DA-PARTICIPACAO-EM-ENCONTRO'],
            'Exposição': ['PARTICIPACAO-EM-EXPOSICAO', 'DADOS-BASICOS-DA-PARTICIPACAO-EM-EXPOSICAO', 'DETALHAMENTO-DA-PARTICIPACAO-EM-EXPOSICAO'],
            'Olimpíada': ['PARTICIPACAO-EM-OLIMPIADA', 'DADOS-BASICOS-DA-PARTICIPACAO-EM-OLIMPIADA', 'DETALHAMENTO-DA-PARTICIPACAO-EM-OLIMPIADA'],
        };
        const order = ['Congresso', 'Feira', 'Seminário', 'Simpósio', 'Oficina', 'Encontro', 'Exposição', 'Olimpíada', 'Outra'];
        const buckets = {}; order.forEach(k => buckets[k] = []);
        let seq = 0; const S = () => String(++seq);
        list.forEach(it => {
            const f = it.fields; const nat = map[f.natureza] ? f.natureza : 'Outra';
            const spec = map[nat] || ['OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS', 'DADOS-BASICOS-DE-OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS', 'DETALHAMENTO-DE-OUTRAS-PARTICIPACOES-EM-EVENTOS-CONGRESSOS'];
            const flagCT = /^s/i.test(f.divulgacaoCT || '') ? 'SIM' : (/^n/i.test(f.divulgacaoCT || '') ? 'NAO' : '');
            const db = { 'TITULO': f.titulo || f.tituloApresentacao, 'ANO': year(f.ano), 'PAIS': f.pais, 'TIPO-PARTICIPACAO': f.tipoParticipacao, 'FORMA-PARTICIPACAO': f.formaParticipacao, 'FLAG-DIVULGACAO-CIENTIFICA': flagCT, 'HOME-PAGE-DO-TRABALHO': f.url };
            const det = { 'NOME-DO-EVENTO': f.titulo, 'CIDADE-DO-EVENTO': f.cidade };
            buckets[nat].push(el(spec[0], { 'SEQUENCIA-PRODUCAO': S() }, el(spec[1], db) + el(spec[2], det)));
        });
        return wrap('PARTICIPACAO-EM-EVENTOS-CONGRESSOS', order.map(k => buckets[k].join('')).join(''));
    }

    function buildOrientacoesAndamento(list) {
        if (!list.length) return '';
        const b = { M: [], D: [], PD: [], AE: [], G: [], IC: [], O: [] };
        let seq = 0; const S = () => String(++seq);
        list.forEach(it => {
            const f = it.fields; const t = f.tipo || '';
            const detBase = { 'NOME-DO-ORIENTANDO': f.orientando, 'NOME-INSTITUICAO': f.instituicao, 'NOME-CURSO': f.curso, 'NOME-DA-AGENCIA': f.bolsa };
            // Só Mestrado/Doutorado/Pós-Doutorado têm TIPO-DE-ORIENTACAO no detalhamento
            const mk = (leaf, dbTag, detTag, withTipo) => el(leaf, { 'SEQUENCIA-PRODUCAO': S() }, el(dbTag, { 'TITULO-DO-TRABALHO': f.titulo, 'ANO': year(f.ano), 'PAIS': f.pais, 'IDIOMA': f.idioma }) + el(detTag, withTipo ? Object.assign({ 'TIPO-DE-ORIENTACAO': orientTipo(f.natureza) }, detBase) : detBase));
            if (/mestrado/i.test(t)) b.M.push(mk('ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO', 'DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO', 'DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO', true));
            else if (/doutorado/i.test(t) && !/p[óo]s/i.test(t)) b.D.push(mk('ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO', 'DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO', 'DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO', true));
            else if (/p[óo]s/i.test(t)) b.PD.push(mk('ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO', 'DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO', 'DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO', true));
            else if (/especial|aperfei/i.test(t)) b.AE.push(mk('ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO', 'DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO', 'DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-APERFEICOAMENTO-ESPECIALIZACAO', false));
            else if (/gradua|tcc/i.test(t)) b.G.push(mk('ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO', 'DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO', 'DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO', false));
            else if (/inicia/i.test(t)) b.IC.push(mk('ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA', 'DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA', 'DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA', false));
            else b.O.push(mk('OUTRAS-ORIENTACOES-EM-ANDAMENTO', 'DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-EM-ANDAMENTO', 'DETALHAMENTO-DE-OUTRAS-ORIENTACOES-EM-ANDAMENTO', false));
        });
        return wrap('ORIENTACOES-EM-ANDAMENTO', b.M.join('') + b.D.join('') + b.PD.join('') + b.AE.join('') + b.G.join('') + b.IC.join('') + b.O.join(''));
    }

    /* ============================== BUILD =============================== */
    function build(items, settings) {
        settings = settings || {};
        const LT = window.LattesTypes;
        // Considera apenas itens de categorias Lattes e tipos exportáveis.
        const exportable = (items || []).filter(it => {
            if (!it || !it.typeKey) return false;
            const def = LT && LT.getType(it.typeKey);
            if (def && def.noExport) return false;
            if (LT && LT.isNaoLattesCategory && LT.isNaoLattesCategory(it.categoryKey)) return false;
            return true;
        });

        const byType = (tk) => exportable.filter(i => i.typeKey === tk);
        // pick(...tks): devolve os `fields` de todos os itens desses tipos (com dedup)
        const seen = new Set();
        const pick = (...tks) => exportable
            .filter(i => tks.indexOf(i.typeKey) >= 0)
            .map(i => i.fields || {})
            .filter(f => {
                const k = clean(f.titulo).toLowerCase() + '|' + year(f.ano);
                if (seen.has(k) && clean(f.titulo)) return false; seen.add(k); return true;
            });

        const dadosGerais = buildDadosGerais(byType, exportable);
        const biblio = buildBibliografica(pick);
        const tecnica = buildTecnica(pick);
        const orientConcl = buildOrientacoesConcluidas(exportable);
        const outra = buildOutraProducao(pick, orientConcl);
        const compl = buildComplementares(byType, exportable);

        const agora = new Date();
        const rootAttrs = {
            'SISTEMA-ORIGEM-XML': SISTEMA_ORIGEM,
            'DATA-ATUALIZACAO': settings.dataAtualizacao || agoraData(agora),
            'HORA-ATUALIZACAO': settings.horaAtualizacao || agoraHora(agora),
        };
        // NUMERO-IDENTIFICADOR é opcional; só emite se houver (evita valor vazio).
        if (settings.numeroIdentificador) rootAttrs['NUMERO-IDENTIFICADOR'] = settings.numeroIdentificador;
        const inner = [dadosGerais, biblio, tecnica, outra, compl].filter(Boolean).join('');
        const doc = '<?xml version="1.0" encoding="ISO-8859-1"?>\n' + el('CURRICULO-VITAE', rootAttrs, inner) + '\n';
        return doc;
    }

    return { build };
})();
