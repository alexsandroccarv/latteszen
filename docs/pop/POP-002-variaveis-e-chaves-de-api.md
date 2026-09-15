# POP-002 — Configuração de Variáveis de Ambiente e Chaves de API

**Objetivo:** listar toda configuração sensível/externa do lattesZen e
ensinar, passo a passo, a gerar cada credencial — cobrindo os **dois
grupos completamente diferentes** que existem no projeto: (1) a
"configuração do app" (não é um `.env` de verdade — é um arquivo
JavaScript estático) e (2) os **secrets reais** do pipeline de deploy.

---

## 0. Por que não existe um arquivo `.env` aqui

O lattesZen não tem backend, então não há processo de servidor para ler
variáveis de ambiente em tempo de execução. A "configuração" do app inteiro
mora num único arquivo estático, carregado pelo navegador como qualquer
outro `.js`:

```
src/js/config.js
```

Isso significa uma diferença crítica de segurança em relação a um `.env`
tradicional: **tudo que estiver neste arquivo é público** — qualquer
visitante pode abrir o DevTools do navegador e ler o conteúdo dele. Por
isso, **nunca coloque um segredo de verdade** (senha, chave privada, client
secret) neste arquivo. As credenciais que o lattesZen usa aqui são todas do
tipo "client-side público" (OAuth Client ID, chave de API restrita por
domínio) — projetadas pelos próprios provedores (Google) para serem
expostas no navegador com segurança, desde que **restritas por domínio**
(ver seção 2).

Os segredos de verdade do projeto (usados só para publicar o site) ficam
nos **Secrets do GitHub Actions** — ver seção 3.

---

## 1. Grupo 1 — Configuração do app (`src/js/config.js`)

| Chave | Obrigatória? | O que é |
|---|---|---|
| `googleDriveClientId` | Não (feature opcional) | Client ID OAuth do Google Cloud, para o usuário conectar uma pasta do Google Drive como armazenamento alternativo à pasta local |
| `googlePickerApiKey` | Não (feature opcional) | Chave de API do Google Picker, para o botão "Selecionar arquivo do Google Drive" ao anexar evidências |
| `analyticsId` | Não (feature opcional, desligada por padrão) | ID de mensuração do Google Analytics (GA4) |

Enquanto qualquer uma dessas ficar vazia (ou com o valor de exemplo), a
funcionalidade correspondente aparece **desabilitada com um aviso** na
interface — o app nunca quebra por falta de uma dessas chaves.

### 1.1 Gerar o `googleDriveClientId`

1. Acesse `https://console.cloud.google.com/` e crie um projeto (ou
   reaproveite um existente).
2. **APIs e serviços → Biblioteca** → habilite a **"Google Drive API"**.
3. **APIs e serviços → Tela de consentimento OAuth** → tipo **"Externo"**;
   preencha nome do app e e-mail de suporte; em **Escopos**, adicione
   `https://www.googleapis.com/auth/drive.file` (escopo não-sensível — só
   exige verificação básica do Google se passar de 100 usuários de teste).
4. **Credenciais → Criar credenciais → ID do cliente OAuth** → tipo
   **"Aplicativo da Web"**; em **"Origens JavaScript autorizadas"**,
   adicione o domínio onde o lattesZen está publicado (ex.:
   `https://seusite.com`) e, para testes locais,
   `http://localhost:PORTA`.
5. Copie o **Client ID** gerado (formato
   `123...-abc....apps.googleusercontent.com`). **Não é preciso o "Client
   Secret"** — este app não tem backend; a autenticação é toda feita do
   navegador direto para o Google.

### 1.2 Gerar o `googlePickerApiKey`

1. No mesmo projeto do Google Cloud (ou outro, se preferir).
2. **APIs e serviços → Biblioteca** → habilite a **"Google Picker API"**.
3. **APIs e serviços → Credenciais → Criar credenciais → Chave de API**.
4. **(Recomendado)** Clique na chave gerada → **"Restrições de API"** →
   restrinja só à "Google Picker API"; em **"Restrições de aplicativo"**,
   escolha **"Referenciadores HTTP"** e adicione o domínio de publicação.
   > ⚠️ **Pegadinha comum:** `*.seusite.com/*` cobre só SUBdomínios (`www.`,
   > `app.` etc.), **não** o domínio nu. Se o app está em
   > `https://seusite.com/caminho/` (sem subdomínio), adicione **também**
   > `seusite.com/*` (sem o `*.`) — senão a chave falha com
   > `"The API developer key is invalid"` nesse domínio.
