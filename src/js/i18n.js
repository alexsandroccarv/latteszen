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
   lattesZen — Infraestrutura de internacionalização (i18n)
   --------------------------------------------------------------------------
   Fase de preparação (pedido do Alexsandro): o app continua só em
   português, mas toda string voltada à pessoa usuária passa a viajar por
   t()/tp() em vez de aparecer como literal solta — para que, mais adiante,
   bastar carregar um dicionário por idioma (ex.: DICIONARIOS.en) sem
   precisar tocar de novo em cada arquivo/chamada.

   USO — t(chave, padrao, vars?):
     - `chave`: identificador estável, hierárquico (ex.: 'comum.salvar',
       'lattes.tipo.PROJETO_PESQUISA.label'). Vira a chave de busca no
       dicionário do idioma ativo.
     - `padrao`: o texto ATUAL em português, embutido na própria chamada —
       é o que aparece enquanto não houver dicionário carregado (ou nesta
       fase, sempre, já que só existe pt-BR) e também a matéria-prima do
       glossário que será extraído depois (issue futura: script varre as
       chamadas t() e monta a lista chave→texto pra tradução).
     - `vars` (opcional): variáveis pra interpolação — NUNCA usar `${var}`
       dentro de `padrao` (isso resolveria o valor ANTES de chegar em t(),
       virando uma chave "única" por valor de runtime, inútil pro
       glossário). Usar sempre `{var}` no texto + `{ var }` em `vars`.
       Ex.: t('rsc.aviso.pontos', '{n} ponto(s) faltando', { n: 3 }).

   USO — tp(chave, n, formasPadrao, vars?): variante plural. `formasPadrao`
   é `{ um, outros }` (português só tem singular/plural; um dicionário de
   outro idioma pode trazer mais formas, mas a esta altura só "um"/"outros"
   são consultados — Intl.PluralRules por locale fica pra quando houver de
   fato um 2º idioma).

   ACESSO — dois caminhos, conforme o padrão já usado no resto do app:
     - Arquivos com import/export (lattes-types-*.js, tab-catalogar-
       cadastrados.js etc.): `import { t, tp } from './i18n.js'` direto —
       necessário nos arquivos de taxonomia (lattes-types-*.js), que
       terminam de rodar ANTES de app-core.js no index.html (ordem dos
       <script>), então não podem depender de window.AppCore.t existir a
       tempo.
     - Arquivos "de topo" sem import próprio (app-core.js, tab-*.js — só
       compartilham estado via window): usar `window.AppCore.t`/`.tp`
       (app-core.js importa daqui e repassa, mesmo padrão de `state`/`esc`/
       `toast`). window.LzI18n existe também, como ponte de baixo nível —
       preferir window.AppCore.t nos módulos de aba, por consistência com
       o resto das utilidades já desestruturadas de lá.
   ========================================================================== */

export const LOCALE_PADRAO = 'pt-br';

// Dicionários en/es importados (não registrados via registrarDicionario)
// porque precisam existir em DICIONARIOS ANTES da primeira chamada de
// localeValido() logo abaixo — se o locale persistido de quem abre o app
// for 'en'/'es', localeValido() só reconhece como válido se a entrada já
// estiver aqui no bootstrap síncrono do módulo (ver lerLocalePersistido()/
// localeAtual mais abaixo). registrarDicionario() continua existindo pra
// dicionários carregados em runtime (ferramentas, testes).
import { DICIONARIO_EN } from './i18n-en.js';
import { DICIONARIO_ES } from './i18n-es.js';

// Dicionários por idioma. pt-br fica vazio de propósito — t()/tp() já
// funcionam com só o `padrao` embutido em cada chamada, que É o texto
// pt-br; um dicionário só precisa existir pra ter prioridade sobre esse
// padrao (ver registrarDicionario).
const DICIONARIOS = { [LOCALE_PADRAO]: {}, en: DICIONARIO_EN, es: DICIONARIO_ES };

