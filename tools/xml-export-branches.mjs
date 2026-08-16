/* Teste de ramos: força TODOS os subtipos (níveis de formação, tipos de
   orientação/banca/participação, capítulo de livro) e valida contra o XSD. */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'src', 'js');
const XSD = join(root, 'docs', 'CurriculoLattes.xsd');
const OUT = join(root, 'tools', '_branches-export.xml');
const win = {};
const load = (f) => new Function('window', 'document', 'with(window){' + readFileSync(join(SRC, f), 'utf8') + '\n}')(win, undefined);
load('lattes-types.js'); load('encoding.js'); load('lattes-xml-export.js');
const { LattesXMLExport, LzEncoding } = win;

let n = 0; const mk = (typeKey, categoryKey, fields) => ({ id: 'b' + (++n), typeKey, categoryKey, fields, inLattes: true });
const items = [];
// Identificação
items.push(mk('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulano de Tal', citacoes: 'TAL, F.', nacionalidade: 'Brasileira', pais: 'Brasil', orcid: '0000-0002-1825-0097' }));
// Formação — todos os níveis
['Graduação', 'Especialização', 'Aperfeiçoamento', 'Mestrado', 'Doutorado', 'Curso técnico', 'Ensino fundamental', 'Ensino médio', 'Residência médica'].forEach(nivel =>
    items.push(mk('FORMACAO_ACADEMICA', 'FORMACAO', { nivel, curso: 'Curso ' + nivel, instituicao: 'UNIFESP', anoInicio: '2010', anoFim: '2014', titulo: 'Trabalho', orientador: 'Orientador X', coorientador: 'Co Y', bolsa: 'CAPES' })));
items.push(mk('POS_DOUTORADO', 'FORMACAO', { tipo: 'Pós-Doutorado', instituicao: 'USP', anoInicio: '2015', anoFim: '2016', titulo: 'PD', bolsa: 'FAPESP' }));
items.push(mk('POS_DOUTORADO', 'FORMACAO', { tipo: 'Livre-docência', instituicao: 'USP', anoFim: '2018', titulo: 'LD' }));
// Livro e capítulo
items.push(mk('LIVRO_CAPITULO', 'PRODUCOES', { tipoObra: 'Livro publicado', titulo: 'Meu Livro', ano: '2020', autores: 'TAL, F.', editora: 'Ed', cidade: 'SP', isbn: '978-1', paginas: '200' }));
items.push(mk('LIVRO_CAPITULO', 'PRODUCOES', { tipoObra: 'Capítulo de livro', titulo: 'Meu Capítulo', ano: '2021', autores: 'TAL, F.; X, Y', tituloLivro: 'Coletânea', organizadores: 'Org Z', editora: 'Ed', paginas: '10-30', isbn: '978-2' }));
// Orientações concluídas — todas as naturezas + campos novos (modalidade só em
// Mestrado, idioma, home page, palavras-chave, área do conhecimento, outras informações)
['Mestrado', 'Doutorado', 'Pós-Doutorado', 'Especialização / Monografia', 'TCC / Graduação', 'Iniciação científica', 'Outra'].forEach(tipo =>
    items.push(mk('ORIENTACAO_CONCLUIDA', 'ORIENTACOES', {
        orientando: 'Aluno ' + tipo, tipo, modalidade: tipo === 'Mestrado' ? 'Profissionalizante' : '',
        natureza: 'Orientador principal', titulo: 'Tese ' + tipo, curso: 'PPG', instituicao: 'UNIFESP', bolsa: 'CNPq',
        ano: '2019', pais: 'Brasil', idioma: 'Português', url: 'https://example.org/orientacao',
        palavrasChave: 'clima; saúde', grandeArea: 'Ciências da Saúde', area: 'Medicina', subarea: 'Clínica Médica',
        especialidade: 'Cardiologia', outrasInfo: 'Observação livre.',
    })));
// Orientações em andamento — todas as naturezas + mesmos campos novos
['Mestrado', 'Doutorado', 'Pós-Doutorado', 'Especialização / Monografia', 'TCC / Graduação', 'Iniciação científica', 'Outra'].forEach(tipo =>
    items.push(mk('ORIENTACAO_ANDAMENTO', 'ORIENTACOES', {
        orientando: 'And ' + tipo, tipo, modalidade: tipo === 'Mestrado' ? 'Acadêmico' : '',
        natureza: 'Coorientador', titulo: 'Trab ' + tipo, curso: 'PPG', instituicao: 'UNIFESP',
        ano: '2024', pais: 'Brasil', idioma: 'Português', url: 'https://example.org/orientacao-andamento',
        palavrasChave: 'clima; saúde', grandeArea: 'Ciências da Saúde', area: 'Medicina', subarea: 'Clínica Médica',
        especialidade: 'Cardiologia', outrasInfo: 'Observação livre.',
    })));
