/* ==========================================================================
   Regressão: vazamento de listener em paste/input no #itemForm persistente
   (Fase 3 da auditoria — estabilidade #8).

   buildForm() é chamado de novo sobre o MESMO <form> a cada "Cancelar",
   "Salvar e novo", navegação Alt+↑/↓ etc. (só o innerHTML é recriado, o nó
   <form> em si persiste). Os listeners de "paste" (colar evidência) e
   "input" (marcar rascunho sujo) eram funções anônimas recriadas a cada
   chamada — sem a proteção que "submit" já tinha (mesma referência de
   função, ignorada pelo 2º addEventListener) — e se acumulavam: depois de N
   edições numa mesma sessão, um único Ctrl+V disparava N vezes, duplicando
   o arquivo colado como evidência. Ambos agora usam funções nomeadas e
   estáveis (onFormPaste/onFormInputDirty), então só há 1 listener de cada
   no <form>, não importa quantas vezes buildForm() rode.
   ========================================================================== */
import { test, assertEqual, seedCatalog, makeItem } from '../harness.mjs';

test('Colar (Ctrl+V) uma única vez não duplica a evidência mesmo após várias edições na mesma sessão', async ({ page, baseUrl }) => {
    // "Cancelar" só aparece em modo de EDIÇÃO de um item já existente
    // (state.catalogo.editingId) — por isso semeia um item real e abre-o via
    // buildForm(item) direto (mesma chamada que o botão "Editar" da
    // Conformidade faz), em vez de tentar reproduzir isso pela tela.
    const item = makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Teste', instituicao: 'X', anoFim: '2024' });
    await seedCatalog(page, baseUrl, [item]);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);

    async function abrirEdicao() {
        await page.evaluate((id) => {
            const it = window.AppCore.state.catalogo.items.find((i) => i.id === id);
            window.AppCore.buildForm(it);
        }, item.id);
        await page.waitForTimeout(100);
    }

    // Simula "N edições numa mesma sessão": cada "Cancelar" chama
    // buildForm() de novo sobre o MESMO <form> persistente (uma 1ª abertura
    // sozinha, sem nenhum Cancelar antes, não reproduzia o bug).
    await abrirEdicao();
    await page.click('#btnCancelar');
    await page.waitForTimeout(100);
    await abrirEdicao();
    await page.click('#btnCancelar');
    await page.waitForTimeout(100);
    await abrirEdicao();

    await page.evaluate(() => {
        const form = document.querySelector('#itemForm');
        const file = new File(['fake-bytes'], 'colado.png', { type: 'image/png' });
        const ev = new Event('paste', { bubbles: true, cancelable: true });
        ev.clipboardData = { items: [{ kind: 'file', getAsFile: () => file }] };
        form.dispatchEvent(ev);
    });
    await page.waitForTimeout(200);

    const nEvidencias = await page.$$eval('#evList li', (els) => els.length);
    assertEqual(nEvidencias, 1, `Um único Ctrl+V deveria anexar 1 evidência, obtido ${nEvidencias} (indica listener de paste duplicado)`);
});
