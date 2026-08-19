/* ==========================================================================
   Harness de validação do exportador XML Lattes (uso em desenvolvimento)
   --------------------------------------------------------------------------
   Carrega os módulos de browser (lattes-types.js, encoding.js e
   lattes-xml-export.js) num "window" falso, gera um XML de amostra cobrindo
   TODOS os tipos exportáveis do catálogo e valida contra o schema oficial
   docs/CurriculoLattes.xsd usando `xmllint`.

   Uso:  node tools/xml-export-harness.mjs
   Sai com código !=0 se o XML gerado não validar.
   ========================================================================== */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'src', 'js');
const XSD = join(root, 'docs', 'CurriculoLattes.xsd');
const OUT = join(root, 'tools', '_sample-export.xml');

// "window" falso compartilhado por todos os módulos
const win = {};
function loadModule(file) {
    const code = readFileSync(join(SRC, file), 'utf8');
    // Executa o arquivo com `window` no escopo. O `with(window)` faz leituras
    // de identificadores "nus" (ex.: LATTES_CATEGORIES) resolverem em window,
    // replicando a semântica de globais do browser.
    new Function('window', 'document', 'with(window){' + code + '\n}')(win, undefined);
}

loadModule('lattes-types.js');
loadModule('encoding.js');
loadModule('lattes-xml-export.js');

const LattesTypes = win.LattesTypes;
const LzEncoding = win.LzEncoding;
const LattesXMLExport = win.LattesXMLExport;
if (!LattesXMLExport || typeof LattesXMLExport.build !== 'function') {
    console.error('ERRO: window.LattesXMLExport.build não encontrado.');
    process.exit(2);
}

/* ---- Gera um valor de amostra plausível para cada campo ---- */
function sampleValue(field, i) {
    const k = field.key;
    if (field.type === 'year') return String(2000 + (i % 24));
    if (field.type === 'date') return '2024-03-15';
    if (field.type === 'number') return '40';
    if (field.type === 'url') return 'https://example.org/item/' + i;
    if (field.type === 'select' && Array.isArray(field.options) && field.options.length) return field.options[i % field.options.length];
    if (field.type === 'checkbox') return i % 2 === 0 ? 'Sim' : 'Não';
    if (field.type === 'repeater') return [Object.fromEntries((field.columns || []).map(c => [c.key, sampleValue(c, i)]))];
    if (k === 'autores') return 'CARVALHO, A. C.; SILVA, J. P.';
    if (k === 'issn') return '1234-5678';
    if (k === 'isbn') return '978-85-333-0227-3';
    if (k === 'doi') return '10.1000/xyz' + i;
    if (k === 'paginas') return '100-115';
    if (k === 'ano') return String(2000 + (i % 24));
    if (k === 'pais') return 'Brasil';
    if (k === 'idioma') return 'Português';
    if (k === 'orcid') return '0000-0002-1825-0097';
    if (k === 'habilidades') return 'Leitura: Bom; Fala: Razoável; Escrita: Bom; Compreensão: Bom';
    if (k === 'areaConhecimento') return 'Ciências da Saúde › Medicina › Clínica Médica';
    // rótulo genérico
    return `${LattesTypes.label ? '' : ''}Amostra ${field.label || k} ${i}`;
}

