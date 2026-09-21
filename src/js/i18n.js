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

// Dicionários por idioma. Vazio (exceto o registro da chave) nesta fase —
// t()/tp() já funcionam com só o `padrao` embutido em cada chamada; um
// dicionário só passa a ter prioridade quando for de fato carregado (ver
// registrarDicionario), o que ainda não acontece em lugar nenhum do app.
const DICIONARIOS = { [LOCALE_PADRAO]: {} };

// Cai pro padrão se pedirem um locale sem dicionário carregado — nunca deixa
// a UI "muda" por causa de um nome de locale errado/typo.
function localeValido(locale) { return DICIONARIOS[locale] ? locale : LOCALE_PADRAO; }

// Lê a preferência de locale já persistida (Configurações › geral) direto do
// localStorage, sem depender de Storage (storage.js carrega DEPOIS deste
// módulo no index.html) nem esperar app.js/init() rodar (só acontece bem
// depois, no fim da fila de <script>). Sem isto, o locale inicial deste
// módulo sempre seria o padrão — mesmo já havendo outro configurado —
// porque paises.js/idiomas.js/lattes-types-*.js (que chamam t()/resolveLista()
// uma única vez, ao carregar) rodam ANTES de qualquer setLocale() explícito.
function lerLocalePersistido() {
    try {
        const chave = (window.APP_CONFIG && window.APP_CONFIG.storageKeys && window.APP_CONFIG.storageKeys.settings) || 'lz_settings';
        const cfg = JSON.parse(localStorage.getItem(chave));
        return (cfg && cfg.locale) || LOCALE_PADRAO;
    } catch (_) { return LOCALE_PADRAO; }
}

let localeAtual = localeValido(lerLocalePersistido());

export function getLocale() { return localeAtual; }
export function setLocale(locale) {
    localeAtual = localeValido(locale);
    return localeAtual;
}
export function localesDisponiveis() { return Object.keys(DICIONARIOS); }
// Nome de exibição de um locale (pro seletor de idioma) — cai pro próprio
// código se ainda não houver nome cadastrado (locale novo sem tradução da UI
// ainda, ex. logo após registrarDicionario de um idioma novo).
const NOMES_LOCALE = { 'pt-br': 'Português (Brasil)' };
export function nomeLocale(locale) { return NOMES_LOCALE[locale] || locale; }
// Só para ferramentas (import de um glossário, testes) — nunca chamado pela
// UI em si. Faz merge raso: chamadas repetidas acrescentam/sobrescrevem
// chaves sem apagar o que já estava carregado.
export function registrarDicionario(locale, entradas) {
    DICIONARIOS[locale] = Object.assign({}, DICIONARIOS[locale] || {}, entradas || {});
}

// Resolve uma lista de valores grandes demais pra virar entradas de
// dicionário uma a uma (países, idiomas, setores de atividade — ver
// paises.js/idiomas.js/cnae.js) a partir de um prefixo (ex.: 'PAISES') +
// locale ativo: procura window['PAISES_' + locale] e, se esse idioma ainda
// não tiver a lista própria, cai pra window['PAISES_pt-br'] (sempre
// presente — é a lista original, nunca removida). Convenção deliberadamente
// à parte de t()/tp(): são arrays de centenas de itens onde o valor
// gravado no item É o próprio texto de exibição (ver nota em
// lattes-types-campos.js) — não dá pra virar {value, label} sem quebrar
// dados já salvos, então a lista inteira troca por locale em vez de cada
// item ganhar uma chave.
export function resolveLista(prefixo) {
    const doLocale = window[`${prefixo}_${localeAtual}`];
    if (Array.isArray(doLocale)) return doLocale;
    const doPadrao = window[`${prefixo}_${LOCALE_PADRAO}`];
    return Array.isArray(doPadrao) ? doPadrao : [];
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
    window.LzI18n = { t, tp, getLocale, setLocale, localesDisponiveis, nomeLocale, registrarDicionario, resolveLista, LOCALE_PADRAO };
}
