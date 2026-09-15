# POP-001 — Visão Geral e Preparação de Ambiente

**Objetivo:** dar ao técnico de infraestrutura o entendimento mínimo da
arquitetura do lattesZen antes de qualquer instalação, e listar os requisitos
reais de hardware e rede — que são **muito menores** do que num app
tradicional, porque **não há backend nem banco de dados**.

---

## 1. O que é o lattesZen

O lattesZen é um **site estático multi-arquivo** (HTML + CSS + JavaScript),
sem build de transpilação/bundling e **sem nenhum processo de servidor
próprio** (nenhum Node.js, PHP, Python etc. rodando em produção). Tudo o que
o usuário vê e faz roda **dentro do navegador dele**.

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  Navegador do usuário final │        │  Servidor (o que você opera)  │
│                              │        │                                │
│  index.html + css/ + js/  ◄─┼────────┼── HTTP(S) : entrega os         │
│  (toda a lógica do app)     │  GET    │   arquivos estáticos, só isso  │
│                              │        │                                │
│  Dados do currículo:         │        │  Não guarda NENHUM dado de     │
│  - localStorage do navegador │        │  usuário. Não tem banco de     │
│  - pasta local (File System  │        │  dados. Não processa nada.     │
│    Access API) OU            │        │                                │
│  - Google Drive do usuário   │        └──────────────────────────────┘
│    (opcional, direto do      │
│    navegador — sem passar     │
│    pelo seu servidor)        │
└─────────────────────────────┘
```

**Implicação prática mais importante para a operação:** o seu servidor
**nunca** recebe, processa ou armazena dados de currículo de ninguém. A
função dele é **100% de distribuição de arquivos estáticos** (como um CDN).
Isso elimina, por design, praticamente toda a preocupação tradicional de
backup de banco de dados, migrations, escalonamento de processos, etc. — os
POPs seguintes refletem essa realidade e **não vão pedir passos que não se
aplicam** (ex.: não há "dump do banco" no POP-006).

Node.js só é usado em **dois momentos que não são produção**:
1. No **pipeline de CI/CD** (GitHub Actions), para rodar a suíte de testes e
   montar a pasta publicável `dist/`.
2. Opcionalmente, por um **desenvolvedor** rodando testes localmente.

O servidor de produção nunca precisa ter Node.js instalado — só precisa
servir arquivos estáticos.

---

## 2. Requisitos mínimos de hardware

Como o servidor só entrega arquivos estáticos (o repositório inteiro,
incluindo imagens, pesa **~2 MB**), os requisitos são propositalmente
folgados — qualquer VPS de entrada atende:

| Recurso | Mínimo | Recomendado |
|---|---|---|
| CPU | 1 vCPU | 1 vCPU |
| RAM | 512 MB | 1 GB |
| Disco | 5 GB | 10 GB (folga para SO, logs, certificados TLS) |
| SO | Debian 11+/Ubuntu 22.04+ (ou equivalente) | idem |

> Se o tráfego crescer muito (milhares de visitantes simultâneos), o
> gargalo será do **servidor web** (Nginx/Apache) servindo conexões, não da
> aplicação em si — nesse caso, escale como escalaria qualquer site
> estático (CDN na frente, mais réplicas, etc.), não como escalaria um
> backend com banco de dados.

---

## 3. Dependências de rede

### 3.1 Portas de ENTRADA (o que o servidor precisa aceitar)

| Porta | Protocolo | Origem | Finalidade |
|---|---|---|---|
| 443 | HTTPS | Internet (público) | Servir o site aos visitantes |
| 80 | HTTP | Internet (público) | Redirecionamento para HTTPS (e desafio ACME do Let's Encrypt, se usado) |
| 22 (ou a porta configurada) | SSH | GitHub Actions (IPs dinâmicos) | Publicação automática do site (ver POP-006) |

> A porta SSH só precisa estar acessível pela internet porque os runners do
> GitHub Actions têm IPs dinâmicos (não há um IP fixo simples para
> allowlist). Se o seu firewall exige uma lista de IPs, consulte a lista
> oficial e mutável de faixas do GitHub em
> `https://api.github.com/meta` (chave `actions`) — mas isso exige
> automação para manter atualizado; a alternativa mais simples e comum é
> restringir por **chave SSH dedicada** (ver POP-002) em vez de por IP.

### 3.2 Portas de SAÍDA (o que o servidor precisa conseguir alcançar)

**Nenhuma.** Esse é o ponto que mais surpreende quem vem de aplicações
tradicionais: como o servidor só entrega arquivos estáticos e não chama
nenhuma API externa, **não é preciso liberar saída nenhuma** para o
funcionamento do site em si.

### 3.3 Dependências de rede do NAVEGADOR do usuário final (fora do seu servidor)

Estas conexões acontecem **do navegador de cada visitante**, não do seu
servidor — elas não aparecem no firewall do servidor, mas é útil o time de
suporte saber que existem, para diagnosticar reclamações de "o site está
com aparência estranha" ou "um botão não funciona":

| Domínio | Para quê | Essencial? |
|---|---|---|
| `cdn.tailwindcss.com` | Framework de estilo (Tailwind Play CDN) | Não — sem ele, o app usa um CSS de fallback (`no-tailwind`) e continua funcional |
| `cdnjs.cloudflare.com` | Ícones (Font Awesome) e a biblioteca `pdf-lib` (só ao gerar o Relatório PDF) | Não, exceto a função "Relatório completo (PDF)" |
| `cdngovbr-ds.estaleiro.serpro.gov.br` | Fonte tipográfica Rawline | Não — cai para a fonte padrão do sistema |
| `fonts.googleapis.com` / `fonts.gstatic.com` | Fontes dos temas visuais opcionais | Não |
| `www.googletagmanager.com` | Google Analytics (opcional, só se configurado e o visitante aceitar cookies) | Não |
| `zenodo.org` | Selo de DOI exibido na página "Sobre" | Não |
| `accounts.google.com`, `apis.google.com`, `www.googleapis.com`, `drive.google.com` | Integração opcional com Google Drive (armazenamento alternativo à pasta local) | Não, exceto para quem optar por usar o Drive |
| `api.crossref.org`, `pub.orcid.org` | Importação de metadados por DOI/ORCID | Não, exceto ao usar essas importações |
| `api.github.com`, `api.netlify.com`, `app.netlify.com` | Publicação direta da página pública do currículo (opcional) | Não, exceto quem usar essa função |

Todas essas dependências têm **degradação graciosa**: se algo estiver
bloqueado (proxy corporativo, ad-blocker, rede sem internet), o app avisa e
continua funcionando para o resto das funções — isso já é comportamento
testado na suíte de regressão do projeto (`tools/tests/`), não uma
suposição.

---

## 4. Pré-requisitos de software por ambiente de instalação

| Ambiente | Software necessário no servidor |
|---|---|
| Nativo Debian (POP-003) | Servidor web (Nginx ou Apache); opcionalmente `rsync` e `certbot` |
| Docker (POP-004) | Docker Engine + Docker Compose plugin |
| Hospedagem compartilhada (POP-005) | Nada a instalar — o painel (cPanel/Plesk) já fornece o servidor web |
| Pipeline de CI/CD (não roda no servidor de produção) | Nada — o Node.js 20 usado no build/testes roda só nos runners do GitHub Actions |

Prossiga para o **POP-002** para configurar as credenciais/variáveis antes
de instalar em qualquer um dos ambientes acima.
