/* ==========================================================================
   lattesZen — Módulo RSC-PCCTAE (Decreto nº 13.048/2026)
   --------------------------------------------------------------------------
   Tabelas dos Anexos I–VI (critérios específicos), regras de nível e o motor
   de simulação (pontos por requisito, nº de critérios distintos, nível
   alcançável). Uso INDIVIDUAL, tabelas fixas no código (art. 21 permite ao
   MEC alterar por ato complementar — então isolamos aqui para facilitar).

   Unidade de cálculo (calc):
     'ano'     — por ano ou fração acima de 6 meses (usa data início/fim)
     'mes'     — por mês (usa data início/fim)
     'unidade' — por designação/projeto/produto/prêmio/evento/... (conta 1)
   ========================================================================== */
window.LzRSC = (function () {
    // Rótulo curto de cada Requisito (art. 3, I–VI)
    const REQUISITOS = {
        1: 'I — Grupos, comissões, comitês e representações',
        2: 'II — Projetos institucionais, apoio a ensino/pesquisa/extensão',
        3: 'III — Premiação em reconhecimento público',
        4: 'IV — Responsabilidades técnico-administrativas ou especializadas',
        5: 'V — Função ou cargo de direção/assessoramento',
        6: 'VI — Produção, prospecção e difusão de conhecimento',
    };

    // Critérios específicos (linhas dos Anexos). u = rótulo da unidade de medida.
    const C = (req, item, calc, u, pontos, desc, extra) =>
        Object.assign({ req, item, calc, unidade: u, pontos, desc, id: req + '.' + item }, extra || {});

    const CRITERIOS = [
        // ---- Anexo I (Requisito I) ----
        C(1, 1, 'ano', 'Por ano ou fração > 6 meses', 3, 'Exercício de mandato como membro de conselhos superiores e de unidades/órgãos colegiados da IFE'),
        C(1, 2, 'unidade', 'Por designação', 4.5, 'Coordenação/presidência de núcleos, representações, GTs, comissões ou comitês'),
        C(1, 3, 'unidade', 'Por designação', 3, 'Participação como membro de núcleos, representações, GTs, comissões ou comitês'),
        C(1, 4, 'unidade', 'Por designação', 3, 'Defensor dativo ou membro de equipe em sindicância, PAD ou tomada de contas especial'),
        C(1, 5, 'unidade', 'Por designação', 4.5, 'Organização/fiscalização/execução de exame de seleção, vestibular ou concursos'),
        C(1, 6, 'unidade', 'Por designação', 3, 'Elaboração, revisão e/ou correção de provas de seleção, vestibular ou concursos'),
        C(1, 7, 'ano', 'Por ano ou fração > 6 meses', 1.5, 'Exercício de mandato em entidade sindical da categoria'),
        C(1, 8, 'unidade', 'Por designação', 3, 'Membro em programas/projetos de políticas públicas externas (com resultados institucionais)'),
        C(1, 9, 'unidade', 'Por designação', 7.5, 'Representação legal da IFE ou responsabilidade técnica junto a fiscalização/controle/regulação'),
        C(1, 10, 'unidade', 'Por produto', 4.5, 'Atuação técnica externa autorizada (órgãos estatais/paraestatais, agências, organismos internacionais)'),
        // ---- Anexo II (Requisito II) ----
        C(2, 1, 'unidade', 'Por projeto', 7.5, 'Coordenação de projetos institucionais (ensino, pesquisa, extensão, gestão e inovação)'),
        C(2, 2, 'unidade', 'Por projeto', 4.5, 'Participação técnica/especializada em projetos (proj. pedagógicos, programas e ações)'),
        C(2, 3, 'unidade', 'Por mandato', 7.5, 'Comissão ou conselho editorial de livros, revistas ou publicações acadêmicas'),
        C(2, 4, 'unidade', 'Por projeto', 3, 'Cooperação Técnica Interinstitucional em projetos institucionais'),
        C(2, 5, 'unidade', 'Por designação', 3, 'Orientação, tutoria, preceptoria ou supervisão'),
        C(2, 6, 'unidade', 'Por produto', 3, 'Produção/reformulação de material acessível ou técnico de referência (manuais, roteiros)'),
        C(2, 7, 'unidade', 'Por evento', 3, 'Avaliação de trabalho ou jurado em eventos acadêmicos, científicos, culturais, esportivos e técnicos'),
        C(2, 8, 'unidade', 'Por projeto', 3, 'Produção audiovisual, artística, exposição, podcast ou outra apresentação institucional'),
        C(2, 9, 'unidade', 'Por capacitação (≥10h)', 1, 'Programas de formação continuada / desenvolvimento de competências (≥10h, não usada p/ aceleração)'),
        C(2, 10, 'ano', 'Por ano ou fração > 6 meses', 1, 'Atividade técnica especializada reconhecida, com domínio diferenciado e contribuição relevante'),
        C(2, 11, 'unidade', 'Por evento (≥10h)', 1, 'Capacitação, fórum, oficina, workshop e congresso (≥10h) vinculado aos interesses da IFE'),
        // ---- Anexo III (Requisito III) ----
        C(3, 1, 'unidade', 'Por prêmio', 20, 'Premiação de âmbito internacional por projeto implementado na administração pública'),
        C(3, 2, 'unidade', 'Por prêmio', 15, 'Premiação de âmbito nacional por projeto implementado na administração pública'),
        C(3, 3, 'unidade', 'Por prêmio', 7.5, 'Premiação de âmbito local ou institucional por projeto implementado na administração pública'),
        // ---- Anexo IV (Requisito IV) ----
        C(4, 1, 'unidade', 'Por sistema', 4.5, 'Atuação qualificada em sistemas estruturantes (operação, implantação, suporte, desenvolvimento)'),
        C(4, 2, 'unidade', 'Por designação', 3, 'Elaboração de projeto básico/termo de referência ou equipe de planejamento de contratação'),
        C(4, 3, 'unidade', 'Por designação', 4.5, 'Gestão ou fiscalização de contratos, convênios, acordos ou instrumentos correlatos'),
        C(4, 4, 'ano', 'Por ano ou fração > 6 meses', 3, 'Atividades relacionadas à licitação e às suas excepcionalidades'),
        C(4, 5, 'ano', 'Por ano ou fração > 6 meses', 3, 'Apoio técnico especializado (saúde humana/animal/ambiente, acessibilidade ou diversidade)'),
        C(4, 6, 'ano', 'Por ano ou fração > 6 meses', 3, 'Atuação em ambientes/processos com condições especiais de segurança/conformidade (sem adicional)'),
        C(4, 7, 'unidade', 'Por designação', 3, 'Atuação em sistemas/processos institucionais que não constituam atividade habitual do cargo'),
        C(4, 8, 'ano', 'Por ano ou fração > 6 meses', 4.5, 'Responsável por setor ou unidade, formalmente designado (sem remuneração)'),
        // ---- Anexo V (Requisito V) — titular / substituto ----
        C(5, 1, 'ano', 'Por ano ou fração > 6 meses', 9, 'Exercício de cargo de direção (CD-02) ou equivalente', { pontosSub: 4.5 }),
        C(5, 2, 'ano', 'Por ano ou fração > 6 meses', 7.5, 'Exercício de cargo de direção (CD-03 e CD-04) ou equivalente', { pontosSub: 3 }),
        C(5, 3, 'ano', 'Por ano ou fração > 6 meses', 4.5, 'Exercício de função gratificada (FG-01 e FG-02) ou equivalente', { pontosSub: 1.5 }),
        C(5, 4, 'ano', 'Por ano ou fração > 6 meses', 3, 'Exercício de função gratificada (a partir da FG-03) ou equivalente', { pontosSub: 1 }),
        // ---- Anexo VI (Requisito VI) ----
        C(6, 1, 'unidade', 'Por patente', 30, 'Carta patente relacionada aos interesses institucionais'),
        C(6, 2, 'unidade', 'Por projeto', 25, 'Protótipos, depósitos e/ou registros de PI ou privilégio de invenção'),
        C(6, 3, 'unidade', 'Por produto', 20, 'Transferência de tecnologia, licenciamento ou exploração de ativo tecnológico'),
        C(6, 4, 'unidade', 'Por curso', 15, 'Conclusão de curso superior ao exigido para o cargo (não usado p/ Incentivo à Qualificação)'),
        C(6, 5, 'unidade', 'Por produto', 15, 'Implantação/desenvolvimento de produto, projeto, processo, técnica ou tecnologia'),
        C(6, 6, 'unidade', 'Por grupo de pesquisa', 7.5, 'Liderança ou vice-liderança de grupo de pesquisa/extensão registrado'),
        C(6, 7, 'unidade', 'Por projeto', 3, 'Membro de grupo de pesquisa registrado em órgão/sistema oficial'),
        C(6, 8, 'unidade', 'Por projeto', 7.5, 'Aprovação de projeto para captação de recursos para a IFE'),
        C(6, 9, 'unidade', 'Por produto', 20, 'Publicação ou organização de livro (com ISBN e Conselho Editorial)'),
        C(6, 10, 'unidade', 'Por publicação', 7.5, 'Autoria/coautoria de capítulo de livro, artigo em revista, jornal científico ou periódico'),
        C(6, 11, 'unidade', 'Por produto', 4.5, 'Apresentação de trabalho de interesse institucional em congresso, seminário ou eventos'),
        C(6, 12, 'unidade', 'Por produto', 4.5, 'Produção de material técnico/científico/metodológico/administrativo (difusão do conhecimento)'),
        C(6, 13, 'unidade', 'Por projeto', 4.5, 'Avaliação de projeto de ensino, pesquisa, extensão e/ou inovação'),
        C(6, 14, 'unidade', 'Por evento', 3, 'Difusão ou apoio à formação institucional (expositor, facilitador, colaborador)'),
        C(6, 15, 'unidade', 'Por curso', 4.5, 'Instrutor, tutor, palestrante, autor de conteúdo ou orientador em ação formativa estruturada'),
        C(6, 16, 'unidade', 'Por evento', 3.5, 'Coordenação de congresso, simpósio ou seminário de interesse institucional'),
        C(6, 17, 'unidade', 'Por evento', 4.5, 'Coorientação de trabalho de conclusão de curso (diferentes modalidades)'),
        C(6, 18, 'unidade', 'Por produto', 3, 'Autoria de obra artística ou cultural registrada com repercussão institucional'),
        C(6, 19, 'mes', 'Por mês', 1, 'Atuação institucional no enfrentamento de surto, epidemia ou pandemia'),
    ];

    const byId = {};
    CRITERIOS.forEach(c => { byId[c.id] = c; });

    // Níveis (art. 5): pontos mínimos, critérios específicos distintos mínimos,
    // e requisito(s) obrigatório(s) (pelo menos um critério contado pertence a eles).
    const NIVEIS = [
        { n: 1, nome: 'RSC-PCCTAE I', pontos: 10, criterios: 0, reqObrig: null },
        { n: 2, nome: 'RSC-PCCTAE II', pontos: 15, criterios: 2, reqObrig: null },
        { n: 3, nome: 'RSC-PCCTAE III', pontos: 25, criterios: 2, reqObrig: null },
        { n: 4, nome: 'RSC-PCCTAE IV', pontos: 30, criterios: 3, reqObrig: [2, 4, 5, 6] },
        { n: 5, nome: 'RSC-PCCTAE V', pontos: 52, criterios: 5, reqObrig: [4, 5, 6] },
        { n: 6, nome: 'RSC-PCCTAE VI', pontos: 75, criterios: 7, reqObrig: [6] },
    ];

    // Escolaridade → nível máximo permitido (art. 5, §1) e % de Incentivo à Qualificação
    const ESCOLARIDADE = [
        { key: 'fund_inc', label: 'Fundamental incompleto', maxN: 1, iq: 10 },
        { key: 'fund', label: 'Fundamental completo', maxN: 2, iq: 15 },
        { key: 'medio', label: 'Ensino médio ou técnico de nível médio', maxN: 3, iq: 25 },
        { key: 'grad', label: 'Graduação (ensino superior)', maxN: 4, iq: 30 },
        { key: 'lato', label: 'Pós-graduação lato sensu', maxN: 5, iq: 52 },
        { key: 'mestrado', label: 'Mestrado (ou superior)', maxN: 6, iq: 75 },
    ];

    /* ---------------------- Datas (dd/mm/aaaa) ------------------------- */
    function parseBR(s) {
        const m = String(s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (!m) return null;
        const d = +m[1], mo = +m[2], y = +m[3];
        if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
        const dt = new Date(y, mo - 1, d);
        if (isNaN(dt.getTime())) return null;
        // new Date() "rola" dias inexistentes pro mês seguinte em vez de
        // rejeitar (ex.: 31/02 vira 02 ou 03/03) — confere se o que voltou
        // bate com o que foi pedido; senão, a data não existe de verdade.
        if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
        return dt;
    }
    // Meses de calendário entre duas datas dd/mm/aaaa (inclusivo por dia)
    function mesesEntre(ini, fim) {
        const a = parseBR(ini), b = parseBR(fim);
        if (!a || !b) return null;
        let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
        if (b.getDate() < a.getDate()) m -= 1;
        return Math.max(0, m);
    }
    // "Por ano ou fração acima de 6 meses"
    function anosFracao(meses) {
        if (meses == null) return 0;
        return Math.floor(meses / 12) + ((meses % 12) > 6 ? 1 : 0);
    }

    // Quantidade conforme a unidade de cálculo do critério
    function quantidade(crit, rsc) {
        if (!crit) return 0;
        if (crit.calc === 'ano') {
            const q = anosFracao(mesesEntre(rsc.dataInicio, rsc.dataFim));
            return q || (rsc.quantidade ? Number(rsc.quantidade) : 0);
        }
        if (crit.calc === 'mes') {
            const q = mesesEntre(rsc.dataInicio, rsc.dataFim);
            return (q != null ? q : 0) || (rsc.quantidade ? Number(rsc.quantidade) : 0);
        }
        return rsc.quantidade ? Number(rsc.quantidade) : 1;
    }
    // Pontos de um item (considera titular/substituto no Anexo V)
    function pontosItem(rsc) {
        const crit = byId[rsc && rsc.criterio];
        if (!crit) return { pontos: 0, quantidade: 0, unitario: 0, crit: null };
        const unitario = (crit.pontosSub != null && rsc.papel === 'substituto') ? crit.pontosSub : crit.pontos;
        const q = quantidade(crit, rsc);
        return { pontos: +(unitario * q).toFixed(2), quantidade: q, unitario, crit };
    }

    function escInfo(key) { return ESCOLARIDADE.find(e => e.key === key) || null; }

    // Simulação: recebe a lista de RSC dos itens elegíveis e a escolaridade.
    // rscList: [{ criterio, dataInicio, dataFim, papel, quantidade, ... }]
    function simular(rscList, escolaridadeKey) {
        const contados = [];
        const porReq = {}; for (let r = 1; r <= 6; r++) porReq[r] = { pontos: 0, itens: 0, criterios: new Set() };
        const criteriosDistintos = new Set();
        let total = 0;
        (rscList || []).forEach(rsc => {
            const pi = pontosItem(rsc);
            if (!pi.crit || pi.pontos <= 0) return;
            contados.push({ rsc, ...pi });
            total += pi.pontos;
            const r = pi.crit.req;
            porReq[r].pontos = +(porReq[r].pontos + pi.pontos).toFixed(2);
            porReq[r].itens++;
            porReq[r].criterios.add(pi.crit.id);
            criteriosDistintos.add(pi.crit.id);
        });
        total = +total.toFixed(2);
        const nDistintos = criteriosDistintos.size;
        const reqsComCriterio = new Set(Array.from(criteriosDistintos).map(id => +id.split('.')[0]));
        const esc = escInfo(escolaridadeKey);
        const capN = esc ? esc.maxN : 6;

        const niveis = NIVEIS.map(nv => {
            const okPontos = total >= nv.pontos;
            const okCrit = nDistintos >= nv.criterios;
            const okReq = !nv.reqObrig || nv.reqObrig.some(r => reqsComCriterio.has(r));
            const okEsc = nv.n <= capN;
            return {
                n: nv.n, nome: nv.nome, min: nv, atingido: okPontos && okCrit && okReq && okEsc,
                okPontos, okCrit, okReq, okEsc,
                faltaPontos: Math.max(0, +(nv.pontos - total).toFixed(2)),
                faltaCriterios: Math.max(0, nv.criterios - nDistintos),
            };
        });
        let alcancavel = 0;
        niveis.forEach(x => { if (x.atingido && x.n > alcancavel) alcancavel = x.n; });
        const nivelObj = NIVEIS.find(x => x.n === alcancavel) || null;

        return {
            total, criteriosDistintos: nDistintos, porRequisito: porReq, reqsComCriterio,
            capNivel: capN, escolaridade: esc, niveis, nivelAlcancavel: alcancavel,
            nivelNome: nivelObj ? nivelObj.nome : '—', iq: (esc && alcancavel === capN) ? esc.iq : (NIVEIS_IQ[alcancavel] || 0),
            contados,
        };
    }
    // % de IQ por nível (art. 5, §1)
    const NIVEIS_IQ = { 1: 10, 2: 15, 3: 25, 4: 30, 5: 52, 6: 75 };

    return {
        REQUISITOS, CRITERIOS, NIVEIS, ESCOLARIDADE,
        criterio(id) { return byId[id] || null; },
        criteriosDoRequisito(req) { return CRITERIOS.filter(c => c.req === +req); },
        parseBR, pontosItem, quantidade, simular, escInfo,
    };
})();
