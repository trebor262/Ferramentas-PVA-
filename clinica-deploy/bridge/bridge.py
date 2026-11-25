"""Cal.diy -> Chatwoot bridge. Receives booking webhooks and updates the matching Chatwoot conversation."""
import hmac, hashlib, json, os, urllib.request, urllib.parse, urllib.error
from http.server import BaseHTTPRequestHandler, HTTPServer

CW = os.environ['CHATWOOT_URL'].rstrip('/')
ACC = os.environ['CHATWOOT_ACCOUNT']
TOKEN = os.environ['CHATWOOT_TOKEN']
INBOX_NAME = os.environ.get('CHATWOOT_INBOX_NAME', 'Agendamentos (Cal.diy)')
_inbox_id = None
SECRET = os.environ['CAL_WEBHOOK_SECRET'].encode()
PORT = int(os.environ.get('PORT', '8099'))
STAGES = {'novo-contato', 'interessado', 'diagnostico-agendado', 'paciente-ativo', 'sem-retorno'}

def cw(method, path, body=None):
    req = urllib.request.Request(f'{CW}/api/v1/accounts/{ACC}{path}', method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'api_access_token': TOKEN, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=20) as r:
        t = r.read().decode()
        return json.loads(t) if t else {}

def inbox_id():
    global _inbox_id
    if _inbox_id is None:
        for i in cw('GET', '/inboxes').get('payload', []):
            if i.get('name') == INBOX_NAME:
                _inbox_id = i['id']
        if _inbox_id is None:
            raise RuntimeError(f'inbox "{INBOX_NAME}" not found - run scripts/setup-chatwoot.py')
    return _inbox_id

def find_or_create_contact(name, email):
    res = cw('GET', '/contacts/search?q=' + urllib.parse.quote(email))
    for c in res.get('payload', []):
        if (c.get('email') or '').lower() == email.lower():
            return c['id'], None
    res = cw('POST', '/contacts', {'inbox_id': inbox_id(), 'name': name or email, 'email': email})
    contact = res.get('payload', {}).get('contact', res.get('payload', {}))
    src = next((ci['source_id'] for ci in contact.get('contact_inboxes', []) if ci.get('inbox', {}).get('id') == inbox_id()), None)
    return contact['id'], src

def conversation_for(contact_id, source_id):
    convs = cw('GET', f'/contacts/{contact_id}/conversations').get('payload', [])
    open_ = [c for c in convs if c.get('status') != 'resolved']
    if open_:
        return open_[0]['id']
    if not source_id:
        ci = cw('POST', f'/contacts/{contact_id}/contact_inboxes', {'inbox_id': inbox_id()})
        source_id = ci.get('source_id')
    return cw('POST', '/conversations', {'source_id': source_id, 'inbox_id': inbox_id(), 'contact_id': contact_id, 'status': 'open'})['id']

def set_stage(conv_id, stage):
    cur = cw('GET', f'/conversations/{conv_id}/labels').get('payload', [])
    keep = [l for l in cur if l not in STAGES]
    cw('POST', f'/conversations/{conv_id}/labels', {'labels': keep + [stage]})

def note(conv_id, text):
    cw('POST', f'/conversations/{conv_id}/messages', {'content': text, 'message_type': 'outgoing', 'private': True})

def handle(event):
    trig = event.get('triggerEvent', '')
    p = event.get('payload', {})
    att = (p.get('attendees') or [{}])[0]
    email = att.get('email')
    if not email:
        return 'no attendee email'
    cid, src = find_or_create_contact(att.get('name'), email)
    conv = conversation_for(cid, src)
    what = p.get('title') or p.get('type') or 'Sessão'
    when = f"{p.get('startTime','?')} (fuso do paciente: {att.get('timeZone','?')})"
    if trig == 'BOOKING_CREATED':
        stage = 'diagnostico-agendado' if p.get('type') == 'sessao-diagnostica' else 'paciente-ativo'
        set_stage(conv, stage); note(conv, f'📅 Agendamento confirmado: {what}\nInício: {when}')
    elif trig == 'BOOKING_RESCHEDULED':
        note(conv, f'🔁 Agendamento remarcado: {what}\nNovo horário: {when}')
    elif trig == 'BOOKING_CANCELLED':
        set_stage(conv, 'interessado'); note(conv, f'❌ Agendamento cancelado: {what}\nHorário era: {when}')
    else:
        return 'ignored ' + trig
    return f'{trig} -> conversation {conv}'

class H(BaseHTTPRequestHandler):
    def _send(self, code, msg=''):
        self.send_response(code); self.end_headers(); self.wfile.write(msg.encode())
    def do_GET(self):
        self._send(200, 'ok')
    def do_POST(self):
        raw = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        sig = self.headers.get('X-Cal-Signature-256', '')
        good = hmac.new(SECRET, raw, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, good):
            return self._send(401, 'bad signature')
        try:
            print(handle(json.loads(raw)), flush=True); self._send(200, 'ok')
        except Exception as e:
            print('error:', repr(e), flush=True); self._send(500, 'error')
    def log_message(self, *a): pass

HTTPServer(('0.0.0.0', PORT), H).serve_forever()
