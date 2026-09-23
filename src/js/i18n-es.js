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
   lattesZen — Diccionario es (español)
   --------------------------------------------------------------------------
   Traducción de las claves t()/tp() de la aplicación (ver i18n.js), en el
   mismo alcance que el diccionario en (i18n-en.js) — mismas claves, mismo
   set de módulos cubiertos. Clave de t() → string; clave de tp() → { um,
   outros } (mismos nombres de campo del diccionario pt-br — son solo
   etiquetas internas para singular/plural; regla idéntica en español:
   |n| === 1 usa `um`, el resto usa `outros`).

   Vocabulario: español académico internacional (términos ya consagrados en
   CVs/currículos académicos y en material en español de organismos de
   ciencia y tecnología), con atención a innovación y emprendimiento
   tecnológico y a la vida universitaria brasileña. Siglas y nombres propios
   brasileños específicos (RSC-PCCTAE, SIAPE, CNPq, CAPES, FAPESP,
   Plataforma Lattes) permanecen en portugués — son identificadores de
   leyes/sistemas/instituciones brasileñas sin equivalente en español, tal
   como "CPF" o "CNPJ" no se traducen.

   RSC-PCCTAE y Súmula Curricular FAPESP (tab-rsc.js, tab-catalogar-rsc.js,
   tab-sumula.js, y las secciones específicas de esos dos módulos en
   tab-config.js/tab-conformidade.js/tab-catalogar.js) NO tienen claves
   t()/tp() en el código — son programas exclusivamente brasileños y se
   quedan solo en portugués, sin excepción por idioma (misma decisión ya
   aplicada al diccionario en). Nada que traducir ahí.

   Importado por i18n.js y fusionado en DICIONARIOS['es'] ya en el bootstrap
   del módulo (antes del 1er localeValido()) — solo así `localeValido('es')`
   ya reconoce 'es' como válido incluso si es el locale persistido de quien
   abre la app (ver nota en i18n.js sobre la lectura síncrona de
   localStorage).

   Progreso: esqueleto vacío por ahora (Etapa 1 de la localización al
   español) — mientras esté vacío, t()/tp() siguen devolviendo el `padrao`
   en portugués para locale 'es' (comportamiento correcto e intencional:
   't() cae al padrão cuando la clave no existe en el diccionario activo').
   Las próximas etapas van llenando este objeto módulo por módulo, en el
   mismo orden usado para el diccionario en.
   ========================================================================== */
export const DICIONARIO_ES = {
};
