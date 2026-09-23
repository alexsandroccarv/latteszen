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
    // --- app.js ---
    'app.arquivo_invalido': 'Archivo inválido.',
    'app.arquivo_vazio': '"{nome}" está vacío.',
    'app.arquivo_muito_grande': '"{nome}" tiene {mb} MB — el límite es {limite} MB.',
    'app.tipo_nao_permitido': '"{nome}": tipo de archivo no permitido (aceptados: {tipos}).',
    'app.erro_armazenamento_cheio_catalogo': 'No fue posible guardar en el navegador (almacenamiento lleno). Exporte una copia de seguridad en Configuración y/o elimine elementos.',
    'app.erro_armazenamento_cheio_lixeira': 'No fue posible guardar la papelera (almacenamiento lleno).',
    'app.dirhealth_banner_permissao_gdrive': 'Sesión de Google Drive caducada o acceso revocado — vuelva a conectar en Configuración.',
    'app.dirhealth_banner_permissao_local': 'Sin permiso de acceso a la carpeta configurada — los archivos no se están guardando en ella. Verifique en Configuración.',
    'app.dirhealth_banner_network': 'No fue posible conectar con el almacenamiento remoto — verifique su conexión a internet.',
    'app.dirhealth_banner_notfound_gdrive': 'La carpeta de lattesZen no se encontró en Google Drive (puede haber sido movida o eliminada).',
    'app.dirhealth_banner_notfound_local': 'La carpeta configurada no se encontró (puede haber sido movida, renombrada o eliminada) — los archivos no se están guardando en ella.',
    'app.dirhealth_nao_verificado': 'Aún no verificado.',
    'app.dirhealth_acessivel': 'Accesible.',
    'app.dirhealth_status_permissao_gdrive': 'Sesión caducada o acceso revocado — haga clic en "Conectar a Google Drive" de nuevo.',
    'app.dirhealth_status_permissao_local': 'Sin permiso de acceso — haga clic en "Verificar carpeta" para concederlo de nuevo.',
    'app.dirhealth_status_network': 'Fallo de conexión con el almacenamiento remoto — verifique su internet.',
    'app.dirhealth_status_notfound_gdrive': 'Carpeta no encontrada en Google Drive — puede haber sido movida o eliminada.',
    'app.dirhealth_status_notfound_local': 'Carpeta no encontrada — puede haber sido movida, renombrada o eliminada.',
    'app.lembrete_backup': 'Ha realizado {n} cambios desde la última copia de seguridad. Exporte el catálogo en Configuración › Copia de seguridad.',
    'app.rascunho_encontrado': 'Se encontró un borrador sin guardar{rotulo}. Las evidencias no se guardan en el borrador.',
    'app.restaurar': 'Restaurar',
    'app.descartar': 'Descartar',
    'app.rascunho_restaurado': 'Borrador restaurado.',
    'app.item_salvo_falha_json': 'Elemento guardado en el índice, pero falló al escribir el JSON: {erro}',
    'app.catalogo_mudou_outra_aba': 'El catálogo cambió en otra pestaña — termine o cancele esta edición para ver los cambios.',
    'app.catalogo_atualizado_outra_aba': 'Catálogo actualizado desde otra pestaña abierta.',
    'app.configuracoes_mudaram_outra_aba': 'La configuración cambió en otra pestaña abierta. Recargue esta pestaña para ver la versión más reciente.',
    'app.diretorio_necessario_titulo': 'Configure un directorio de almacenamiento en Configuración › Almacenamiento antes de usar esta sección',
    'app.diretorio_necessario_toast': 'Configure un directorio de almacenamiento en Configuración › Almacenamiento antes de usar esta sección.',
    'tab_catalogar.confirmar_sair_nao_salvo': 'Hay cambios sin guardar en el formulario. ¿Salir de todos modos?',
    'app.migracao_gdrive_incompleta': 'Una migración a Google Drive quedó incompleta — vea Configuración › Almacenamiento para reanudarla o descartarla.',
    'app.sync_auto_falhas': ' Atención: no se pudieron leer {n} carpeta(s)/archivo(s) (¿red inestable?) — vaya a Configuración y haga clic en "Sincronizar" para intentar completarlo.',
    'app.sync_auto_encontrados': '{n} elemento(s) encontrado(s) en la carpeta configurada y sincronizados automáticamente.{aviso}',

    // --- app-core.js ---
    'app_core.fechar_aviso': 'Cerrar aviso',
    'app_core.erro_conectar_gdrive': 'Error al conectar con Google Drive: {erro}',
    'app_core.conecte_gdrive': 'Conecte Google Drive en Configuración antes de usar este botón.',
    'app_core.pasta_mais_proxima': 'Abriendo la carpeta existente más cercana — todavía no se ha subido ningún archivo aquí.',
    'app_core.issn_invalido_formato': 'ISSN inválido — use 8 dígitos en el formato NNNN-NNNC (ej.: 0378-5955).',
    'app_core.issn_invalido_digito': 'ISSN inválido — el dígito verificador no coincide.',
    'app_core.isbn10_invalido': 'ISBN-10 inválido — el dígito verificador no coincide.',
    'app_core.isbn13_invalido': 'ISBN-13 inválido — el dígito verificador no coincide.',
    'app_core.isbn_invalido_geral': 'ISBN inválido — indique 10 o 13 dígitos.',
    'app_core.doi_invalido': 'DOI inválido — formato esperado 10.xxxx/sufijo (ej.: 10.1000/xyz123).',
    'app_core.url_invalida_esquema': 'URL inválida — ese tipo de enlace no está permitido.',
    'app_core.url_invalida': 'URL inválida.',
    'app_core.email_invalido': 'Correo electrónico inválido.',
    'app_core.data_incompleta': 'Fecha incompleta — use el formato dd/mm/aaaa.',
    'app_core.data_invalida': 'Fecha inválida.',
    'app_core.telefone_invalido': 'Teléfono inválido — indique el código de área, ej.: (11) 91234-5678 (código de país opcional, ej.: +55).',

    // --- pdf-report.js ---
    'pdf_report.erro_pdflib_nao_apareceu': 'pdf-lib se cargó, pero window.PDFLib no apareció.',
    'pdf_report.erro_pdflib_conexao': 'No fue posible cargar la biblioteca de PDF (verifique su conexión a internet).',
    'pdf_report.rodape_gerado_em': 'Curriculum Vitae generado el {data} con el apoyo del software libre ',
    'pdf_report.rodape_desenvolvido_por': ' desarrollado por ',
    'pdf_report.erro_decodificar_imagem': 'Error al decodificar la imagen.',
    'pdf_report.evidencia_disponivel_em': 'Evidencia disponible en: {caminho}',
    'pdf_report.anexo_categoria': 'Anexo | {categoria}',
    'pdf_report.tipo_arquivo_nao_suportado': 'Los archivos de tipo ".{ext}" no se pueden incluir en el PDF — consulte la carpeta/Google Drive configurado para abrirlo.',
    'pdf_report.erro_incluir_arquivo': 'No fue posible incluir este archivo automáticamente ({motivo}).',
    'pdf_report.formato_invalido': 'formato inválido',
    'pdf_report.anexos': 'Anexos',
    'pdf_report.evidencias_em_link': 'Evidencias por enlace (dirección web, sin archivo para adjuntar)',
    'pdf_report.rotulo_orcid': 'ORCID: {orcid}',
    'pdf_report.contracapa_gerado_com': 'Informe completo generado con lattesZen',
    'pdf_report.sumario': 'Índice',
    'pdf_report.titulo_documento': 'Informe completo — {nome}',
    'pdf_report.subtitulo_capa_cv': 'Curriculum Vitae',
    'pdf_report.subtitulo_capa_evidencias': 'Evidencias',
    'pdf_report.memorial': 'Memorial',
    'pdf_report.anexo_romano_categoria': 'Anexo {romano} - {categoria}',
    'pdf_report.anexo_romano_evidencias_link': 'Anexo {romano} — Evidencias por enlace',
    'pdf_report.curriculo_completo': 'CV completo',
    'pdf_report.curriculo': 'CV',
    'pdf_report.nenhum_item_cadastrado': 'Aún no hay elementos registrados.',
    'pdf_report.anexos_evidencias': 'Anexos — Evidencias',

    // --- storage.js ---
    'storage.erro_sem_gdrive': 'Conecte Google Drive antes de usar esta función.',
    'storage.erro_download_arquivo': 'No fue posible descargar el contenido del archivo seleccionado.',
    'storage.erro_sem_pasta_local': 'No hay ninguna carpeta local configurada para migrar.',
    'storage.erro_sem_gdrive_migrar': 'Conecte Google Drive antes de migrar los archivos.',
    'storage.erro_sem_fs_api': 'El navegador no admite la File System Access API (use Chrome o Edge).',
    'storage.erro_sem_diretorio': 'No hay ningún directorio configurado. Vaya a Configuración y elija una carpeta.',
    'storage.erro_permissao_negada': 'Permiso de escritura denegado para el directorio.',
    'storage.pasta.processados': 'Procesados',
    'storage.erro_armazenamento_cheio': 'No fue posible guardar la configuración (almacenamiento lleno).',
    'storage.modulo.geral': 'general',
    'storage.modulo.acessibilidade': 'accesibilidad',
    'storage.modulo.nuvem_palavras': 'nube-palabras',
    'storage.modulo.publicar': 'publicar',

    // --- lattes-xml.js ---
    'lattes_xml.invalido': 'XML inválido o dañado.',
    'lattes_xml.erro_secao': '{tag}: {erro}',
    'lattes_xml.erro_atividades_atuacao': 'Actividades profesionales: {erro}',
    'lattes_xml.erro_projetos': 'Proyectos: {erro}',
    'lattes_xml.erro_dados_gerais': 'Datos generales: {erro}',
};