// Bancas de conclusão — todas as naturezas + campos novos (modalidade só em
// Mestrado, país/idioma/home page, palavras-chave, área do conhecimento, outras informações)
[
    { tipo: 'Mestrado', modalidade: 'Acadêmico' },
    { tipo: 'Doutorado' },
    { tipo: 'Exame de qualificação de mestrado' },
    { tipo: 'Exame de qualificação de doutorado' },
    { tipo: 'Curso de aperfeiçoamento/especialização' },
    { tipo: 'Graduação' },
].forEach(({ tipo, modalidade }) => items.push(mk('BANCA_CONCLUSAO', 'BANCAS', {
    tipo, modalidade, candidato: 'Cand ' + tipo, titulo: 'Banca ' + tipo, curso: 'PPG', instituicao: 'UNIFESP',
    membros: 'Prof A; Prof B', ano: '2022', pais: 'Brasil', idioma: 'Português', url: 'https://example.org/banca',
    palavrasChave: 'chuva; seca; clima', grandeArea: 'Ciências da Saúde', area: 'Medicina', subarea: 'Clínica Médica',
    especialidade: 'Cardiologia', outrasInfo: 'Observação livre.',
})));
// Bancas julgadoras — todas as naturezas + campos novos
['Concurso público', 'Professor titular', 'Livre-docência', 'Avaliação de cursos', 'Outra'].forEach(tipo =>
    items.push(mk('BANCA_JULGADORA', 'BANCAS', {
        tipo, titulo: 'Julg ' + tipo, instituicao: 'UNIFESP', membros: 'Prof A; Prof B', ano: '2023',
        pais: 'Brasil', idioma: 'Português', url: 'https://example.org/banca-julgadora',
        palavrasChave: 'gestão; avaliação', grandeArea: 'Ciências Sociais Aplicadas', area: 'Administração',
        outrasInfo: 'Observação livre.',
    })));
// Participação em eventos — todas as naturezas
['Congresso', 'Seminário', 'Simpósio', 'Oficina', 'Encontro', 'Olimpíada', 'Feira', 'Exposição', 'Outra'].forEach(natureza =>
    items.push(mk('PARTICIPACAO_EVENTO', 'EVENTOS', { titulo: 'Evento ' + natureza, natureza, formaParticipacao: 'Participante', tipoParticipacao: 'Conferencista', tituloApresentacao: 'Palestra', classificacao: 'Nacional', ano: '2023', pais: 'Brasil', cidade: 'SP' })));
// Licenças
items.push(mk('LICENCA', 'DADOS_GERAIS', { titulo: 'Licença', tipo: 'Maternidade', anoInicio: '2020', anoFim: '2020' }));
items.push(mk('LICENCA', 'DADOS_GERAIS', { titulo: 'Licença', tipo: 'Paternidade' }));
// Patente com datas
items.push(mk('PATENTE', 'PATENTES_REGISTROS', { titulo: 'Invento', ano: '2020', autores: 'TAL, F.', categoria: 'Nacional', finalidade: 'X', registro: 'BR123', dataDeposito: '2019-05-10', dataConcessao: '2022-08-01', situacao: 'Concedida', instituicao: 'UNIFESP', pais: 'Brasil' }));
// Atuação com atividades
items.push(mk('VINCULO_PROFISSIONAL', 'ATUACAO', { instituicao: 'UNIFESP', vinculo: 'Servidor', cargo: 'Professor', regime: 'Dedicação exclusiva', cargaHoraria: '40', anoInicio: '2010', anoFim: '' }));
items.push(mk('ATIV_ENSINO', 'ATUACAO', { titulo: 'Graduação em Medicina', instituicao: 'UNIFESP', anoInicio: '2011', anoFim: '2020', disciplinas: 'Anatomia; Fisiologia' }));
items.push(mk('ATIV_DIRECAO', 'ATUACAO', { titulo: 'Coordenador', orgao: 'Departamento', instituicao: 'UNIFESP', anoInicio: '2015', anoFim: '2017' }));
items.push(mk('ATIV_CONSELHO', 'ATUACAO', { titulo: 'Conselho X', papel: 'Membro', instituicao: 'UNIFESP', anoInicio: '2016', anoFim: '2018' }));

const xml = LattesXMLExport.build(items, { numeroIdentificador: '1234567890123456' });
const bytes = LzEncoding.encodeLatin1Xml(xml);
writeFileSync(OUT, Buffer.from(bytes));
console.log(`Itens: ${items.length} — XML ${bytes.length} bytes`);
try {
    execFileSync('xmllint', ['--noout', '--schema', XSD, OUT], { stdio: 'pipe' });
    console.log('✅ VÁLIDO no XSD (todos os ramos)');
} catch (e) {
    console.error('❌ INVÁLIDO (XSD):\n' + ((e.stderr || '') + (e.stdout || '')).toString().split('\n').slice(0, 40).join('\n'));
    process.exit(1);
}
// DTD LMPL (importação Lattes) — ignora só ORCID-ID (extensão que o DTD 2004 predata)
const DTD = join(root, 'docs', 'LMPLCurriculo.DTD');
try {
    execFileSync('xmllint', ['--noout', '--dtdvalid', DTD, OUT], { stdio: 'pipe' });
    console.log('✅ VÁLIDO no DTD LMPL (todos os ramos)');
} catch (e) {
    const reais = ((e.stderr || '') + (e.stdout || '')).toString().split('\n').filter(l => /validity error/.test(l) && !/ORCID-ID/.test(l));
    if (reais.length) { console.error('❌ INVÁLIDO (DTD LMPL):\n' + reais.slice(0, 40).join('\n')); process.exit(1); }
    console.log('✅ VÁLIDO no DTD LMPL (todos os ramos) — só ORCID-ID (aceito)');
}
