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
   lattesZen — Idiomas
   --------------------------------------------------------------------------
   Lista de idiomas (nome em português), na mesma ordem: os 7 idiomas em
   destaque no topo (Alemão…Português), seguidos pelos demais em ordem
   alfabética. Ver docs/IDIOMAS.md. Usada nos campos "Idioma" da aplicação
   (item Idiomas de Dados gerais, Idiomas e proficiências de Desenvolvimento
   Pessoal, e o Idioma/Idioma original/Idioma da tradução das Produções).

   window.IDIOMAS é { value, label }[] (ver opcoes() em i18n.js e nota em
   paises.js) — mesmo esquema: `value` sempre em português, `label`
   traduzido via chave `lattes.opcao.idiomas.<slug>`.
   ========================================================================== */
import { opcoes } from './i18n.js';

window.IDIOMAS = opcoes('idiomas', ["Alemão", "Espanhol", "Francês", "Inglês", "Italiano", "Libras", "Português", "Abhkazian", "Afar", "Afrikaans", "Aimara", "Albanês", "Amarico", "Árabe", "Armênio", "Assames", "Azerbaidjano", "Baluchi", "Basco", "Bashquir", "Bengali", "Berbere", "Bielo-Russo", "Bihari", "Birmanês", "Bislama", "Bretão", "Búlgaro", "Cabie", "Cachemiriano", "Cambodjano", "Canadá", "Casaque", "Catalão", "Chinês", "Cingalês", "Coreano", "Corsico", "Crioulo", "Croata", "Curdo", "Dinamarquês", "Divehi", "Dzongka", "Erisão", "Eslovaco", "Esloveno", "Esperanto", "Estoniano", "Eue", "Feróico", "Fijiano", "Filipino", "Finlandês", "Gaelico Escocês", "Galego", "Galês", "Georgiano", "Grego", "Groenlandês", "Guarani", "Gujarati", "Harmênio", "Hausa", "Hebraico", "Hindi", "Holandês", "Húngaro", "Iidiche", "Indonésio", "Interlíngua", "Interlíngue", "Inupiak", "Ioma", "Irlandês", "Islandês", "Japonês", "Javanês", "Laosiano", "Lapão", "Latim", "Letão", "Lingála", "Lituano", "Luxemburguês", "Macedônio", "Malaiala", "Malaio", "Malgaxe", "Maltês", "Mandingo", "Maori", "Maratí", "Moldavio", "Mongol", "Nauruano", "Nepali", "Norueguês", "Oria", "Oromo", "Persa", "Polonês", "Punjabi", "Pushto", "Quichua", "Quiniaruanda", "Quirquiz", "Quirundi", "Quisuahili", "Reto-Romano", "Romeno", "Russo", "Samoano", "Sango", "Sanscrito", "Serbian", "Servo-Croata", "Sesoto", "Setsuana", "Shona", "Sindi", "Sirmanês", "Sisvati", "Somali", "Suaili", "Sudanês", "Sueco", "Tadjique", "Tai", "Talagog", "Tamil", "Tatar", "Tcheco", "Telugo", "Tibetano", "Tigrina", "Tongalês", "Tsonga", "Tui", "Turco", "Turcomano", "Tuvaloano", "Ucraniâno", "Urdu", "Uzbeco", "Vietnamita", "Volupak", "Wolof", "Xosa", "Yoruba", "Zulú", "Outros"]);