// Cai pro padrão se pedirem um locale sem dicionário carregado — nunca deixa
// a UI "muda" por causa de um nome de locale errado/typo.
function localeValido(locale) { return DICIONARIOS[locale] ? locale : LOCALE_PADRAO; }

// Lê a preferência de locale já persistida (Configurações › geral) direto do
// localStorage, sem depender de Storage (storage.js carrega DEPOIS deste
// módulo no index.html) nem esperar app.js/init() rodar (só acontece bem
// depois, no fim da fila de <script>). Sem isto, o locale inicial deste
// módulo sempre seria o padrão — mesmo já havendo outro configurado —
// porque paises.js/idiomas.js/lattes-types-*.js (que chamam t()/opcoes()
// uma única vez, ao carregar) rodam ANTES de qualquer setLocale() explícito.
function lerLocalePersistido() {
    try {
        const chave = (window.APP_CONFIG && window.APP_CONFIG.storageKeys && window.APP_CONFIG.storageKeys.settings) || 'lz_settings';
        const cfg = JSON.parse(localStorage.getItem(chave));
        return (cfg && cfg.locale) || LOCALE_PADRAO;
    } catch (_) { return LOCALE_PADRAO; }
}

// Código interno de locale ('pt-br', minúsculo) → tag BCP 47 própria pra
// <html lang> e pra Intl (DateTimeFormat/NumberFormat/
// localeCompare): subtag de região em maiúsculas, resto como está
// ('pt-br' → 'pt-BR'; um locale sem região, ex. 'en', fica como está).
function paraBCP47(locale) {
    const [idioma, regiao] = locale.split('-');
    return regiao ? `${idioma}-${regiao.toUpperCase()}` : idioma;
}

// Reflete o locale ativo em <html lang>, tanto na carga inicial quanto em
// toda troca via setLocale() — sem isso o atributo ficava fixo em "pt-BR"
// no HTML estático, incoerente com o idioma efetivamente exibido assim que
// houver um 2º idioma.
function aplicarHtmlLang(locale) {
    if (typeof document === 'undefined' || !document.documentElement) return;
    document.documentElement.setAttribute('lang', paraBCP47(locale));
}

let localeAtual = localeValido(lerLocalePersistido());
aplicarHtmlLang(localeAtual);

export function getLocale() { return localeAtual; }
export function setLocale(locale) {
    localeAtual = localeValido(locale);
    aplicarHtmlLang(localeAtual);
    return localeAtual;
}
export function localesDisponiveis() { return Object.keys(DICIONARIOS); }
// Nome de exibição de um locale (pro seletor de idioma) — cai pro próprio
// código se ainda não houver nome cadastrado (locale novo sem tradução da UI
// ainda, ex. logo após registrarDicionario de um idioma novo).
const NOMES_LOCALE = { 'pt-br': 'Português (Brasil)', en: 'English', es: 'Español' };
export function nomeLocale(locale) { return NOMES_LOCALE[locale] || locale; }
// Só para ferramentas (import de um glossário, testes) — nunca chamado pela
// UI em si. Faz merge raso: chamadas repetidas acrescentam/sobrescrevem
// chaves sem apagar o que já estava carregado.
export function registrarDicionario(locale, entradas) {
    DICIONARIOS[locale] = Object.assign({}, DICIONARIOS[locale] || {}, entradas || {});
}

