# WhatsApp para lembretes (OpenWA)

Baseado no vídeo do @hudsonbrendon. Usa o [OpenWA](https://github.com/rmyndharis/OpenWA), que conecta ao WhatsApp via WhatsApp Web (**não oficial**).

## Quando usar cada coisa

| Uso | Ferramenta |
|---|---|
| Atendimento ao público, mensagens para clientes | **API oficial do WhatsApp (Cloud API)** |
| Lembretes, avisos internos, rotinas simples | **OpenWA** (este guia) |

Por que separar: o OpenWA não é oficial e o WhatsApp pode **banir o número** conectado. Por isso, use um **número secundário** (um chip só para isso) e nunca o número do atendimento. Se o número cair, você perde só os lembretes.

## Regras para reduzir o risco de banimento

- Use um número separado do atendimento.
- Nos primeiros dias, mande poucas mensagens e troque algumas com contatos salvos (evita parecer um "número novo disparando").
- Envie só para quem espera receber (você, equipe, clientes que pediram lembrete).
- Nada de disparo em massa ou lista fria. O `setup.sh` já liga o limite diário progressivo (`SEND_PACING_ENABLED=true`).
- Alguns números não conseguem vincular dispositivo (WhatsApp pede "passkey"). Se acontecer, não há ajuste no OpenWA que resolva.

## Passo a passo

Requisitos: Docker (com `docker compose`), git e um celular com o WhatsApp do número secundário.

### 1. Instalar e subir

```bash
cd openwa
./setup.sh
```

O script clona o OpenWA, cria o `.env` com a configuração para lembretes, sobe o container e **imprime a chave de admin**.
Se precisar ver a chave de novo: `docker exec openwa-api cat /app/data/.api-key`.

### 2. Entrar no painel

Abra `http://localhost:2785` e entre com a chave de admin.

### 3. Conectar o WhatsApp

1. Menu **Sessões** → criar sessão (nome livre, ex.: `lembretes`) → **Iniciar**.
2. No celular: WhatsApp → **Aparelhos conectados** → **Conectar um aparelho** → escaneie o QR code da tela.
3. Anote o **ID da sessão** (aparece no painel; também em `http://localhost:2785/api/docs`).

### 4. Criar uma chave para uso diário

No painel, **Chave API** → criar com perfil **operador** e marcar só a sessão `lembretes`. Copie a chave (ela aparece uma vez).
Use essa chave no dia a dia e guarde a de admin só para administrar.

### 5. Testar um lembrete

```bash
export OPENWA_API_KEY="chave-operador"
export OPENWA_SESSION_ID="id-da-sessao"
./enviar-lembrete.sh 5571999999999 "Lembrete: reunião hoje às 15h"
```

Número: DDI + DDD + número, só dígitos (Brasil: `55` + DDD + número).

### 6. Ligar ao Claude Code (opcional)

Copie `mcp.json.example` para `.mcp.json` na raiz do projeto, troque `COLE_AQUI_A_API_KEY_OPERADOR` pela chave de operador e reinicie o Claude Code. Depois dá para pedir "envie um lembrete para fulano" ou "qual foi a última mensagem que recebi?".

Por padrão o `.env` deixa `MCP_READONLY=false` (permite envio). Se quiser só leitura, troque para `true` em `OpenWA/.env` e rode `docker compose -f docker-compose.dev.yml up -d` na pasta `OpenWA`.

## Dia a dia

```bash
cd openwa/OpenWA
docker compose -f docker-compose.dev.yml logs -f   # ver logs
docker compose -f docker-compose.dev.yml down      # parar
docker compose -f docker-compose.dev.yml up -d     # subir de novo (a sessão volta sozinha)
```

Os dados (incluindo a sessão do WhatsApp) ficam em `openwa/OpenWA/data`. Faça backup se quiser evitar escanear o QR de novo.

## Segurança

- O serviço só escuta em `127.0.0.1`. Não exponha para a internet sem autenticação e HTTPS.
- Não commite a chave de API nem o `.mcp.json` (já estão no `.gitignore`).
- Quem tem a chave de operador envia mensagens como o seu número.