/* ---- Monta um item de amostra por tipo exportável ---- */
function buildSampleItems() {
    const items = [];
    let i = 1;
    for (const cat of LattesTypes.categories) {
        const typeKeys = cat.groups ? cat.groups.flatMap(g => g.types) : (cat.types || []);
        for (const tk of typeKeys) {
            const def = LattesTypes.getType(tk);
            if (!def || def.noExport) continue;         // pula não-exportáveis
            const fields = {};
            (def.fields || []).forEach(f => { fields[f.key] = sampleValue(f, i); });
            // Perfil de área precisa dos campos separados
            if (tk === 'AREA_ATUACAO') {
                Object.assign(fields, { grandeArea: 'Ciências da Saúde', area: 'Medicina', subarea: 'Clínica Médica', especialidade: 'Cardiologia' });
            }
            items.push({ id: 'id' + i, typeKey: tk, categoryKey: cat.key, fields, inLattes: true, lattesItem: true });
            i++;
        }
    }
    // Garante os singletons de perfil (Identificação etc.) mesmo que perfil:true
    // — inclui Áreas de atuação, que também é perfil:true mas fora do laço de
    // categorias (editada em Configurações, não em Catalogar).
    for (const tk of (LattesTypes.perfilTypes ? LattesTypes.perfilTypes() : [])) {
        if (items.some(it => it.typeKey === tk)) continue;
        const def = LattesTypes.getType(tk);
        if (!def || def.noExport) continue;
        const fields = {};
        (def.fields || []).forEach(f => { fields[f.key] = sampleValue(f, i); });
        if (tk === 'AREA_ATUACAO') {
            Object.assign(fields, { grandeArea: 'Ciências da Saúde', area: 'Medicina', subarea: 'Clínica Médica', especialidade: 'Cardiologia' });
        }
        items.push({ id: 'id' + i, typeKey: tk, categoryKey: LattesTypes.primaryCategory(tk), fields, inLattes: true, lattesItem: true });
        i++;
    }
    return items;
}

const settings = { sigla: 'UNIFESP', numeroIdentificador: '' };
const items = buildSampleItems();
console.log(`Itens de amostra: ${items.length} (tipos exportáveis)`);

let xml;
try {
    xml = LattesXMLExport.build(items, settings);
} catch (e) {
    console.error('ERRO ao gerar XML:', e && e.stack || e);
    process.exit(3);
}

// Serializa em ISO-8859-1 (bytes reais) para validar como o Lattes espera
const bytes = LzEncoding.encodeLatin1Xml(xml);
writeFileSync(OUT, Buffer.from(bytes));
console.log(`XML gravado em ${OUT} (${bytes.length} bytes, ISO-8859-1)`);

// Valida com xmllint contra o XSD oficial
try {
    execFileSync('xmllint', ['--noout', '--schema', XSD, OUT], { stdio: 'pipe' });
    console.log('\n✅ VÁLIDO: o XML gerado obedece ao schema CurriculoLattes.xsd');
} catch (e) {
    const err = (e.stderr ? e.stderr.toString() : '') + (e.stdout ? e.stdout.toString() : '');
    console.error('\n❌ INVÁLIDO — erros do xmllint:\n');
    console.error(err.split('\n').slice(0, 60).join('\n'));
    process.exit(1);
}

// Valida também contra o DTD LMPL (gramática de IMPORTAÇÃO da Plataforma Lattes).
// O DTD de 2004 predata o atributo ORCID-ID (presente no XML real da plataforma),
// então essa única "no declaration" é aceita; qualquer outro erro é falha real.
const DTD = join(root, 'docs', 'LMPLCurriculo.DTD');
try {
    execFileSync('xmllint', ['--noout', '--dtdvalid', DTD, OUT], { stdio: 'pipe' });
    console.log('✅ VÁLIDO: o XML obedece ao DTD LMPL (importação Lattes).');
} catch (e) {
    const err = ((e.stderr ? e.stderr.toString() : '') + (e.stdout ? e.stdout.toString() : '')).split('\n');
    const reais = err.filter(l => /validity error/.test(l) && !/ORCID-ID/.test(l));
    if (reais.length) {
        console.error('\n❌ DTD LMPL INVÁLIDO — erros que quebram a importação no Lattes:\n');
        console.error(reais.slice(0, 60).join('\n'));
        process.exit(1);
    }
    console.log('✅ VÁLIDO: o XML obedece ao DTD LMPL — apenas ORCID-ID (extensão aceita).');
}
