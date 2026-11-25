# Funil da clínica: agendamento + atendimento

Agendamento online (**cal.diy**) ligado ao atendimento (**Chatwoot**) por uma pequena ponte. HTTPS automático com Caddy.

| Serviço | Endereço |
|---|---|
| Agendamento (cal.diy) | `https://agenda.robertrochateraoeuta.com.br` |
| Atendimento (Chatwoot) | `https://atendimento.robertrochateraoeuta.com.br` |
| Seu site (já existente) | `https://robertrochateraoeuta.com.br` (não é alterado) |

**Fluxo:** a pessoa chega pelo chat do site ou por um link → recebe o link de agendamento → agenda → a conversa no Chatwoot ganha a etiqueta `diagnostico-agendado` e uma nota privada com o horário.

## O que você precisa

- Um servidor Linux (VPS) com **Ubuntu 24.04**, **8 GB de RAM** (o build do cal.diy usa até ~6 GB; depois disso rodam com ~4 GB), **40 GB de disco**, IP público e as portas 80 e 443 liberadas.
- **Docker** com o plugin `docker compose`, e `git`.
- Acesso ao painel de DNS do domínio.
- Um serviço de envio de e-mail (SMTP): Brevo, Amazon SES, Resend, Zoho etc. Sem ele, lembretes e confirmações não saem.

## 1. DNS

No painel de DNS de `robertrochateraoeuta.com.br`, crie **dois registros A** apontando para o IP do servidor:

| Tipo | Nome | Valor |
|---|---|---|
| A | `agenda` | IP do servidor |
| A | `atendimento` | IP do servidor |

Não mexa no registro do domínio principal nem do `www` (é o seu site). Espere propagar antes de subir (o Caddy só emite o certificado HTTPS depois que os nomes resolvem para o servidor). Para o e-mail chegar na caixa de entrada, configure também SPF e DKIM do domínio, conforme o provedor de SMTP escolhido.

## 2. Instalação (no servidor)

```bash
git clone <URL-do-seu-repositorio> && cd <repositorio>/clinica-deploy

cp .env.example .env
nano .env                 # preencha ACME_EMAIL e os dados de SMTP; ajuste os endereços se quiser
scripts/gen-secrets.sh    # gera senhas e chaves (guarde uma cópia do .env em local seguro)

scripts/build-cal.sh      # constrói a imagem do cal.diy (10-20 min)
docker compose up -d      # sobe tudo
docker compose ps         # confira se está tudo "running"
```

## 3. Configurar o Chatwoot

1. Abra `https://atendimento.robertrochateraoeuta.com.br` e crie o administrador (o primeiro acesso mostra o formulário).
2. No Chatwoot: canto inferior esquerdo > **Configurações do perfil** > copie o **Token de acesso**.
3. Cole no `.env` em `CHATWOOT_API_TOKEN=` e rode:

```bash
python3 scripts/setup-chatwoot.py   # cria canais, etiquetas, respostas prontas e a regra de boas-vindas
docker compose up -d                # recria a ponte com o token
```

O script imprime o **código do chat** para colar no seu site, antes de `</body>`.

## 4. Configurar o cal.diy

1. Abra `https://agenda.robertrochateraoeuta.com.br/auth/setup` e crie o administrador com o nome de usuário **`clinica`** (ou outro, desde que igual a `CAL_USERNAME` no `.env`).
2. Conclua o onboarding. Na etapa do calendário, use **Skip for now**.
3. Crie dois tipos de evento (**Event types > New**):
   - **Sessão Diagnóstica**: endereço `sessao-diagnostica`, 30 min.
   - **Sessão Individual**: endereço `sessao-individual`, 50 min.
4. Rode:

```bash
scripts/setup-cal.sh   # fuso de São Paulo, disponibilidade seg-sex 9h-18h, esconde os exemplos e liga o webhook
```

## 5. Teste

Faça um agendamento de verdade em `https://agenda.robertrochateraoeuta.com.br/clinica/sessao-diagnostica` e confira no Chatwoot (canal **Agendamentos (Cal.diy)**) se a conversa apareceu com a etiqueta e a nota. Depois apague o contato e o agendamento de teste.

## Etapas que ficaram fora (precisam de contas suas)

- **WhatsApp e Instagram:** Chatwoot > Configurações > Caixas de entrada > Adicionar. WhatsApp exige a API oficial da Meta (conta Meta Business e um número).
- **Google Meet, Zoom e Google Agenda no cal.diy:** exigem criar credenciais OAuth no Google/Zoom e informá-las ao cal.diy. Sem isso, a sessão marcada não gera link de videochamada.
- **Pagamento de sessão:** não configurado.

## Segurança e LGPD (importante)

- Libere só as portas **22, 80 e 443** no firewall (`ufw allow 22,80,443/tcp && ufw enable`). Os bancos não ficam expostos.
- Ative a **verificação em duas etapas** no cal.diy (aparece um aviso laranja no topo) e no Chatwoot.
- Dados de saúde são dados pessoais sensíveis. Use acesso individual (um usuário por pessoa da equipe), trate o consentimento do paciente e **não registre conteúdo clínico** nas conversas do Chatwoot. Nenhuma das duas ferramentas é sistema de prontuário.
- **Backup:** agende `scripts/backup.sh` no cron e copie a pasta `backups/` para fora do servidor.
- O `.env` contém todos os segredos e **não deve ir para o GitHub** (já está no `.gitignore`).

## Atualizações

As versões estão fixadas: Chatwoot `v4.20.1-ce` no `docker-compose.yml`, cal.diy no commit indicado em `scripts/build-cal.sh`. Para atualizar, troque a versão, faça backup antes e rode `docker compose pull && docker compose up -d` (no cal.diy, rode `scripts/build-cal.sh` de novo).

## O que foi testado, e o que não foi

Testado num ambiente temporário (sem domínio real): o `docker-compose.yml` e o `Caddyfile` validam; os scripts `setup-chatwoot.py` e `setup-cal.sh` rodam e podem ser executados de novo sem duplicar nada; a ponte recebe um aviso de agendamento do cal.diy, recusa aviso sem assinatura válida e cria a conversa certa no Chatwoot; o fluxo completo (agendar na página pública → conversa no Chatwoot) funcionou.

**Não testado:** emissão de HTTPS com o domínio real, envio de e-mail (SMTP), a subida de todo este compose junto num servidor, e o `build-cal.sh` com o Dockerfile original (no ambiente de teste foi preciso um Dockerfile ajustado para passar pelo proxy). Se algum passo falhar, `docker compose logs <serviço>` mostra o motivo.

O README do cal.diy avisa que a edição "diy" é voltada a uso pessoal, não a produção. Se a agenda for central para a clínica, avalie o Cal.com comercial.
