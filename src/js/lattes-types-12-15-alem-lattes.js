/* ==========================================================================
   lattesZen — Definições de tipo: 12-15 Atividades Livres ("Além do Lattes")
   --------------------------------------------------------------------------
   Extraído de lattes-types.js (issue de refatoração) — seção "12-15 Atividades Livres ("Além do Lattes")"
   da taxonomia Lattes, sem nenhuma mudança de conteúdo.
   ========================================================================== */
import { F_URL, F_AINI, F_AFIM, AL_ENT, AL_PAPEL, AL_FREQ, AL_IMP, AL_LOCAL, AL_ANO, alNome } from './lattes-types-campos.js';

export const TYPES_12_15_ALEM_LATTES = {
    // 12 — Desenvolvimento Pessoal e Habilidades (lista de tipos revisada a
    // pedido do usuário — ver types: em LATTES_CATEGORIES). AL_IDIOMAS e
    // AL_TREINAMENTO saem da lista selecionável: mantidos só por
    // compatibilidade com itens já catalogados (Idiomas já tem tipo próprio
    // em "01. Dados gerais", e Treinamentos/workshops passou a caber em
    // "Cursos livres e oficinas").
    AL_CURSO_LIVRE: { label: 'Cursos livres e oficinas', fields: [alNome('Nome do curso'), { key: 'entidade', label: 'Instituição', type: 'text' }, { key: 'frequencia', label: 'Carga horária', type: 'text' }, { ...F_AINI, row: 'periodo' }, F_AFIM, AL_IMP, F_URL] },
    AL_IDIOMAS: { label: 'Idiomas e proficiências', fields: [{ key: 'titulo', label: 'Idioma', type: 'select', options: window.IDIOMAS_LATTES || [], required: true }, { key: 'habilidades', label: 'Proficiência (nível por habilidade)', type: 'skilllevels', options: ['Leitura', 'Fala', 'Escrita', 'Compreensão'], levels: ['Bom', 'Razoável', 'Pouco'] }, { key: 'entidade', label: 'Onde estudou', type: 'text' }, { ...F_AINI, row: 'periodo' }, F_AFIM, AL_IMP] },
    AL_TREINAMENTO: { label: 'Treinamentos e workshops', fields: [alNome('Nome'), AL_ENT, AL_PAPEL, AL_FREQ, { ...F_AINI, row: 'periodo' }, F_AFIM, AL_IMP, F_URL] },
    AL_MENTORIA: { label: 'Mentorias e grupos de estudos', fields: [alNome('Nome'), AL_ENT, AL_PAPEL, AL_FREQ, { ...F_AINI, row: 'periodo' }, F_AFIM, AL_IMP, F_URL] },
    AL_PROJETO_PESSOAL: { label: 'Projetos pessoais e autoaprendizagem', fields: [alNome('Nome do projeto'), AL_PAPEL, { ...F_AINI, row: 'periodo' }, F_AFIM, { key: 'frequencia', label: 'Frequência / Dedicação', type: 'text' }, AL_IMP, F_URL] },

    // 13 — Engajamento Comunitário e Cidadania (lista revisada)
    AL_ATIVISMO: { label: 'Ativismo, conselhos e comitês', fields: [alNome('Nome / Cargo'), { key: 'entidade', label: 'Entidade / Conselho', type: 'text' }, AL_PAPEL, { ...F_AINI, row: 'periodo' }, F_AFIM, AL_IMP] },
    AL_VOLUNTARIADO: { label: 'Voluntariado e ação social', fields: [alNome('Nome da atividade'), { key: 'entidade', label: 'Organização', type: 'text' }, AL_PAPEL, { ...F_AINI, row: 'periodo' }, F_AFIM, { key: 'frequencia', label: 'Carga horária / Frequência', type: 'text' }, AL_IMP] },
    AL_LIDERANCA: { label: 'Atuação comunitária e associativa', fields: [alNome('Nome / Cargo'), { key: 'entidade', label: 'Entidade / Associação', type: 'text' }, AL_PAPEL, { ...F_AINI, row: 'periodo' }, F_AFIM, AL_IMP] },
    AL_ORG_EVENTO_COM: { label: 'Organização de iniciativas comunitárias', fields: [alNome('Nome da iniciativa'), { key: 'entidade', label: 'Entidade promotora', type: 'text' }, AL_PAPEL, { ...AL_ANO, row: 'periodo' }, F_AFIM, AL_LOCAL, AL_IMP] },

    // 14 — Saúde, Esporte e Bem-Estar (lista revisada — os 4 tipos antigos
    // continuam, só com rótulos atualizados)
    AL_ESPORTE: { label: 'Prática esportiva regular e treinos', fields: [alNome('Modalidade / Atividade'), { key: 'entidade', label: 'Clube / Local', type: 'text' }, AL_PAPEL, { ...F_AINI, row: 'periodo' }, F_AFIM, { key: 'frequencia', label: 'Frequência', type: 'text' }, AL_IMP] },
    AL_COMPETICAO: { label: 'Competições e torneios amadores', fields: [alNome('Competição'), { key: 'entidade', label: 'Organizador', type: 'text' }, { key: 'papel', label: 'Categoria / Colocação', type: 'text' }, { ...AL_ANO, row: 'periodo' }, F_AFIM, AL_LOCAL, { key: 'descricao', label: 'Resultado / Impacto', type: 'textarea' }] },
    AL_EXPEDICAO: { label: 'Atividades ao ar livre e ecoturismo', fields: [alNome('Atividade / Trilha'), AL_LOCAL, { ...AL_ANO, row: 'periodo' }, F_AFIM, { key: 'frequencia', label: 'Distância / Duração', type: 'text' }, AL_PAPEL, AL_IMP] },
    AL_BEMESTAR: { label: 'Práticas corporais, integrativas e meditativas', fields: [alNome('Prática'), AL_ENT, { key: 'frequencia', label: 'Frequência', type: 'text' }, { ...F_AINI, row: 'periodo' }, F_AFIM, AL_IMP] },

    // 15 — Interesses, Cultura e Lazer (lista bem ampliada — AL_CULTURAL,
    // genérico demais, se desdobra em vários tipos específicos abaixo;
    // mantido só por compatibilidade com itens já catalogados).
    AL_ESPECTADOR_ESPORTE: { label: 'Assistência a eventos esportivos e lutas (espectador)', fields: [alNome('Evento assistido'), AL_LOCAL, { ...AL_ANO, row: 'periodo' }, F_AFIM, AL_IMP] },
    AL_CINEMA: { label: 'Cinema, mostras e festivais audiovisuais', fields: [alNome('Filme / Mostra'), AL_LOCAL, { ...AL_ANO, row: 'periodo' }, F_AFIM, AL_IMP] },
    AL_COLECIONISMO: { label: 'Colecionismo e acervos pessoais', fields: [alNome('Coleção / Tema'), { key: 'descricao', label: 'Descrição / Acervo', type: 'textarea' }, F_AINI, { key: 'frequencia', label: 'Nº de itens / Frequência', type: 'text' }, F_URL] },
    AL_ARTES_CENICAS: { label: 'Espetáculos cênicos (teatro, dança e circo)', fields: [alNome('Espetáculo'), AL_LOCAL, { ...AL_ANO, row: 'periodo' }, F_AFIM, AL_IMP] },
    AL_GASTRONOMIA: { label: 'Experiências gastronômicas e degustações', fields: [alNome('Atividade / Especialidade'), AL_PAPEL, { key: 'frequencia', label: 'Frequência', type: 'text' }, AL_IMP, F_URL] },
    AL_EXPOSICOES: { label: 'Exposições artísticas, museus e galerias', fields: [alNome('Exposição / Museu'), AL_LOCAL, { ...AL_ANO, row: 'periodo' }, F_AFIM, AL_IMP] },
    AL_FEIRAS_CULTURAIS: { label: 'Feiras temáticas, convenções e festivais culturais', fields: [alNome('Feira / Convenção'), AL_LOCAL, { ...AL_ANO, row: 'periodo' }, F_AFIM, AL_IMP] },
    AL_HOBBY: { label: 'Hobbies e trabalhos manuais', fields: [alNome('Hobby / Atividade'), AL_PAPEL, { key: 'frequencia', label: 'Frequência', type: 'text' }, { ...F_AINI, row: 'periodo' }, F_AFIM, AL_IMP, F_URL] },
    AL_JOGOS: { label: 'Jogos de tabuleiro, eletrônicos e RPG', fields: [alNome('Jogo / Grupo'), AL_PAPEL, { key: 'frequencia', label: 'Frequência', type: 'text' }, { ...F_AINI, row: 'periodo' }, F_AFIM, AL_IMP] },
    AL_LEITURA: { label: 'Leituras e clubes do livro', fields: [alNome('Livro / Clube de leitura'), AL_PAPEL, { ...F_AINI, row: 'periodo' }, F_AFIM, AL_IMP] },
    AL_MUSICA: { label: 'Shows, concertos e festivais musicais', fields: [alNome('Show / Festival'), AL_LOCAL, { ...AL_ANO, row: 'periodo' }, F_AFIM, AL_IMP] },
    AL_CULTURAL: { label: 'Experiências culturais', fields: [alNome('Experiência'), AL_LOCAL, { ...AL_ANO, row: 'periodo' }, F_AFIM, AL_IMP] },
    AL_VIAGENS: { label: 'Viagens, turismo e rotas culturais', fields: [alNome('Viagem / Roteiro'), AL_LOCAL, { ...AL_ANO, row: 'periodo' }, F_AFIM, AL_IMP] },
};
