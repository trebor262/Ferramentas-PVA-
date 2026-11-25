#!/usr/bin/env bash
# Ajustes do cal.diy que a tela não faz sozinha. Rode DEPOIS de criar o administrador em https://<CAL_HOST>/auth/setup
# e de concluir o onboarding. Pode rodar de novo sem duplicar.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
psql_cal() { docker compose exec -T cal-db psql -U cal -d calendso -v ON_ERROR_STOP=1 -tA "$@"; }

USER_ID="$(psql_cal -c "select id from users where username='${CAL_USERNAME}';")"
[ -n "$USER_ID" ] || { echo "Usuário '${CAL_USERNAME}' não encontrado. Crie o administrador primeiro."; exit 1; }

psql_cal <<SQL
update users set "timeZone"='${TIMEZONE}', locale='pt-BR' where id=${USER_ID};
-- exemplos do cal.diy ficam escondidos
update "EventType" set hidden=true where slug in ('15min','30min','secret') and "userId"=${USER_ID};
-- disponibilidade padrão: seg-sex, 9h às 18h (edite depois em Disponibilidade)
do \$\$
declare sid int;
begin
  if not exists (select 1 from "Schedule" where "userId"=${USER_ID}) then
    insert into "Schedule" ("userId", name, "timeZone") values (${USER_ID}, 'Horário de atendimento', '${TIMEZONE}') returning id into sid;
    insert into "Availability" ("scheduleId", days, "startTime", "endTime") values (sid, '{1,2,3,4,5}', '09:00:00', '18:00:00');
    update users set "defaultScheduleId"=sid where id=${USER_ID};
  end if;
  -- aviso de agendamento -> ponte -> Chatwoot
  if not exists (select 1 from "Webhook" where "subscriberUrl"='http://bridge:8099/') then
    insert into "Webhook" (id, "userId", "subscriberUrl", active, "eventTriggers", secret, platform)
    values (gen_random_uuid()::text, ${USER_ID}, 'http://bridge:8099/', true,
            ARRAY['BOOKING_CREATED','BOOKING_RESCHEDULED','BOOKING_CANCELLED']::"WebhookTriggerEvents"[], '${CAL_WEBHOOK_SECRET}', false);
  end if;
end \$\$;
SQL
echo "cal.diy ajustado (fuso, disponibilidade, webhook)."
