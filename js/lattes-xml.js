/* ==========================================================================
   lattesZen — Importador do XML do Currículo Lattes
   --------------------------------------------------------------------------
   Faz o parse do arquivo XML exportado pela Plataforma Lattes (CNPq) e
   mapeia as seções para os tipos internos definidos em lattes-types.js.
   Cada item extraído recebe um "lattesRef" (chave estável) para permitir
   reconciliação/dedup ao reimportar.
   ========================================================================== */
window.LattesXML = (function () {

    // Coleta atributos de um elemento (Lattes usa atributos MAIÚSCULOS-COM-HÍFEN)
    function attrs(el) {
        const o = {};
        if (!el) return o;
        for (const a of el.attributes) o[a.name] = a.value;
        return o;
    }
    function firstChildTag(el, tag) {
        if (!el) return null;
        return el.getElementsByTagName(tag)[0] || null;
    }

    // Chave estável de deduplicação
    function refFor(typeKey, fields, extra) {
        const base = (fields.titulo || fields.curso || fields.orientando || '') + '|' + (fields.ano || fields.anoFim || '') + '|' + typeKey;
        return (extra ? extra + '|' : '') + base.toLowerCase().replace(/\s+/g, ' ').trim();
    }

    // Definição das seções do XML → tipo interno
    const SECTIONS = [
        {
            tag: 'ARTIGO-PUBLICADO', typeKey: 'ARTIGO_PERIODICO',
            map(el) {
                const b = attrs(firstChildTag(el, 'DADOS-BASICOS-DO-ARTIGO'));
                const d = attrs(firstChildTag(el, 'DETALHAMENTO-DO-ARTIGO'));
                return {
                    titulo: b['TITULO-DO-ARTIGO'] || '',
                    ano: b['ANO-DO-ARTIGO'] || '',
                    doi: b['DOI'] || '',
                    periodico: d['TITULO-DO-PERIODICO-OU-REVISTA'] || '',
                    issn: d['ISSN'] || '',
                    volume: d['VOLUME'] || '',
                    fasciculo: d['FASCICULO'] || '',
                    paginas: [d['PAGINA-INICIAL'], d['PAGINA-FINAL']].filter(Boolean).join('-'),
                };
            },
        },
        {
            tag: 'LIVRO-PUBLICADO-OU-ORGANIZADO', typeKey: 'LIVRO',
            map(el) {
                const b = attrs(firstChildTag(el, 'DADOS-BASICOS-DO-LIVRO'));
                const d = attrs(firstChildTag(el, 'DETALHAMENTO-DO-LIVRO'));
                return {
                    titulo: b['TITULO-DO-LIVRO'] || '',
                    ano: b['ANO'] || '',
                    natureza: b['TIPO'] || '',
                    editora: d['NOME-DA-EDITORA'] || '',
                    cidade: d['CIDADE-DA-EDITORA'] || '',
                    isbn: d['ISBN'] || '',
                    edicao: d['NUMERO-DA-EDICAO-REVISAO'] || '',
                    paginas: d['NUMERO-DE-PAGINAS'] || '',
                };
            },
        },
        {
            tag: 'CAPITULO-DE-LIVRO-PUBLICADO', typeKey: 'CAPITULO_LIVRO',
            map(el) {
                const b = attrs(firstChildTag(el, 'DADOS-BASICOS-DO-CAPITULO'));
                const d = attrs(firstChildTag(el, 'DETALHAMENTO-DO-CAPITULO'));
                return {
                    titulo: b['TITULO-DO-CAPITULO-DO-LIVRO'] || '',
                    ano: b['ANO'] || '',
                    tituloLivro: d['TITULO-DO-LIVRO'] || '',
                    editora: d['NOME-DA-EDITORA'] || '',
                    isbn: d['ISBN'] || '',
                    paginas: [d['PAGINA-INICIAL'], d['PAGINA-FINAL']].filter(Boolean).join('-'),
                };
            },
        },
        {
            tag: 'TRABALHO-EM-EVENTOS', typeKey: 'TRABALHO_EVENTO',
            map(el) {
                const b = attrs(firstChildTag(el, 'DADOS-BASICOS-DO-TRABALHO'));
                const d = attrs(firstChildTag(el, 'DETALHAMENTO-DO-TRABALHO'));
                return {
                    titulo: b['TITULO-DO-TRABALHO'] || '',
                    ano: b['ANO-DO-TRABALHO'] || '',
                    natureza: b['NATUREZA'] || '',
                    doi: b['DOI'] || '',
                    evento: d['NOME-DO-EVENTO'] || '',
                    anais: d['TITULO-DOS-ANAIS-OU-PROCEEDINGS'] || '',
                    cidade: d['CIDADE-DO-EVENTO'] || '',
                    paginas: [d['PAGINA-INICIAL'], d['PAGINA-FINAL']].filter(Boolean).join('-'),
                };
            },
        },
        {
            tag: 'TEXTO-EM-JORNAL-OU-REVISTA', typeKey: 'TEXTO_JORNAL',
            map(el) {
                const b = attrs(firstChildTag(el, 'DADOS-BASICOS-DO-TEXTO'));
                const d = attrs(firstChildTag(el, 'DETALHAMENTO-DO-TEXTO'));
                return {
                    titulo: b['TITULO-DO-TEXTO'] || '',
                    ano: b['ANO-DO-TEXTO'] || '',
                    veiculo: d['TITULO-DO-JORNAL-OU-REVISTA'] || '',
                    data: d['DATA-DE-PUBLICACAO'] || '',
                    paginas: [d['PAGINA-INICIAL'], d['PAGINA-FINAL']].filter(Boolean).join('-'),
                };
            },
        },
        {
            tag: 'SOFTWARE', typeKey: 'SOFTWARE',
            map(el) {
                const b = attrs(firstChildTag(el, 'DADOS-BASICOS-DO-SOFTWARE'));
                const d = attrs(firstChildTag(el, 'DETALHAMENTO-DO-SOFTWARE'));
                return {
                    titulo: b['TITULO-DO-SOFTWARE'] || '',
                    ano: b['ANO'] || '',
                    finalidade: b['FINALIDADE'] || '',
                    plataforma: d['PLATAFORMA'] || d['AMBIENTE'] || '',
                };
            },
        },
        {
            tag: 'FORMACAO-ACADEMICA-TITULACAO', typeKey: 'FORMACAO_ACADEMICA',
            container: true, // iterar filhos diretos (GRADUACAO, MESTRADO, DOUTORADO...)
            map(child) {
                const b = attrs(child);
                const nivelMap = {
                    'GRADUACAO': 'Graduação', 'ESPECIALIZACAO': 'Especialização',
                    'MESTRADO': 'Mestrado', 'DOUTORADO': 'Doutorado',
                    'POS-DOUTORADO': 'Pós-Doutorado', 'LIVRE-DOCENCIA': 'Livre-docência',
                };
                return {
                    nivel: nivelMap[child.tagName] || child.tagName,
                    curso: b['NOME-CURSO'] || b['NOME-DO-CURSO'] || '',
                    instituicao: b['NOME-INSTITUICAO'] || '',
                    anoInicio: b['ANO-DE-INICIO'] || '',
                    anoFim: b['ANO-DE-CONCLUSAO'] || '',
                    titulo: b['TITULO-DO-TRABALHO-DE-CONCLUSAO-DE-CURSO'] || b['TITULO-DA-DISSERTACAO-TESE'] || '',
                    orientador: b['NOME-DO-ORIENTADOR'] || '',
                };
            },
        },
    ];

    /**
     * Faz o parse do texto XML e retorna { items: [...], summary: {...}, errors: [...] }
     */
    function parse(xmlText) {
        const errors = [];
        const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
            return { items: [], summary: {}, errors: ['XML inválido ou corrompido.'] };
        }

        const items = [];
        const summary = {};

        SECTIONS.forEach(sec => {
            const nodes = doc.getElementsByTagName(sec.tag);
            for (const node of nodes) {
                if (sec.container) {
                    // Iterar filhos-elemento diretos
                    for (const child of node.children) {
                        if (child.nodeType !== 1) continue;
                        pushItem(sec, child);
                    }
                } else {
                    pushItem(sec, node);
                }
            }
        });

        function pushItem(sec, el) {
            let fields;
            try { fields = sec.map(el); } catch (e) { errors.push(`Erro em ${sec.tag}: ${e.message}`); return; }
            if (!fields || !(fields.titulo || fields.curso)) return; // ignora vazios
            const typeKey = sec.typeKey;
            items.push({
                typeKey,
                fields,
                lattesRef: refFor(typeKey, fields),
            });
            summary[typeKey] = (summary[typeKey] || 0) + 1;
        }

        // Dados do titular (opcional, para exibição)
        const dg = doc.querySelector('DADOS-GERAIS');
        const titular = dg ? (attrs(dg)['NOME-COMPLETO'] || '') : '';

        return { items, summary, errors, titular };
    }

    return { parse };
})();
