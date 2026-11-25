#!/usr/bin/env python3
"""Configura o Chatwoot do funil: canais, etiquetas, respostas prontas e a regra de boas-vindas.
Rode DEPOIS de criar o administrador e de colocar CHATWOOT_API_TOKEN no .env. Pode rodar de novo sem duplicar."""
import json, os, sys, urllib.request, urllib.error

def load_env(path):
    env = {}
    for line in open(path, encoding='utf-8'):
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1); env[k] = v
    return env

ENV = load_env(os.path.join(os.path.dirname(__file__), '..', '.env'))
BASE = ENV.get('CHATWOOT_BASE_URL') or f"https://{ENV['CHATWOOT_HOST']}/api/v1/accounts/1"  # CHATWOOT_BASE_URL: só para testes
TOKEN = ENV.get('CHATWOOT_API_TOKEN', '')
if not TOKEN:
    sys.exit('Preencha CHATWOOT_API_TOKEN no .env (Perfil > Token de acesso).')
LINK = f"https://{ENV['CAL_HOST']}/{ENV.get('CAL_USERNAME', 'clinica')}/sessao-diagnostica"

def call(method, path, body=None):
    req = urllib.request.Request(BASE + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'api_access_token': TOKEN, 'Content-Type': 'application/json'})
    try:
        t = urllib.request.urlopen(req, timeout=30).read().decode()
        return json.loads(t) if t else {}
    except urllib.error.HTTPError as e:
        sys.exit(f'{method} {path} -> {e.code}: {e.read().decode()[:300]}')

call('PATCH', '', {'locale': 'pt_BR'})

# 1) canais
inboxes = {i['name']: i for i in call('GET', '/inboxes').get('payload', [])}
SITE = 'Atendimento do Site'
if SITE not in inboxes:
    inboxes[SITE] = call('POST', '/inboxes', {'name': SITE, 'channel': {
        'type': 'web_widget', 'website_url': ENV['SITE_URL'], 'widget_color': '#1f93ff',
        'welcome_title': 'Olá! 👋', 'welcome_tagline': 'Conte como podemos ajudar ou agende sua sessão diagnóstica.'}})
    print('canal criado:', SITE)
API = 'Agendamentos (Cal.diy)'
if API not in inboxes:
    inboxes[API] = call('POST', '/inboxes', {'name': API, 'channel': {'type': 'api'}})
    print('canal criado:', API)
site_id = inboxes[SITE]['id']

# 2) etiquetas do funil
have = {l['title'] for l in call('GET', '/labels').get('payload', [])}
for t, d, c in [('novo-contato', 'Entrou em contato', '#1f93ff'), ('interessado', 'Quer saber mais', '#f5a623'),
                ('diagnostico-agendado', 'Sessão diagnóstica marcada', '#2ecc71'),
                ('paciente-ativo', 'Em acompanhamento', '#7b61ff'), ('sem-retorno', 'Sem resposta após follow-up', '#999999')]:
    if t not in have:
        call('POST', '/labels', {'title': t, 'description': d, 'color': c, 'show_on_sidebar': True}); print('etiqueta:', t)

# 3) respostas prontas (digite "/" no Chatwoot)
have = {c['short_code'] for c in call('GET', '/canned_responses')}
for code, text in [
    ('agendar', 'Você pode escolher o melhor dia e horário para a sua sessão diagnóstica por aqui: ' + LINK),
    ('boasvindas', 'Olá! Obrigado pelo contato. Em que posso ajudar? Se preferir, já pode agendar uma sessão diagnóstica: ' + LINK),
    ('confirmacao', 'Sua sessão diagnóstica está confirmada. Você recebe o lembrete por e-mail. Se precisar remarcar, é só responder aqui.'),
    ('followup', 'Oi! Passando para saber se ficou alguma dúvida. Quando quiser, é só escolher um horário: ' + LINK)]:
    if code not in have:
        call('POST', '/canned_responses', {'short_code': code, 'content': text}); print('resposta pronta:', code)

# 4) regra: nova conversa no chat do site -> etiqueta + link de agendamento
NAME = 'Boas-vindas com link de agendamento'
rules = call('GET', '/automation_rules').get('payload', [])
if not any(r['name'] == NAME for r in rules):
    call('POST', '/automation_rules', {'name': NAME, 'description': 'Marca como novo contato e envia o link da sessão diagnóstica.',
        'event_name': 'conversation_created', 'active': True,
        'conditions': [{'attribute_key': 'inbox_id', 'filter_operator': 'equal_to', 'values': [site_id], 'query_operator': None}],
        'actions': [{'action_name': 'add_label', 'action_params': ['novo-contato']},
                    {'action_name': 'send_message', 'action_params': [
                        'Olá! Obrigado por entrar em contato 😊 Em instantes alguém da equipe responde. '
                        'Se já quiser garantir um horário, escolha aqui a sua sessão diagnóstica: ' + LINK]}]})
    print('regra automática criada')

print('\nLink de agendamento usado nas mensagens:', LINK)
print('\n=== Cole este código no seu site (antes de </body>) para ativar o chat ===')
print(inboxes[SITE].get('web_widget_script') or '(abra Configurações > Caixas de entrada > Atendimento do Site > Configuração)')
