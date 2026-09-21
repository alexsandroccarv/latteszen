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
   lattesZen — Definições de tipo: 12-15 Atividades Livres ("Além do Lattes")
   --------------------------------------------------------------------------
   Extraído de lattes-types.js (issue de refatoração) — seção "12-15 Atividades Livres ("Além do Lattes")"
   da taxonomia Lattes, sem nenhuma mudança de conteúdo.

   i18n (preparação): label passa por t(); os arrays de `options` viram
   `{ value, label }` via opcoes() — `levels` (vocabulário fixo Bom/
   Razoável/Pouco, compartilhado por todo campo skilllevels) fica de fora
   — ver nota de arquitetura no topo de lattes-types-campos.js.
   ========================================================================== */
import { F_URL, F_AINI, F_AFIM, AL_ENT, AL_PAPEL, AL_FREQ, AL_IMP, AL_LOCAL, AL_ANO, alNome, opcoes } from './lattes-types-campos.js';
import { t } from './i18n.js';

export const TYPES_12_15_ALEM_LATTES = {
    // 12 — Desenvolvimento Pessoal e Habilidades (lista de tipos revisada a
    // pedido do usuário — ver types: em LATTES_CATEGORIES). AL_IDIOMAS e
    // AL_TREINAMENTO saem da lista selecionável: mantidos só por
    // compatibilidade com itens já catalogados (Idiomas já tem tipo próprio
    // em "01. Dados gerais", e Treinamentos/workshops passou a caber em
    // "Cursos livres e oficinas").
    AL_CURSO_LIVRE: { label: t('lattes.tipo.AL_CURSO_LIVRE.label', 'Cursos livres e oficinas'), fields: [alNome(t('lattes.tipo.AL_CURSO_LIVRE.campo.nome_curso', 'Nome do curso')), { key: 'entidade', label: t('lattes.tipo.AL_CURSO_LIVRE.campo.entidade.label', 'Instituição'), type: 'text' }, { key: 'frequencia', label: t('lattes.tipo.AL_CURSO_LIVRE.campo.frequencia.label', 'Carga horária'), type: 'text' }, { ...F_AINI, row: 'periodo' }, F_AFIM, AL_IMP, F_URL] },
    AL_IDIOMAS: { label: t('lattes.tipo.AL_IDIOMAS.label', 'Idiomas e proficiências'), fields: [{ key: 'titulo', label: t('lattes.tipo.AL_IDIOMAS.campo.titulo.label', 'Idioma'), type: 'select', options: window.IDIOMAS_LATTES || [], required: true }, { key: 'habilidades', label: t('lattes.tipo.AL_IDIOMAS.campo.habilidades.label', 'Proficiência (nível por habilidade)'), type: 'skilllevels', options: opcoes('idiomas_habilidades', ['Leitura', 'Fala', 'Escrita', 'Compreensão']), levels: ['Bom', 'Razoável', 'Pouco'] }, { key: 'entidade', label: t('lattes.tipo.AL_IDIOMAS.campo.entidade.label', 'Onde estudou'), type: 'text' }, { ...F_AINI, row: 'periodo' }, F_AFIM, AL_IMP] },
    AL_TREINAMENTO: { label: t('lattes.tipo.AL_TREINAMENTO.label', 'Treinamentos e workshops'), fields: [alNome(t('lattes.tipo.AL_TREINAMENTO.campo.nome', 'Nome')), AL_ENT, AL_PAPEL, AL_FREQ, { ...F_AINI, row: 'periodo' }, F_AFIM, AL_IMP, F_URL] },
    AL_MENTORIA: { label: t('lattes.tipo.AL_MENTORIA.label', 'Mentorias e grupos de estudos'), fields: [alNome(t('lattes.tipo.AL_MENTORIA.campo.nome', 'Nome')), AL_ENT, AL_PAPEL, AL_FREQ, { ...F_AINI, row: 'periodo' }, F_AFIM, AL_IMP, F_URL] },
    AL_PROJETO_PESSOAL: { label: t('lattes.tipo.AL_PROJETO_PESSOAL.label', 'Projetos pessoais e autoaprendizagem'), fields: [alNome(t('lattes.tipo.AL_PROJETO_PESSOAL.campo.nome_projeto', 'Nome do projeto')), AL_PAPEL, { ...F_AINI, row: 'periodo' }, F_AFIM, { key: 'frequencia', label: t('lattes.tipo.AL_PROJETO_PESSOAL.campo.frequencia.label', 'Frequência / Dedicação'), type: 'text' }, AL_IMP, F_URL] },

    // 13 — Engajamento Comunitário e Cidadania (lista revisada)
    AL_ATIVISMO: { label: t('lattes.tipo.AL_ATIVISMO.label', 'Ativismo, conselhos e comitês'), fields: [alNome(t('lattes.tipo.AL_ATIVISMO.campo.nome_cargo', 'Nome / Cargo')), { key: 'entidade', label: t('lattes.tipo.AL_ATIVISMO.campo.entidade.label', 'Entidade / Conselho'), type: 'text' }, AL_PAPEL, { ...F_AINI, row: 'periodo' }, F_AFIM, AL_IMP] },
    AL_VOLUNTARIADO: { label: t('lattes.tipo.AL_VOLUNTARIADO.label', 'Voluntariado e ação social'), fields: [alNome(t('lattes.tipo.AL_VOLUNTARIADO.campo.nome_atividade', 'Nome da atividade')), { key: 'entidade', label: t('lattes.tipo.AL_VOLUNTARIADO.campo.entidade.label', 'Organização'), type: 'text' }, AL_PAPEL, { ...F_AINI, row: 'periodo' }, F_AFIM, { key: 'frequencia', label: t('lattes.tipo.AL_VOLUNTARIADO.campo.frequencia.label', 'Carga horária / Frequência'), type: 'text' }, AL_IMP] },
    AL_LIDERANCA: { label: t('lattes.tipo.AL_LIDERANCA.label', 'Atuação comunitária e associativa'), fields: [alNome(t('lattes.tipo.AL_LIDERANCA.campo.nome_cargo', 'Nome / Cargo')), { key: 'entidade', label: t('lattes.tipo.AL_LIDERANCA.campo.entidade.label', 'Entidade / Associação'), type: 'text' }, AL_PAPEL, { ...F_AINI, row: 'periodo' }, F_AFIM, AL_IMP] },
    AL_ORG_EVENTO_COM: { label: t('lattes.tipo.AL_ORG_EVENTO_COM.label', 'Organização de iniciativas comunitárias'), fields: [alNome(t('lattes.tipo.AL_ORG_EVENTO_COM.campo.nome_iniciativa', 'Nome da iniciativa')), { key: 'entidade', label: t('lattes.tipo.AL_ORG_EVENTO_COM.campo.entidade.label', 'Entidade promotora'), type: 'text' }, AL_PAPEL, { ...AL_ANO, row: 'periodo' }, F_AFIM, AL_LOCAL, AL_IMP] },

    // 14 — Saúde, Esporte e Bem-Estar (lista revisada — os 4 tipos antigos
    // continuam, só com rótulos atualizados)
    AL_ESPORTE: { label: t('lattes.tipo.AL_ESPORTE.label', 'Prática esportiva regular e treinos'), fields: [alNome(t('lattes.tipo.AL_ESPORTE.campo.modalidade', 'Modalidade / Atividade')), { key: 'entidade', label: t('lattes.tipo.AL_ESPORTE.campo.entidade.label', 'Clube / Local'), type: 'text' }, AL_PAPEL, { ...F_AINI, row: 'periodo' }, F_AFIM, { key: 'frequencia', label: t('lattes.tipo.AL_ESPORTE.campo.frequencia.label', 'Frequência'), type: 'text' }, AL_IMP] },
    AL_COMPETICAO: { label: t('lattes.tipo.AL_COMPETICAO.label', 'Competições e torneios amadores'), fields: [alNome(t('lattes.tipo.AL_COMPETICAO.campo.competicao', 'Competição')), { key: 'entidade', label: t('lattes.tipo.AL_COMPETICAO.campo.entidade.label', 'Organizador'), type: 'text' }, { key: 'papel', label: t('lattes.tipo.AL_COMPETICAO.campo.papel.label', 'Categoria / Colocação'), type: 'text' }, { ...AL_ANO, row: 'periodo' }, F_AFIM, AL_LOCAL, { key: 'descricao', label: t('lattes.tipo.AL_COMPETICAO.campo.descricao.label', 'Resultado / Impacto'), type: 'textarea' }] },
    AL_EXPEDICAO: { label: t('lattes.tipo.AL_EXPEDICAO.label', 'Atividades ao ar livre e ecoturismo'), fields: [alNome(t('lattes.tipo.AL_EXPEDICAO.campo.atividade', 'Atividade / Trilha')), AL_LOCAL, { ...AL_ANO, row: 'periodo' }, F_AFIM, { key: 'frequencia', label: t('lattes.tipo.AL_EXPEDICAO.campo.frequencia.label', 'Distância / Duração'), type: 'text' }, AL_PAPEL, AL_IMP] },
    AL_BEMESTAR: { label: t('lattes.tipo.AL_BEMESTAR.label', 'Práticas corporais, integrativas e meditativas'), fields: [alNome(t('lattes.tipo.AL_BEMESTAR.campo.pratica', 'Prática')), AL_ENT, { key: 'frequencia', label: t('lattes.tipo.AL_BEMESTAR.campo.frequencia.label', 'Frequência'), type: 'text' }, { ...F_AINI, row: 'periodo' }, F_AFIM, AL_IMP] },

    // 15 — Interesses, Cultura e Lazer (lista bem ampliada — AL_CULTURAL,
    // genérico demais, se desdobra em vários tipos específicos abaixo;
    // mantido só por compatibilidade com itens já catalogados).
    AL_ESPECTADOR_ESPORTE: { label: t('lattes.tipo.AL_ESPECTADOR_ESPORTE.label', 'Assistência a eventos esportivos e lutas (espectador)'), fields: [alNome(t('lattes.tipo.AL_ESPECTADOR_ESPORTE.campo.evento', 'Evento assistido')), AL_LOCAL, { ...AL_ANO, row: 'periodo' }, F_AFIM, AL_IMP] },
    AL_CINEMA: { label: t('lattes.tipo.AL_CINEMA.label', 'Cinema, mostras e festivais audiovisuais'), fields: [alNome(t('lattes.tipo.AL_CINEMA.campo.filme', 'Filme / Mostra')), AL_LOCAL, { ...AL_ANO, row: 'periodo' }, F_AFIM, AL_IMP] },
    AL_COLECIONISMO: { label: t('lattes.tipo.AL_COLECIONISMO.label', 'Colecionismo e acervos pessoais'), fields: [alNome(t('lattes.tipo.AL_COLECIONISMO.campo.colecao', 'Coleção / Tema')), { key: 'descricao', label: t('lattes.tipo.AL_COLECIONISMO.campo.descricao.label', 'Descrição / Acervo'), type: 'textarea' }, F_AINI, { key: 'frequencia', label: t('lattes.tipo.AL_COLECIONISMO.campo.frequencia.label', 'Nº de itens / Frequência'), type: 'text' }, F_URL] },
    AL_ARTES_CENICAS: { label: t('lattes.tipo.AL_ARTES_CENICAS.label', 'Espetáculos cênicos (teatro, dança e circo)'), fields: [alNome(t('lattes.tipo.AL_ARTES_CENICAS.campo.espetaculo', 'Espetáculo')), AL_LOCAL, { ...AL_ANO, row: 'periodo' }, F_AFIM, AL_IMP] },
    AL_GASTRONOMIA: { label: t('lattes.tipo.AL_GASTRONOMIA.label', 'Experiências gastronômicas e degustações'), fields: [alNome(t('lattes.tipo.AL_GASTRONOMIA.campo.atividade', 'Atividade / Especialidade')), AL_PAPEL, { key: 'frequencia', label: t('lattes.tipo.AL_GASTRONOMIA.campo.frequencia.label', 'Frequência'), type: 'text' }, AL_IMP, F_URL] },
    AL_EXPOSICOES: { label: t('lattes.tipo.AL_EXPOSICOES.label', 'Exposições artísticas, museus e galerias'), fields: [alNome(t('lattes.tipo.AL_EXPOSICOES.campo.exposicao', 'Exposição / Museu')), AL_LOCAL, { ...AL_ANO, row: 'periodo' }, F_AFIM, AL_IMP] },
    AL_FEIRAS_CULTURAIS: { label: t('lattes.tipo.AL_FEIRAS_CULTURAIS.label', 'Feiras temáticas, convenções e festivais culturais'), fields: [alNome(t('lattes.tipo.AL_FEIRAS_CULTURAIS.campo.feira', 'Feira / Convenção')), AL_LOCAL, { ...AL_ANO, row: 'periodo' }, F_AFIM, AL_IMP] },
    AL_HOBBY: { label: t('lattes.tipo.AL_HOBBY.label', 'Hobbies e trabalhos manuais'), fields: [alNome(t('lattes.tipo.AL_HOBBY.campo.hobby', 'Hobby / Atividade')), AL_PAPEL, { key: 'frequencia', label: t('lattes.tipo.AL_HOBBY.campo.frequencia.label', 'Frequência'), type: 'text' }, { ...F_AINI, row: 'periodo' }, F_AFIM, AL_IMP, F_URL] },
    AL_JOGOS: { label: t('lattes.tipo.AL_JOGOS.label', 'Jogos de tabuleiro, eletrônicos e RPG'), fields: [alNome(t('lattes.tipo.AL_JOGOS.campo.jogo', 'Jogo / Grupo')), AL_PAPEL, { key: 'frequencia', label: t('lattes.tipo.AL_JOGOS.campo.frequencia.label', 'Frequência'), type: 'text' }, { ...F_AINI, row: 'periodo' }, F_AFIM, AL_IMP] },
    AL_LEITURA: { label: t('lattes.tipo.AL_LEITURA.label', 'Leituras e clubes do livro'), fields: [alNome(t('lattes.tipo.AL_LEITURA.campo.livro', 'Livro / Clube de leitura')), AL_PAPEL, { ...F_AINI, row: 'periodo' }, F_AFIM, AL_IMP] },
    AL_MUSICA: { label: t('lattes.tipo.AL_MUSICA.label', 'Shows, concertos e festivais musicais'), fields: [alNome(t('lattes.tipo.AL_MUSICA.campo.show', 'Show / Festival')), AL_LOCAL, { ...AL_ANO, row: 'periodo' }, F_AFIM, AL_IMP] },
    AL_CULTURAL: { label: t('lattes.tipo.AL_CULTURAL.label', 'Experiências culturais'), fields: [alNome(t('lattes.tipo.AL_CULTURAL.campo.experiencia', 'Experiência')), AL_LOCAL, { ...AL_ANO, row: 'periodo' }, F_AFIM, AL_IMP] },
    AL_VIAGENS: { label: t('lattes.tipo.AL_VIAGENS.label', 'Viagens, turismo e rotas culturais'), fields: [alNome(t('lattes.tipo.AL_VIAGENS.campo.viagem', 'Viagem / Roteiro')), AL_LOCAL, { ...AL_ANO, row: 'periodo' }, F_AFIM, AL_IMP] },
};
