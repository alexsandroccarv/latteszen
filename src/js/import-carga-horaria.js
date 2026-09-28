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
   lattesZen — Importar "Carga Horária: Consolidada" (PDF da Unifesp)
   --------------------------------------------------------------------------
   A Unifesp não disponibiliza esse relatório num formato legível por
   máquina (XML/JSON) — só como PDF. Como é um PDF gerado por sistema (texto
   selecionável, não digitalizado), dá pra extrair as tabelas direto do
   texto posicionado (pdf.js), sem OCR.

   As linhas viram itens NORMAIS do catálogo Lattes (mesmos typeKeys de
   lattes-types-*.js) — o relatório serve TAE e Docente com o mesmo layout,
   então o destino é sempre o catálogo genérico, nunca uma pasta exclusiva
   de um módulo (pedido do Alexsandro).

   Algoritmo de reconstrução de tabela (validado linha a linha contra um
   relatório real de 37 linhas antes de escrever este arquivo):
   1. Cada página tem um cabeçalho de tabela (ex.: "# Data Descrição Código
      Título Vínculo Envolvimento CH") — a posição x de cada rótulo define
      os limites de cada coluna (mais robusto que "chutar" pixels fixos:
      se a Unifesp reposicionar levemente o layout, os limites se ajustam
      sozinhos).
   2. O rodapé fixo de cada página ("Carga Horária" / "Código de
      autenticação: ..." / "Unifesp, ...") fica numa faixa de y bem mais
      baixa que qualquer linha real — removido ANTES de tudo (sem isso,
      esse texto gruda na última linha da página, já que o agrupamento por
      "vizinho mais próximo" olha só a distância em y).
   3. Cada linha real é ancorada pelo número sequencial da coluna "#" — os
      demais itens da página são atribuídos à âncora mais próxima em y
      (linhas com texto longo quebram em 2+ linhas de PDF, ligeiramente
      acima/abaixo da própria âncora).
   ========================================================================== */
window.ImportCargaHoraria = (function () {
    /* ---------------------- Reconstrução de tabela ----------------------- */
    // Perfis de tabela conhecidos do relatório — cada um identificado pelos
    // rótulos exatos do cabeçalho, na ordem oficial do relatório.
    const PERFIS_TABELA = [
        { nome: 'eventos', cabecalho: ['#', 'Data', 'Descrição', 'Código', 'Título', 'Vínculo', 'Envolvimento', 'CH'] },
        { nome: 'disciplinas', cabecalho: ['#', 'Ano', 'Código Disciplina', 'Disciplina', 'Cargo', 'CH'] },
    ];

    // Nomes de seção oficiais do relatório — usados tanto pra identificar a
    // qual seção uma página pertence quanto pra escolher o `nivel` de
    // ATIV_ENSINO nas seções de perfil "disciplinas".
    const NOMES_SECAO = ['Graduação', 'Pós-Graduação', 'Pós-Graduação Lato', 'Extensão e Cultura'];

    function isWhitespace(str) { return !str || !str.trim(); }

    // Rodapé fixo de cada página — sempre numa faixa de y bem mais baixa que
    // qualquer linha real da tabela (~30, contra ~90+ da linha real mais
    // baixa observada).
    const Y_RODAPE = 45;
    function removerRodape(itensPagina) { return itensPagina.filter((i) => i.y >= Y_RODAPE); }

    function detectarNomeSecao(itensPagina) {
        const encontrado = itensPagina.find((i) => NOMES_SECAO.includes(i.str.trim()));
        return encontrado ? encontrado.str.trim() : null;
    }

    // Acha, numa página, a linha de cabeçalho (mesmo y) cujos textos batem
    // com algum perfil conhecido — devolve o perfil + a posição x de cada
    // coluna (início = x do próprio rótulo; fim = x do próximo rótulo, ou
    // +Infinity na última coluna).
    function detectarCabecalho(itensPagina) {
        for (const perfil of PERFIS_TABELA) {
            for (const item of itensPagina) {
                if (item.str !== perfil.cabecalho[0]) continue;
                const y = item.y;
                const candidatos = itensPagina.filter((i) => Math.abs(i.y - y) < 3 && !isWhitespace(i.str));
                const porTexto = new Map(candidatos.map((i) => [i.str, i]));
                if (!perfil.cabecalho.every((label) => porTexto.has(label))) continue;
                const xs = perfil.cabecalho.map((label) => porTexto.get(label).x);
                const colunas = perfil.cabecalho.map((label, idx) => ({
                    nome: label, xIni: xs[idx], xFim: idx + 1 < xs.length ? xs[idx + 1] : Infinity,
                }));
                return { perfil: perfil.nome, y, colunas };
            }
        }
        return null;
    }

    // Junta as linhas quebradas de uma célula (títulos/envolvimentos longos
    // que não cabem numa linha só) — sem espaço quando a linha anterior
    // termina em hífen de quebra de palavra (ex.: "VICE-" + "COORDENADOR(A)"
    // vira "VICE-COORDENADOR(A)", não "VICE- COORDENADOR(A)").
    function juntarLinhasCelula(linhasTexto) {
        let out = '';
        for (const parte of linhasTexto) {
            if (!parte) continue;
            out += out && !out.endsWith('-') ? ' ' + parte : parte;
        }
        return out.replace(/\s+/g, ' ').trim();
    }

    // Agrupa os itens de uma página (abaixo do cabeçalho) em linhas, usando
    // a coluna "#" (índice sequencial) como âncora de cada linha — células
    // que quebram em 2 linhas de PDF ficam deslocadas alguns pontos
    // acima/abaixo da âncora, então cada item é atribuído à âncora mais
    // próxima em y (nearest neighbor).
    function reconstruirLinhas(itensPagina, cabecalho) {
        const abaixoDoCabecalho = itensPagina.filter((i) => i.y < cabecalho.y - 2 && !isWhitespace(i.str));
        const colunaIndice = cabecalho.colunas[0];
        const ancoras = abaixoDoCabecalho
            .filter((i) => i.x >= colunaIndice.xIni - 5 && i.x < colunaIndice.xFim && /^\d+$/.test(i.str.trim()))
            .sort((a, b) => b.y - a.y);
        if (!ancoras.length) return [];

        const linhas = ancoras.map((a) => ({ indice: Number(a.str), celulas: cabecalho.colunas.map(() => []) }));
        for (const item of abaixoDoCabecalho) {
            let melhor = 0, melhorDist = Infinity;
            for (let i = 0; i < ancoras.length; i++) {
                const dist = Math.abs(ancoras[i].y - item.y);
                if (dist < melhorDist) { melhorDist = dist; melhor = i; }
            }
            const colIdx = cabecalho.colunas.findIndex((c) => item.x >= c.xIni - 5 && item.x < c.xFim);
            if (colIdx === -1) continue;
            linhas[melhor].celulas[colIdx].push(item);
        }
        return linhas.map((linha) => ({
            indice: linha.indice,
            valores: linha.celulas.map((itens) => juntarLinhasCelula(itens.sort((a, b) => b.y - a.y).map((i) => i.str.trim()))),
        }));
    }

    // Varre as páginas já extraídas (cada uma um array de {str,x,y}) e monta
    // as seções ({ nome, perfil, colunas, linhas }) — continuação de seção
    // em páginas seguintes (sem repetir o nome) é detectada mantendo a
    // seção corrente enquanto nenhum novo nome de seção aparecer.
    function parsePaginas(paginas) {
        const secoes = [];
        let secaoAtual = null;
        for (const itensPagina of paginas) {
            const semRodape = removerRodape(itensPagina);
            const nomeSecao = detectarNomeSecao(semRodape);
            if (nomeSecao) secaoAtual = null;
            const cabecalho = detectarCabecalho(semRodape);
            if (!cabecalho) continue;
            const linhas = reconstruirLinhas(semRodape, cabecalho);
            if (!secaoAtual) {
                secaoAtual = { nome: nomeSecao, perfil: cabecalho.perfil, colunas: cabecalho.colunas.map((c) => c.nome), linhas: [] };
                secoes.push(secaoAtual);
            }
            secaoAtual.linhas.push(...linhas);
        }
        return secoes;
    }

    /* --------------------- Extração via pdf.js (browser) ------------------ */
    // Carrega o PDF e devolve o texto posicionado de cada página, no mesmo
    // formato ({str,x,y}) que parsePaginas() espera — pdf.js precisa estar
    // carregado antes (ver <script> em index.html, define window.pdfjsLib).
    async function extrairPaginas(arrayBuffer) {
        if (!window.pdfjsLib) throw new Error('pdf.js não carregado — recarregue a página e tente de novo.');
        const doc = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const paginas = [];
        for (let p = 1; p <= doc.numPages; p++) {
            const page = await doc.getPage(p);
            const content = await page.getTextContent();
            paginas.push(content.items.map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5] })));
        }
        return paginas;
    }

    /* ------------------- Linha da tabela → candidato Lattes --------------- */
    // Converte "dd/mm/aaaa" pro formato canônico datebr (dígitos, mesma
    // ordem dd-mm-aaaa, sem separador — ver migrarCamposData em
    // app-core.js). Datas parciais (só o ano) já vêm assim do relatório.
    function paraDatebr(valor) {
        return String(valor || '').replace(/\D/g, '');
    }

    // Nome completo da instituição (pedido do Alexsandro — nome por extenso,
    // não a sigla sozinha) usado em todo campo "Instituição" dos candidatos:
    // o relatório é sempre da própria Unifesp.
    const INSTITUICAO_UNIFESP = 'Universidade Federal de São Paulo (Unifesp)';

    // Seção "Extensão e Cultura" (perfil "eventos"): cada linha vira 1 OU 2
    // candidatos, nunca escolhidos às cegas — regra confirmada pelo
    // Alexsandro:
    //   - Descrição = "CURSO DE EXTENSÃO" → sempre CURSO_MINISTRADO.
    //   - Descrição = "EVENTO": Coordenador/Vice-coordenador/Comissão
    //     científica/Supervisor → ORGANIZACAO_EVENTO; Palestrante →
    //     APRESENTACAO ("Apresentação de trabalho e palestra"). Uma linha
    //     com AS DUAS anotações (ex.: "COORDENADOR..., PALESTRANTE") vira
    //     candidato NOS DOIS tipos, não só um. Nenhuma das duas anotações
    //     presente (ex.: só "MODERADOR(A)") cai no fallback
    //     PARTICIPACAO_EVENTO de sempre.
    // Sempre com `typeKeyOpcoes` pra revisão poder trocar antes de
    // importar — nunca compromete o typeKey escolhido automaticamente.
    function candidatosDeLinhaEventos(linha) {
        const [, data, descricao, codigo, titulo, , envolvimento, ch] = linha.valores;
        const ano = paraDatebr(data);
        const cargaHoraria = parseFloat(String(ch).replace(',', '.')) || undefined;
        const extras = { código: codigo, envolvimento, ch };
        if (descricao.trim().toUpperCase() === 'CURSO DE EXTENSÃO') {
            return [{
                typeKeySugerido: 'CURSO_MINISTRADO', typeKeyOpcoes: ['CURSO_MINISTRADO', 'PARTICIPACAO_EVENTO'],
                titulo, avisos: [],
                fields: {
                    nivel: 'Extensão', titulo, ano, instituicao: INSTITUICAO_UNIFESP, idioma: 'Português', url: window.AppCore.NA_VALUE,
                    participacaoAutores: /COORDENADOR/i.test(envolvimento) ? 'Organizador' : 'Docente',
                    cargaHoraria, unidade: 'h',
                },
                extras,
            }];
        }
        const ehOrganizador = /COORDENADOR|COMISS[ÃA]O CIENT[ÍI]FICA|SUPERVISOR/i.test(envolvimento);
        const ehPalestrante = /PALESTRANTE/i.test(envolvimento);
        const out = [];
        if (ehPalestrante) {
            out.push({
                typeKeySugerido: 'APRESENTACAO', typeKeyOpcoes: ['APRESENTACAO', 'PARTICIPACAO_EVENTO'],
                titulo, avisos: ['Natureza da apresentação não vem no relatório — revise antes de importar.'],
                fields: { natureza: 'Conferência ou palestra', titulo, ano, evento: titulo, instituicao: INSTITUICAO_UNIFESP, idioma: 'Português', url: window.AppCore.NA_VALUE },
                extras,
            });
        }
        // Neste relatório, qualquer papel que NÃO seja só "Palestrante" é
        // organização (confirmado pelo Alexsandro) — cobre tanto os papéis
        // já reconhecidos como organizador (Coordenador/Vice-coordenador/
        // Comissão científica/Supervisor) quanto qualquer outro papel que a
        // heurística acima não reconheça (ex.: só "MODERADOR(A)"), sempre
        // com PARTICIPACAO_EVENTO como alternativa no dropdown de revisão
        // pra quem identificar um caso que realmente não é organização.
        if (ehOrganizador || !ehPalestrante) {
            out.push({
                typeKeySugerido: 'ORGANIZACAO_EVENTO', typeKeyOpcoes: ['ORGANIZACAO_EVENTO', 'PARTICIPACAO_EVENTO'],
                titulo, avisos: ['Tipo/Natureza do evento não vêm no relatório — revise antes de importar.'],
                fields: { tipoEvento: 'Outro', natureza: 'Organização', titulo, ano, instituicao: INSTITUICAO_UNIFESP, idioma: 'Português', url: window.AppCore.NA_VALUE },
                extras,
            });
        }
        return out;
    }

    // Seção de disciplinas (Graduação/Pós-Graduação/Pós-Graduação Lato,
    // perfil "disciplinas") — vira ATIV_ENSINO. Cargo/CH do relatório não
    // têm campo correspondente em ATIV_ENSINO — preservados em
    // `outrasInfo` em vez de descartados.
    const NIVEL_POR_SECAO = { Graduação: 'Graduação', 'Pós-Graduação': 'Pós-graduação', 'Pós-Graduação Lato': 'Especialização' };
    function candidatoDeLinhaDisciplinas(linha, nomeSecao) {
        const [, ano, codigo, disciplina, cargo, ch] = linha.valores;
        const nivel = NIVEL_POR_SECAO[nomeSecao] || 'Outros';
        return {
            origem: linha, typeKeySugerido: 'ATIV_ENSINO', typeKeyOpcoes: ['ATIV_ENSINO'],
            titulo: disciplina,
            avisos: ['Cargo e carga horária do relatório não têm campo correspondente — preservados em "Outras informações".'],
            fields: {
                instituicao: INSTITUICAO_UNIFESP, nivel, curso: disciplina, anoInicio: paraDatebr(ano), situacao: 'Anterior (finalizado)', anoFim: paraDatebr(ano),
                outrasInfo: `Código da disciplina: ${codigo} | Cargo: ${cargo} | Carga horária (relatório Unifesp): ${ch}`,
            },
            extras: { código: codigo, cargo, ch },
        };
    }

    // Monta os candidatos de TODAS as seções já reconstruídas — cada
    // candidato carrega a linha de origem (`origem`) pra a tela de revisão
    // poder mostrar exatamente o que veio do PDF, lado a lado com o que vai
    // ser gravado. Uma linha de "eventos" pode virar 2 candidatos (ver
    // candidatosDeLinhaEventos) — ex.: organizador E palestrante do mesmo
    // evento lançam nos dois lugares, não só um.
    function candidatos(secoes) {
        const out = [];
        for (const secao of secoes) {
            for (const linha of secao.linhas) {
                if (secao.perfil === 'eventos') {
                    for (const c of candidatosDeLinhaEventos(linha)) out.push({ secao: secao.nome, origem: linha, ...c });
                } else if (secao.perfil === 'disciplinas') {
                    out.push({ secao: secao.nome, ...candidatoDeLinhaDisciplinas(linha, secao.nome) });
                }
            }
        }
        return out;
    }

    // Ponto de entrada único: recebe o PDF (ArrayBuffer) e devolve os
    // candidatos prontos pra revisão — nunca cria itens no catálogo aqui
    // (isso é responsabilidade de quem chama, depois que o usuário
    // confirmar quais candidatos quer importar).
    async function parsePdf(arrayBuffer) {
        const paginas = await extrairPaginas(arrayBuffer);
        const secoes = parsePaginas(paginas);
        return { secoes, candidatos: candidatos(secoes) };
    }

    return {
        // pontas puras (sem pdf.js) — expostas pra teste direto com fixtures
        parsePaginas, detectarCabecalho, reconstruirLinhas, detectarNomeSecao,
        candidatosDeLinhaEventos, candidatoDeLinhaDisciplinas, candidatos,
        // ponta assíncrona (usa window.pdfjsLib)
        extrairPaginas, parsePdf,
    };
})();