5. Copie a chave gerada.

### 1.3 Gerar o `analyticsId` (Google Analytics, opcional)

1. Acesse `https://analytics.google.com/` → **Administrador → Criar
   propriedade**.
2. Preencha nome, fuso horário e moeda.
3. Em **Fluxo de dados → Web**, informe a URL de publicação e um nome de
   fluxo.
4. O painel do fluxo mostra o **"ID de mensuração"** no formato
   `G-XXXXXXXXXX` — copie.

> Mesmo com um ID real configurado, nada é enviado ao Google até o
> visitante clicar em "Aceitar" no aviso de cookies do site (ver
> `js/cookie-consent.js`) — o analytics é opt-in por padrão.

### 1.4 Template de configuração (trecho relevante de `config.js`)

```js
window.APP_CONFIG = {
    // ... (demais chaves não relacionadas a credenciais externas)

    // OAuth Client ID (Google Drive) — não é segredo, mas deve ficar
    // restrito por domínio (ver passo a passo acima).
    googleDriveClientId: '123456789-abcdefg.apps.googleusercontent.com',

    // Chave de API do Google Picker — DIFERENTE do Client ID acima.
    googlePickerApiKey: 'AIzaSy...',

    // Google Analytics (GA4) — deixe 'G-XXXXXXXXXX' (valor de exemplo)
    // ou vazio para manter desligado.
    analyticsId: 'G-XXXXXXXXXX',
};
```

Edite **`src/js/config.js`** diretamente com os valores reais antes de
publicar (ver POP-003/004/005). Não crie um `.env` — ele **não seria lido**
por este app (não há processo de backend para carregá-lo).

---

## 2. Grupo 2 — Secrets reais do pipeline de deploy (GitHub Actions)

Estes **são segredos de verdade** e nunca aparecem no código-fonte nem no
navegador do usuário — ficam só no GitHub, usados exclusivamente pelo robô
de CI/CD para publicar o site no seu servidor via SSH.

| Secret | Obrigatório para deploy automático? | Exemplo |
|---|---|---|
| `SSH_HOST` | Sim | `servidor.example.com` |
| `SSH_USER` | Sim | `deploy` |
| `SSH_KEY` | Sim | conteúdo completo da chave **privada** SSH |
| `DEPLOY_PATH` | Sim | `/var/www/latteszen` |
| `SSH_PORT` | Não (padrão `22`) | `22` |

**Sem esses 5 secrets, o CI roda normalmente (testes + build) mas pula a
publicação silenciosamente** — não é um erro, é o comportamento esperado
até você configurá-los.

### 2.1 Onde cadastrar

No repositório GitHub:
**Settings → Secrets and variables → Actions → New repository secret**

### 2.2 Como gerar a chave SSH dedicada (`SSH_KEY`)

Veja o passo a passo completo — geração da chave, autorização no servidor
e cadastro do secret — no **POP-003, seção 3** (a chave é gerada uma vez e
serve para os três tipos de ambiente de destino: Debian nativo, Docker ou
hospedagem compartilhada).

> **Nunca reutilize sua chave SSH pessoal para o deploy.** Gere uma chave
> **dedicada**, sem senha (`-N ""`), e restrinja o usuário `SSH_USER` no
> servidor ao mínimo de permissões necessário (ver POP-008).

---

## 3. Checklist antes de prosseguir para a instalação

- [ ] `src/js/config.js` editado com Client ID/API Key/Analytics ID reais
      (ou deixados vazios/de exemplo, se as funções opcionais não forem
      usadas).
- [ ] Os 5 secrets do GitHub Actions cadastrados (se for usar o deploy
      automático — ver POP-006).
- [ ] Domínio final de publicação já definido (necessário para restringir
      as chaves do Google corretamente — voltar à seção 1.1/1.2 se o
      domínio mudar depois).