// Gera uma chave i18n estável a partir do valor da própria opção
// (minúsculas, sem acento, não-alfanumérico vira "_") — usada por
// opcoes() abaixo, sob um namespace por lista (evita colisão entre
// listas diferentes que compartilham um valor, ex. duas listas com
// "Outra").
export function slugOpcao(v) {
    return String(v).toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
// Converte uma lista de valores literais (formato antigo de `options`, e
// também as listas grandes — país/idioma/setor CNAE, ver paises.js/
// idiomas.js/cnae.js) numa lista de pares { value, label }: `value`
// continua o MESMO literal de sempre (armazenado no item, comparado em
// disabledWhen/enabledWhenCol/forceValueWhen/labelWhen/default, mapeado
// literalmente na exportação XML Lattes) — só `label` passa a ser
// traduzível via t(), com chave derivada automaticamente do próprio
// valor. Preserva 100% a compatibilidade com item já salvo e com o XML,
// sem exigir nenhuma migração de dado (quem lê `field.options` já aceita
// os dois formatos — string simples ou {value,label} —, ver optVal/
// optLabel em tab-catalogar.js).
export function opcoes(namespace, valores) {
    return valores.map(v => ({ value: v, label: t(`lattes.opcao.${namespace}.${slugOpcao(v)}`, v) }));
}

/* --------------------------------------------------------------------------
   Formatação sensível ao locale ativo — data/hora, número e comparação de
   texto (ordenação). Substitui hardcodes tipo `new Date().toLocaleDateString
   ('pt-BR')`/`x.localeCompare(y, 'pt-BR')` espalhados pelo app (pdf-report.js,
   rsc.js, storage.js etc.), que sempre formatavam/ordenavam em pt-BR mesmo
   que o locale ativo fosse outro. Todas usam paraBCP47(localeAtual), então
   acompanham setLocale() automaticamente — nenhum chamador precisa saber o
   locale ativo.
   -------------------------------------------------------------------------- */

// opcoes: as mesmas de Intl.DateTimeFormat (dateStyle/timeStyle etc.).
export function formatarData(data, opcoes) {
    return new Intl.DateTimeFormat(paraBCP47(localeAtual), opcoes).format(data);
}

// useGrouping desligado por padrão: os números formatados aqui (pontos do
// RSC, tamanhos de arquivo etc.) nunca tiveram separador de milhar — só o
// separador decimal muda por locale (1234.5 → "1234,5" em pt-BR, não
// "1.234,5"). Chamador pode religar via opcoes, se algum caso precisar.
export function formatarNumero(numero, opcoes) {
    return new Intl.NumberFormat(paraBCP47(localeAtual), Object.assign({ useGrouping: false }, opcoes)).format(numero);
}

// opcoes: as mesmas do 3º parâmetro de String.prototype.localeCompare
// (sensitivity etc.).
export function compararTexto(a, b, opcoes) {
    return String(a).localeCompare(String(b), paraBCP47(localeAtual), opcoes);
}

// `{nome}` → vars.nome. Chave não encontrada em `vars` fica como está no
// texto (visível de propósito — sinaliza uma variável esperada e não
// passada, em vez de sumir silenciosamente).
function interpolar(texto, vars) {
    if (!vars || typeof texto !== 'string') return texto;
    return texto.replace(/\{(\w+)\}/g, (m, nome) => (Object.prototype.hasOwnProperty.call(vars, nome) ? String(vars[nome]) : m));
}

export function t(chave, padrao, vars) {
    const dic = DICIONARIOS[localeAtual];
    const bruto = (dic && Object.prototype.hasOwnProperty.call(dic, chave)) ? dic[chave] : padrao;
    return interpolar(bruto, vars);
}

// formasPadrao: { um: '...', outros: '...' }. `n` decide a forma (só
// singular/plural, regra do português) — o dicionário pode substituir as
// formas inteiras (ex.: outro idioma com regras de plural diferentes),
// chave por chave, do mesmo jeito que t() substitui um texto simples.
export function tp(chave, n, formasPadrao, vars) {
    const dic = DICIONARIOS[localeAtual];
    const formas = (dic && dic[chave] && typeof dic[chave] === 'object') ? dic[chave] : formasPadrao;
    const forma = (Math.abs(n) === 1 && formas.um != null) ? formas.um : formas.outros;
    return interpolar(forma, Object.assign({ n }, vars));
}

if (typeof window !== 'undefined') {
    window.LzI18n = { t, tp, getLocale, setLocale, localesDisponiveis, nomeLocale, registrarDicionario, opcoes, slugOpcao, formatarData, formatarNumero, compararTexto, LOCALE_PADRAO };
}
