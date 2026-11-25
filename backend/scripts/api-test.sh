#!/usr/bin/env bash
# End-to-end API test for the HelpDesk backend.
#
# Requirements: the backend is running on :8080, PostgreSQL is up, curl + jq.
# Usage: cd backend && ./scripts/api-test.sh
#
# The script is re-runnable: every run creates fresh users/tickets with a unique
# suffix. It exits non-zero if any check fails.

set -uo pipefail

BASE="${BASE_URL:-http://localhost:8080/api}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$BACKEND_DIR/.." && pwd)"

# Load the same local admin credentials the app uses.
if [ -f "$BACKEND_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$BACKEND_DIR/.env"
  set +a
fi
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@helpdesk.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin12345}"

TMP_BODY="$(mktemp)"
trap 'rm -f "$TMP_BODY"' EXIT

PASS=0
FAIL=0
CODE=""
BODY=""

pass() { PASS=$((PASS + 1)); printf 'PASS  %s\n' "$1"; }
fail() {
  FAIL=$((FAIL + 1))
  printf 'FAIL  %s\n' "$1"
  if [ -n "${2:-}" ]; then printf '      %s\n' "$2"; fi
}

# Compact error detail that never echoes tokens or password values.
detail() {
  printf '%s' "$BODY" | jq -c '{status,error,message}' 2>/dev/null || printf '<non-JSON response>'
}

call() { # METHOD PATH [TOKEN] [JSON]
  local method="$1" path="$2" token="${3:-}" data="${4:-}"
  local args=(-s -o "$TMP_BODY" -w '%{http_code}' -X "$method")
  if [ -n "$data" ]; then args+=(-H 'Content-Type: application/json' -d "$data"); fi
  if [ -n "$token" ]; then args+=(-H "Authorization: Bearer $token"); fi
  CODE="$(curl "${args[@]}" "$BASE$path")"
  BODY="$(cat "$TMP_BODY")"
}

expect_code() { # NAME EXPECTED
  if [ "$CODE" = "$2" ]; then pass "$1"; else fail "$1" "expected HTTP $2, got $CODE ($(detail))"; fi
}

expect_eq() { # NAME EXPECTED ACTUAL
  if [ "$2" = "$3" ]; then pass "$1"; else fail "$1" "expected [$2], got [$3]"; fi
}

expect_field() { # NAME JQ_EXPR EXPECTED
  local actual
  actual="$(printf '%s' "$BODY" | jq -r "$2" 2>/dev/null)"
  expect_eq "$1" "$3" "$actual"
}

expect_no_password() { # NAME
  if printf '%s' "$BODY" | grep -q '"password"'; then
    fail "$1" "response contains a password field"
  else
    pass "$1"
  fi
}

expect_all_owned_by() { # NAME EMPLOYEE_ID
  local bad
  bad="$(printf '%s' "$BODY" | jq --arg id "$2" '[.content[] | select(.employee.id != $id)] | length' 2>/dev/null)"
  expect_eq "$1" "0" "$bad"
}

login_token() { # EMAIL PASSWORD
  call POST /auth/login "" "$(jq -n --arg e "$1" --arg p "$2" '{email:$e,password:$p}')"
  printf '%s' "$BODY" | jq -r '.token // empty'
}

register_employee() { # NAME EMAIL PASSWORD DEPARTMENT [PHONE]
  local payload
  payload="$(jq -n --arg fn "$1" --arg em "$2" --arg pw "$3" --arg dp "$4" --arg ph "${5:-}" \
    '{fullName:$fn,email:$em,password:$pw,department:$dp}
     + (if $ph != "" then {phone:$ph} else {} end)')"
  call POST /auth/register "" "$payload"
}

# ---------------------------------------------------------------------------
printf '\n== Environment / authentication ==\n'

PREFLIGHT="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/auth/me" || true)"
if [ -z "$PREFLIGHT" ] || [ "$PREFLIGHT" = "000" ]; then
  echo "FAIL  backend is not reachable at $BASE" >&2
  exit 2
fi

STAMP="$(date +%s)-$RANDOM"
EA_EMAIL="e2e.employee.a.$STAMP@example.com"
EB_EMAIL="e2e.employee.b.$STAMP@example.com"
EC_EMAIL="e2e.employee.c.$STAMP@example.com"
T1_EMAIL="e2e.tech.one.$STAMP@example.com"
T2_EMAIL="e2e.tech.two.$STAMP@example.com"
T3_EMAIL="e2e.tech.three.$STAMP@example.com"
T4_EMAIL="e2e.tech.four.$STAMP@example.com"
PASSWORD="Password123"

call POST /auth/login "" "$(jq -n --arg e "$ADMIN_EMAIL" --arg p "$ADMIN_PASSWORD" '{email:$e,password:$p}')"
expect_code "admin login" 200
expect_field "admin login role" ".user.role" "ADMIN"
expect_no_password "admin login response has no password"
ADMIN_TOKEN="$(printf '%s' "$BODY" | jq -r '.token // empty')"
if [ -n "$ADMIN_TOKEN" ]; then pass "admin token issued"; else fail "admin token issued"; fi

call POST /auth/login "" "$(jq -n --arg e "$ADMIN_EMAIL" '{email:$e,password:"DefinitelyWrong123"}')"
expect_code "login with wrong password is 401" 401

call GET /auth/me
expect_code "me without token is 401" 401
call GET /auth/me "not.a.valid.jwt"
expect_code "me with invalid token is 401" 401
call GET /tickets
expect_code "tickets without token is 401" 401
call GET /tickets "not.a.valid.jwt"
expect_code "tickets with invalid token is 401" 401

register_employee "Employee A" "$EA_EMAIL" "$PASSWORD" "IT"
expect_code "register employee A" 201
expect_field "register always assigns EMPLOYEE" ".role" "EMPLOYEE"
expect_field "register response department" ".employee.department" "IT"
expect_no_password "register response has no password"
EA_TOKEN="$(login_token "$EA_EMAIL" "$PASSWORD")"
if [ -n "$EA_TOKEN" ]; then pass "employee A login token"; else fail "employee A login token"; fi
call GET /auth/me "$EA_TOKEN"
expect_code "employee A /auth/me" 200
expect_field "employee A role in /auth/me" ".role" "EMPLOYEE"
expect_field "employee A email in /auth/me" ".email" "$EA_EMAIL"
EA_USER_ID="$(printf '%s' "$BODY" | jq -r '.id')"
EA_ID="$(printf '%s' "$BODY" | jq -r '.employee.id')"

register_employee "Employee B" "$EB_EMAIL" "$PASSWORD" "HR"
expect_code "register employee B" 201
EB_TOKEN="$(login_token "$EB_EMAIL" "$PASSWORD")"
call GET /auth/me "$EB_TOKEN"
EB_ID="$(printf '%s' "$BODY" | jq -r '.employee.id')"

call POST /auth/register "" "$(jq -n --arg e "$EA_EMAIL" '{fullName:"Duplicate",email:$e,password:"Password123",department:"IT"}')"
expect_code "duplicate email is 409" 409

# Email normalization: stored and compared in lowercase, so login and uniqueness
# are case-insensitive.
CASE_EMAIL="Case.Test.$STAMP@Example.COM"
CASE_EMAIL_LOWER="case.test.$STAMP@example.com"
register_employee "Case Test" "$CASE_EMAIL" "$PASSWORD" "IT"
expect_code "register mixed-case email" 201
expect_field "registered email is stored lowercase" ".email" "$CASE_EMAIL_LOWER"
CASE_TOKEN="$(login_token "$CASE_EMAIL_LOWER" "$PASSWORD")"
if [ -n "$CASE_TOKEN" ]; then pass "login with lowercase form of mixed-case email"; else fail "login with lowercase form of mixed-case email"; fi
CASE_TOKEN="$(login_token "CASE.TEST.$STAMP@EXAMPLE.COM" "$PASSWORD")"
if [ -n "$CASE_TOKEN" ]; then pass "login with uppercase form of mixed-case email"; else fail "login with uppercase form of mixed-case email"; fi
call POST /auth/register "" "$(jq -n --arg e "CASE.TEST.$STAMP@EXAMPLE.COM" '{fullName:"Case Duplicate",email:$e,password:"Password123",department:"IT"}')"
expect_code "registering same email in different case is 409" 409

call POST /auth/register "" '{"fullName":"A","email":"not-an-email","password":"short","department":""}'
expect_code "invalid registration fields are 400" 400
expect_field "validation reports email" '(.fieldErrors | has("email"))' "true"
expect_field "validation reports password" '(.fieldErrors | has("password"))' "true"
expect_field "validation reports fullName" '(.fieldErrors | has("fullName"))' "true"
expect_field "validation reports department" '(.fieldErrors | has("department"))' "true"

# Role injection: the extra role field must be ignored.
call POST /auth/register "" "$(jq -n --arg e "$EC_EMAIL" '{fullName:"Employee C",email:$e,password:"Password123",department:"Sales",role:"ADMIN",enabled:false}')"
expect_code "register with injected role is 201" 201
expect_field "injected role is ignored" ".role" "EMPLOYEE"
EC_TOKEN="$(login_token "$EC_EMAIL" "$PASSWORD")"
call GET /auth/me "$EC_TOKEN"
expect_field "injected role user is still EMPLOYEE" ".role" "EMPLOYEE"
EC_ID="$(printf '%s' "$BODY" | jq -r '.employee.id')"

call POST /auth/login "" '{"email": broken json'
expect_code "malformed JSON login is 400" 400

call GET /employees "$EA_TOKEN"
expect_code "employee cannot list employees (403)" 403
call POST /technicians "$EA_TOKEN" "$(jq -n --arg e "blocked.$STAMP@example.com" '{fullName:"Blocked",email:$e,password:"Password123",specialization:"X",availability:true}')"
expect_code "employee cannot create technicians (403)" 403
call POST /categories "$EA_TOKEN" '{"name":"Blocked Category"}'
expect_code "employee cannot create categories (403)" 403
call DELETE /tickets/00000000-0000-0000-0000-000000000000 "$EA_TOKEN"
expect_code "employee cannot delete tickets (403)" 403

# ---------------------------------------------------------------------------
printf '\n== Technician accounts and access ==\n'

create_technician() { # NAME EMAIL SPECIALIZATION AVAILABILITY
  call POST /technicians "$ADMIN_TOKEN" "$(jq -n --arg fn "$1" --arg em "$2" --arg sp "$3" --argjson av "$4" \
    '{fullName:$fn,email:$em,password:"Password123",specialization:$sp,availability:$av}')"
}

create_technician "Tech One" "$T1_EMAIL" "Network Support" true
expect_code "admin creates technician one" 201
expect_field "technician role is TECHNICIAN" ".user.role" "TECHNICIAN"
expect_no_password "technician response has no password"
T1_ID="$(printf '%s' "$BODY" | jq -r '.id')"
T1_TOKEN="$(login_token "$T1_EMAIL" "$PASSWORD")"
if [ -n "$T1_TOKEN" ]; then pass "technician one login token"; else fail "technician one login token"; fi
call GET /auth/me "$T1_TOKEN"
T1_USER_ID="$(printf '%s' "$BODY" | jq -r '.id')"

create_technician "Tech Two" "$T2_EMAIL" "Hardware" true
expect_code "admin creates technician two" 201
T2_ID="$(printf '%s' "$BODY" | jq -r '.id')"
T2_TOKEN="$(login_token "$T2_EMAIL" "$PASSWORD")"

create_technician "Tech Three" "$T3_EMAIL" "Printer" false
expect_code "admin creates unavailable technician three" 201
T3_ID="$(printf '%s' "$BODY" | jq -r '.id')"

call POST /technicians "$ADMIN_TOKEN" "$(jq -n --arg e "$T1_EMAIL" '{fullName:"Dup Tech",email:$e,password:"Password123",specialization:"Network",availability:true}')"
expect_code "duplicate technician email is 409" 409

call GET /technicians "$ADMIN_TOKEN"
expect_code "admin lists technicians" 200
call GET /technicians "$EA_TOKEN"
expect_code "employee cannot list technicians (403)" 403
call GET /technicians "$T1_TOKEN"
expect_code "technician cannot list all technicians (403)" 403
call GET "/technicians/$T1_ID" "$T1_TOKEN"
expect_code "technician reads own profile" 200
call GET "/technicians/$T2_ID" "$T1_TOKEN"
expect_code "technician cannot read another profile (403)" 403
call GET "/technicians/$T1_ID" "$EA_TOKEN"
expect_code "employee cannot read technician profile (403)" 403
call GET /technicians/available "$EA_TOKEN"
expect_code "employee lists available technicians" 200
expect_field "unavailable technician not in available list" "[.[] | select(.id == \"$T3_ID\")] | length" "0"
call GET "/technicians/specialization?keyword=Network" "$ADMIN_TOKEN"
expect_code "admin searches specialization" 200
call GET "/technicians/specialization?keyword=Network" "$EA_TOKEN"
expect_code "employee cannot search specialization (403)" 403
call GET "/tickets/technician/$T1_ID" "$T1_TOKEN"
expect_code "technician cannot use admin technician filter (403)" 403
call GET "/tickets/employee/$EA_ID" "$EA_TOKEN"
expect_code "employee cannot use admin employee filter (403)" 403

# ---------------------------------------------------------------------------
printf '\n== Categories ==\n'

call GET /categories "$EA_TOKEN"
expect_code "employee lists categories" 200
CAT1_ID="$(printf '%s' "$BODY" | jq -r '.[0].id')"
CAT2_ID="$(printf '%s' "$BODY" | jq -r '.[1].id')"

UNUSED_CAT="E2E Unused $STAMP"
call POST /categories "$ADMIN_TOKEN" "$(jq -n --arg n "$UNUSED_CAT" '{name:$n,description:"temporary"}')"
expect_code "admin creates category" 201
UNUSED_CAT_ID="$(printf '%s' "$BODY" | jq -r '.id')"
call POST /categories "$ADMIN_TOKEN" "$(jq -n --arg n "$UNUSED_CAT" '{name:$n}')"
expect_code "duplicate category name is 409" 409
call GET "/categories/$UNUSED_CAT_ID" "$EA_TOKEN"
expect_code "employee reads a category" 200
call PUT "/categories/$UNUSED_CAT_ID" "$ADMIN_TOKEN" "$(jq -n --arg n "${UNUSED_CAT} Updated" '{name:$n,description:"updated"}')"
expect_code "admin updates category" 200
call PUT "/categories/$UNUSED_CAT_ID" "$ADMIN_TOKEN" "$(jq -n --arg n "$UNUSED_CAT" '{name:$n}')"
expect_code "category update keeps its own name valid" 200
call DELETE "/categories/$UNUSED_CAT_ID" "$EA_TOKEN"
expect_code "employee cannot delete category (403)" 403
call DELETE "/categories/$UNUSED_CAT_ID" "$ADMIN_TOKEN"
expect_code "admin deletes unused category" 204
call GET "/categories/$UNUSED_CAT_ID" "$ADMIN_TOKEN"
expect_code "deleted category is 404" 404
call GET "/categories/00000000-0000-0000-0000-000000000000" "$ADMIN_TOKEN"
expect_code "missing category is 404" 404
call GET "/categories/not-a-uuid" "$ADMIN_TOKEN"
expect_code "malformed category UUID is 400" 400

# ---------------------------------------------------------------------------
printf '\n== Employee profiles ==\n'

call GET /employees "$ADMIN_TOKEN"
expect_code "admin lists employees" 200
call GET "/employees/$EA_ID" "$ADMIN_TOKEN"
expect_code "admin reads employee profile" 200
call GET "/employees/$EA_ID" "$EA_TOKEN"
expect_code "employee cannot read employee endpoint (403)" 403
call PUT "/employees/$EA_ID" "$ADMIN_TOKEN" '{"phone":"+216 20 000 000"}'
expect_code "admin updates employee profile" 200
call PUT "/employees/$EA_ID" "$EA_TOKEN" '{"phone":"+216 20 000 001"}'
expect_code "employee cannot update employee profile (403)" 403
call GET "/employees/00000000-0000-0000-0000-000000000000" "$ADMIN_TOKEN"
expect_code "missing employee is 404" 404
call GET "/employees/not-a-uuid" "$ADMIN_TOKEN"
expect_code "malformed employee UUID is 400" 400

# ---------------------------------------------------------------------------
printf '\n== Ticket creation and role scoping ==\n'

create_ticket() { # TOKEN TITLE DESCRIPTION PRIORITY CATEGORY_ID [EXTRA_JSON]
  local payload
  payload="$(jq -n --arg t "$2" --arg d "$3" --arg p "$4" --arg c "$5" \
    '{title:$t,description:$d,priority:$p,category:{id:$c}}')"
  if [ -n "${6:-}" ]; then
    payload="$(printf '%s' "$payload" | jq --argjson extra "$6" '. + $extra')"
  fi
  call POST /tickets "$1" "$payload"
}

TA1_TITLE="Internet outage in office alpha $STAMP"
TA2_TITLE="Printer jam in office beta $STAMP"
TA3_TITLE="VPN failure for remote staff $STAMP"
TB1_TITLE="Email account locked $STAMP"
TB2_TITLE="Slow laptop after update $STAMP"

create_ticket "$EA_TOKEN" "$TA1_TITLE" "The internet connection is unstable in office alpha." "HIGH" "$CAT1_ID" \
  "$(jq -n --arg id "$EB_ID" '{employee:{id:$id},status:"CLOSED",technician:null}')"
expect_code "employee A creates ticket 1" 201
expect_field "ticket owner derived from token" ".employee.id" "$EA_ID"
expect_field "ticket starts OPEN" ".status" "OPEN"
expect_field "ticket starts unassigned" ".technician" "null"
expect_no_password "ticket response has no password"
TA1_ID="$(printf '%s' "$BODY" | jq -r '.id')"

create_ticket "$EA_TOKEN" "$TA2_TITLE" "The office printer jams on every print job." "LOW" "$CAT2_ID"
expect_code "employee A creates ticket 2" 201
TA2_ID="$(printf '%s' "$BODY" | jq -r '.id')"

create_ticket "$EA_TOKEN" "$TA3_TITLE" "Remote staff cannot connect to the corporate VPN." "MEDIUM" "$CAT1_ID"
expect_code "employee A creates ticket 3" 201
TA3_ID="$(printf '%s' "$BODY" | jq -r '.id')"

create_ticket "$EB_TOKEN" "$TB1_TITLE" "My email account is locked after a failed login." "HIGH" "$CAT1_ID"
expect_code "employee B creates ticket 1" 201
TB1_ID="$(printf '%s' "$BODY" | jq -r '.id')"

create_ticket "$EB_TOKEN" "$TB2_TITLE" "The laptop became very slow after the last update." "LOW" "$CAT2_ID"
expect_code "employee B creates ticket 2" 201
TB2_ID="$(printf '%s' "$BODY" | jq -r '.id')"

call POST /tickets "$EA_TOKEN" "$(jq -n --arg c "$CAT1_ID" '{title:"Short",description:"Too short",priority:"LOW",category:{id:$c}}')"
expect_code "invalid ticket fields are 400" 400
call POST /tickets "$EA_TOKEN" "$(jq -n --arg c "$CAT1_ID" '{title:"Invalid priority ticket",description:"This priority is not a valid enum value.",priority:"URGENT",category:{id:$c}}')"
expect_code "invalid ticket priority is 400" 400
expect_field "invalid enum message lists allowed values" '(.message | contains("LOW"))' "true"
call POST /tickets "$EA_TOKEN" "$(jq -n '{title:"Missing category ticket",description:"The category id does not exist.",priority:"LOW",category:{id:"00000000-0000-0000-0000-000000000000"}}')"
expect_code "missing category on ticket is 404" 404
call POST /tickets "$EA_TOKEN" '{"title":"Malformed category id","description":"This category id is not a UUID.","priority":"LOW","category":{"id":"nope"}}'
expect_code "malformed category id is 400" 400
call POST /tickets "$ADMIN_TOKEN" "$(jq -n --arg c "$CAT1_ID" '{title:"Admin ticket attempt",description:"Admins are not allowed to create tickets.",priority:"LOW",category:{id:$c}}')"
expect_code "admin cannot create tickets (403)" 403
call POST /tickets "$T1_TOKEN" "$(jq -n --arg c "$CAT1_ID" '{title:"Tech ticket attempt",description:"Technicians are not allowed to create tickets.",priority:"LOW",category:{id:$c}}')"
expect_code "technician cannot create tickets (403)" 403

call GET "/tickets/$TA1_ID" "$EB_TOKEN"
expect_code "employee B cannot read employee A ticket (404)" 404
call GET "/tickets/$TA1_ID" "$T1_TOKEN"
expect_code "technician cannot read unassigned ticket (404)" 404
call GET "/tickets/$TA1_ID" "$ADMIN_TOKEN"
expect_code "admin reads any ticket" 200

call GET /tickets "$EA_TOKEN"
expect_code "employee A lists own tickets" 200
expect_field "employee A sees only own 3 tickets" ".totalElements" "3"
expect_all_owned_by "employee A list contains only own tickets" "$EA_ID"
expect_no_password "ticket list has no password"
call GET /tickets "$EB_TOKEN"
expect_field "employee B sees only own 2 tickets" ".totalElements" "2"
call GET /tickets "$T1_TOKEN"
expect_field "technician starts with no assigned tickets" ".totalElements" "0"
call GET /tickets "$ADMIN_TOKEN"
ADMIN_TOTAL="$(printf '%s' "$BODY" | jq -r '.totalElements')"
if [ "$ADMIN_TOTAL" -ge 5 ]; then pass "admin sees at least all five new tickets"; else fail "admin sees at least all five new tickets" "total=$ADMIN_TOTAL"; fi

# ---------------------------------------------------------------------------
printf '\n== Pagination and sorting ==\n'

call GET "/tickets?page=0&size=2" "$EA_TOKEN"
expect_field "pagination page number" ".page" "0"
expect_field "pagination size" ".size" "2"
expect_field "pagination elements on page 0" ".numberOfElements" "2"
expect_field "pagination total elements" ".totalElements" "3"
expect_field "pagination total pages" ".totalPages" "2"
expect_field "pagination first flag" ".first" "true"
expect_field "pagination last flag" ".last" "false"
call GET "/tickets?page=1&size=2" "$EA_TOKEN"
expect_field "pagination page 1 elements" ".numberOfElements" "1"
expect_field "pagination page 1 last flag" ".last" "true"

call GET "/tickets?sort=title,asc&size=10" "$EA_TOKEN"
ASC_TITLES="$(printf '%s' "$BODY" | jq -r '.content[].title')"
EXPECTED_ASC="$(printf '%s\n' "$ASC_TITLES" | sort)"
expect_eq "ticket title sort ascending" "$EXPECTED_ASC" "$ASC_TITLES"
call GET "/tickets?sort=title,desc&size=10" "$EA_TOKEN"
DESC_TITLES="$(printf '%s' "$BODY" | jq -r '.content[].title')"
EXPECTED_DESC="$(printf '%s\n' "$DESC_TITLES" | sort -r)"
expect_eq "ticket title sort descending" "$EXPECTED_DESC" "$DESC_TITLES"
call GET "/tickets?sort=createdAt,desc" "$EA_TOKEN"
expect_code "sort by createdAt desc" 200
call GET "/tickets?sort=notAField,asc" "$EA_TOKEN"
expect_code "invalid sort field is 400" 400

# ---------------------------------------------------------------------------
printf '\n== Assignment and status ==\n'

call PATCH "/tickets/$TA1_ID/assign/$T1_ID" "$ADMIN_TOKEN"
expect_code "admin assigns ticket to available technician" 200
expect_field "ticket technician set" ".technician.id" "$T1_ID"
call GET /tickets "$T1_TOKEN"
expect_field "technician now sees assigned ticket" ".totalElements" "1"
call GET "/tickets/$TA1_ID" "$T1_TOKEN"
expect_code "technician reads assigned ticket" 200
call GET "/tickets/$TA2_ID" "$T1_TOKEN"
expect_code "technician cannot read another ticket (404)" 404

call PATCH "/tickets/$TA2_ID/assign/$T3_ID" "$ADMIN_TOKEN"
expect_code "assigning unavailable technician is 400" 400
call PATCH "/tickets/$TA2_ID/assign/$T2_ID" "$ADMIN_TOKEN"
expect_code "admin assigns second ticket" 200
call PATCH "/tickets/$TA2_ID/unassign" "$ADMIN_TOKEN"
expect_code "admin unassigns technician" 200
expect_field "unassigned ticket has no technician" ".technician" "null"
call GET /tickets "$T2_TOKEN"
expect_field "unassigned technician sees no ticket" ".totalElements" "0"

call PATCH "/tickets/$TA1_ID/status" "$T1_TOKEN" '{"status":"IN_PROGRESS"}'
expect_code "assigned technician updates status" 200
expect_field "status changed to IN_PROGRESS" ".status" "IN_PROGRESS"
call PATCH "/tickets/$TA1_ID/status" "$T2_TOKEN" '{"status":"RESOLVED"}'
expect_code "non-assigned technician cannot update status (403)" 403
call PATCH "/tickets/$TA1_ID/status" "$EA_TOKEN" '{"status":"RESOLVED"}'
expect_code "employee cannot update status (403)" 403
call PATCH "/tickets/$TA1_ID/status" "$ADMIN_TOKEN" '{"status":"WAITING_FOR_RESPONSE"}'
expect_code "admin updates status" 200
expect_field "admin status value" ".status" "WAITING_FOR_RESPONSE"
call PATCH "/tickets/$TA1_ID/status" "$ADMIN_TOKEN" '{"status":"NOT_A_STATUS"}'
expect_code "invalid status enum is 400" 400
call PATCH "/tickets/$TA1_ID/status" "$ADMIN_TOKEN" '{}'
expect_code "missing status is 400" 400
call PATCH "/tickets/$TA2_ID/assign/00000000-0000-0000-0000-000000000000" "$ADMIN_TOKEN"
expect_code "assigning missing technician is 404" 404
call PATCH "/tickets/$TA2_ID/assign/not-a-uuid" "$ADMIN_TOKEN"
expect_code "malformed technician UUID is 400" 400
call PATCH "/tickets/00000000-0000-0000-0000-000000000000/unassign" "$ADMIN_TOKEN"
expect_code "unassigning missing ticket is 404" 404

# ---------------------------------------------------------------------------
printf '\n== Ticket updates and ownership ==\n'

call PUT "/tickets/$TA1_ID" "$EA_TOKEN" "$(jq -n --arg c "$CAT2_ID" \
  '{title:"Internet outage updated",description:"The internet connection is still unstable in office alpha.",priority:"CRITICAL",category:{id:$c},status:"CLOSED",technician:null,employee:null}')"
expect_code "owning employee updates ticket" 200
expect_field "title updated" ".title" "Internet outage updated"
expect_field "priority updated" ".priority" "CRITICAL"
expect_field "category updated" ".category.id" "$CAT2_ID"
expect_field "employee cannot change status through PUT" ".status" "WAITING_FOR_RESPONSE"
expect_field "employee cannot change technician through PUT" ".technician.id" "$T1_ID"
expect_field "employee cannot change owner through PUT" ".employee.id" "$EA_ID"

call PUT "/tickets/$TA1_ID" "$EB_TOKEN" '{"title":"Hijacked ticket title"}'
expect_code "other employee cannot update ticket (404)" 404
call PUT "/tickets/$TA1_ID" "$T1_TOKEN" '{"title":"Technician edit attempt"}'
expect_code "technician cannot update ticket fields (403)" 403
call PUT "/tickets/$TA1_ID" "$ADMIN_TOKEN" '{"title":"Internet outage updated by admin"}'
expect_code "admin updates ticket fields" 200
call PUT "/tickets/$TA2_ID" "$EA_TOKEN" '{"title":"Bad"}'
expect_code "invalid ticket update is 400" 400

# ---------------------------------------------------------------------------
printf '\n== Filters and search (role-scoped) ==\n'

call GET "/tickets/status/OPEN" "$EA_TOKEN"
expect_field "employee status filter count" ".totalElements" "2"
expect_all_owned_by "employee status filter stays scoped" "$EA_ID"
call GET "/tickets/status/OPEN" "$T1_TOKEN"
expect_field "technician status filter excludes unassigned" ".totalElements" "0"
call GET "/tickets/status/WAITING_FOR_RESPONSE" "$T1_TOKEN"
expect_field "technician sees assigned ticket by status" ".totalElements" "1"
call GET "/tickets/priority/HIGH" "$EA_TOKEN"
expect_field "employee priority filter count" ".totalElements" "0"
call GET "/tickets/priority/CRITICAL" "$EA_TOKEN"
expect_field "employee priority filter finds updated ticket" ".totalElements" "1"
expect_all_owned_by "employee priority filter stays scoped" "$EA_ID"
call GET "/tickets/priority/CRITICAL" "$T1_TOKEN"
expect_field "technician priority filter finds assigned ticket" ".totalElements" "1"
call GET "/tickets/category/$CAT1_ID" "$EA_TOKEN"
expect_field "employee category filter count" ".totalElements" "1"
expect_all_owned_by "employee category filter stays scoped" "$EA_ID"
call GET "/tickets/category/$CAT2_ID" "$EA_TOKEN"
expect_field "employee second category filter count" ".totalElements" "2"
call GET "/tickets/search?keyword=Internet" "$EA_TOKEN"
expect_field "employee title search finds own ticket" ".totalElements" "1"
expect_all_owned_by "employee search stays scoped" "$EA_ID"
call GET "/tickets/search?keyword=Email" "$EA_TOKEN"
expect_field "employee search cannot see another employee ticket" ".totalElements" "0"
call GET "/tickets/search?keyword=Internet" "$T1_TOKEN"
expect_field "technician search finds assigned ticket" ".totalElements" "1"
call GET "/tickets/search?keyword=Email" "$T1_TOKEN"
expect_field "technician search cannot see unassigned ticket" ".totalElements" "0"
call GET "/tickets/search?keyword=Internet" "$EB_TOKEN"
expect_field "employee B search cannot see employee A ticket" ".totalElements" "0"
call GET "/tickets/employee/$EA_ID" "$ADMIN_TOKEN"
expect_field "admin employee filter" ".totalElements" "3"
call GET "/tickets/technician/$T1_ID" "$ADMIN_TOKEN"
expect_field "admin technician filter" ".totalElements" "1"
call GET "/tickets/category/$CAT2_ID" "$ADMIN_TOKEN"
ADMIN_CAT_TOTAL="$(printf '%s' "$BODY" | jq -r '.totalElements')"
if [ "$ADMIN_CAT_TOTAL" -ge 2 ]; then pass "admin category filter"; else fail "admin category filter" "total=$ADMIN_CAT_TOTAL"; fi
call GET "/tickets/status/OPEN" "$ADMIN_TOKEN"
ADMIN_OPEN_TOTAL="$(printf '%s' "$BODY" | jq -r '.totalElements')"
if [ "$ADMIN_OPEN_TOTAL" -ge 4 ]; then pass "admin status filter"; else fail "admin status filter" "total=$ADMIN_OPEN_TOTAL"; fi
call GET "/tickets/status/NOPE" "$ADMIN_TOKEN"
expect_code "invalid status path enum is 400" 400
call GET "/tickets/priority/NOPE" "$ADMIN_TOKEN"
expect_code "invalid priority path enum is 400" 400
call GET "/tickets/category/not-a-uuid" "$ADMIN_TOKEN"
expect_code "malformed category filter UUID is 400" 400
call GET "/tickets/category/00000000-0000-0000-0000-000000000000" "$ADMIN_TOKEN"
expect_code "missing category filter is 404" 404
call GET "/tickets/technician/00000000-0000-0000-0000-000000000000" "$ADMIN_TOKEN"
expect_code "missing technician filter is 404" 404
call GET "/tickets/employee/00000000-0000-0000-0000-000000000000" "$ADMIN_TOKEN"
expect_code "missing employee filter is 404" 404

# ---------------------------------------------------------------------------
printf '\n== Comments ==\n'

add_comment() { # TOKEN TICKET_ID CONTENT [EXTRA_JSON]
  local payload
  payload="$(jq -n --arg c "$3" '{content:$c}')"
  if [ -n "${4:-}" ]; then payload="$(printf '%s' "$payload" | jq --argjson extra "$4" '. + $extra')"; fi
  call POST "/tickets/$2/comments" "$1" "$payload"
}

add_comment "$EA_TOKEN" "$TA1_ID" "Still happening after a restart." "$(jq -n --arg id "$EB_ID" '{author:{id:$id},authorName:"Fake"}')"
expect_code "owning employee adds comment" 201
expect_field "comment author derived from token" ".author.id" "$EA_USER_ID"
expect_no_password "comment response has no password"
C1_ID="$(printf '%s' "$BODY" | jq -r '.id')"

add_comment "$T1_TOKEN" "$TA1_ID" "Checking the network switch now."
expect_code "assigned technician adds comment" 201
expect_field "technician comment author" ".author.id" "$T1_USER_ID"
C2_ID="$(printf '%s' "$BODY" | jq -r '.id')"

add_comment "$EB_TOKEN" "$TA1_ID" "Outsider comment"
expect_code "other employee cannot comment (404)" 404
add_comment "$T2_TOKEN" "$TA1_ID" "Non-assigned technician comment"
expect_code "non-assigned technician cannot comment (404)" 404
add_comment "$ADMIN_TOKEN" "$TA1_ID" "Admin comment"
expect_code "admin cannot comment (403)" 403
add_comment "$EA_TOKEN" "$TA1_ID" "x"
expect_code "too-short comment is 400" 400
add_comment "$EA_TOKEN" "00000000-0000-0000-0000-000000000000" "Comment on missing ticket"
expect_code "comment on missing ticket is 404" 404

call GET "/tickets/$TA1_ID/comments" "$EA_TOKEN"
expect_code "owning employee lists comments" 200
expect_field "comment count for employee" "length" "2"
call GET "/tickets/$TA1_ID/comments" "$T1_TOKEN"
expect_field "comment count for technician" "length" "2"
call GET "/tickets/$TA1_ID/comments" "$ADMIN_TOKEN"
expect_field "admin can list comments" "length" "2"
call GET "/tickets/$TA1_ID/comments" "$EB_TOKEN"
expect_code "outsider cannot list comments (404)" 404
call GET "/comments/$C1_ID" "$T1_TOKEN"
expect_code "assigned technician reads a comment" 200
call GET "/comments/$C1_ID" "$EB_TOKEN"
expect_code "outsider cannot read a comment (404)" 404

call PUT "/comments/$C1_ID" "$EA_TOKEN" '{"content":"Still happening after two restarts."}'
expect_code "author updates own comment" 200
expect_field "comment content updated" ".content" "Still happening after two restarts."
call PUT "/comments/$C1_ID" "$T1_TOKEN" '{"content":"Not my comment to edit"}'
expect_code "non-author cannot update comment (403)" 403
call PUT "/comments/$C1_ID" "$ADMIN_TOKEN" '{"content":"Admin edit"}'
expect_code "admin cannot update another author comment (403)" 403
call DELETE "/comments/$C1_ID" "$ADMIN_TOKEN"
expect_code "admin cannot delete another author comment (403)" 403
call DELETE "/comments/$C2_ID" "$T1_TOKEN"
expect_code "author deletes own comment" 204

# A technician who only authored a comment must not be deletable.
create_technician "Tech Four" "$T4_EMAIL" "Network" true
expect_code "admin creates technician four" 201
T4_ID="$(printf '%s' "$BODY" | jq -r '.id')"
T4_TOKEN="$(login_token "$T4_EMAIL" "$PASSWORD")"
call PATCH "/tickets/$TA2_ID/assign/$T4_ID" "$ADMIN_TOKEN"
expect_code "assign ticket to technician four" 200
add_comment "$T4_TOKEN" "$TA2_ID" "Technician four comment."
expect_code "technician four comments" 201
call PATCH "/tickets/$TA2_ID/unassign" "$ADMIN_TOKEN"
expect_code "unassign technician four" 200
call DELETE "/technicians/$T4_ID" "$ADMIN_TOKEN"
expect_code "technician with authored comments cannot be deleted (409)" 409

# ---------------------------------------------------------------------------
printf '\n== Deletion rules ==\n'

# Keep a ticket assigned to technician two so its deletion is blocked.
call PATCH "/tickets/$TB1_ID/assign/$T2_ID" "$ADMIN_TOKEN"
expect_code "assign employee B ticket to technician two" 200

call DELETE "/tickets/$TA1_ID" "$EA_TOKEN"
expect_code "employee cannot delete ticket (403)" 403

add_comment "$EA_TOKEN" "$TA3_ID" "Comment that must disappear with the ticket."
expect_code "comment added before ticket deletion" 201
call DELETE "/tickets/$TA3_ID" "$ADMIN_TOKEN"
expect_code "admin deletes ticket" 204
call GET "/tickets/$TA3_ID" "$ADMIN_TOKEN"
expect_code "deleted ticket is 404" 404
COMMENTS_LEFT="$(docker exec helpdesk-postgres psql -U helpdesk -d helpdesk_db -tAc \
  "select count(*) from comments where ticket_id = '$TA3_ID';" 2>/dev/null | tr -d '[:space:]')"
expect_eq "ticket deletion removed its comments" "0" "$COMMENTS_LEFT"

call DELETE "/employees/$EA_ID" "$ADMIN_TOKEN"
expect_code "employee with tickets cannot be deleted (409)" 409
call DELETE "/employees/$EB_ID" "$ADMIN_TOKEN"
expect_code "second employee with tickets cannot be deleted (409)" 409
call DELETE "/technicians/$T1_ID" "$ADMIN_TOKEN"
expect_code "technician with assigned tickets cannot be deleted (409)" 409
call DELETE "/technicians/$T2_ID" "$ADMIN_TOKEN"
expect_code "second technician with assigned tickets cannot be deleted (409)" 409
call DELETE "/categories/$CAT1_ID" "$ADMIN_TOKEN"
expect_code "category in use cannot be deleted (409)" 409
call DELETE "/technicians/$T3_ID" "$ADMIN_TOKEN"
expect_code "unused technician can be deleted" 204
call DELETE "/employees/$EC_ID" "$ADMIN_TOKEN"
expect_code "employee without tickets/comments can be deleted" 204
call DELETE "/employees/00000000-0000-0000-0000-000000000000" "$ADMIN_TOKEN"
expect_code "deleting missing employee is 404" 404
call DELETE "/technicians/not-a-uuid" "$ADMIN_TOKEN"
expect_code "deleting malformed technician UUID is 400" 400

# ---------------------------------------------------------------------------
printf '\n== Disabled accounts and role injection ==\n'

call PUT "/employees/$EB_ID" "$ADMIN_TOKEN" '{"enabled":false}'
expect_code "admin disables employee B" 200
call POST /auth/login "" "$(jq -n --arg e "$EB_EMAIL" --arg p "$PASSWORD" '{email:$e,password:$p}')"
expect_code "disabled user cannot log in (401)" 401
call GET /auth/me "$EB_TOKEN"
expect_code "existing token of disabled user is rejected (401)" 401
call PUT "/employees/$EB_ID" "$ADMIN_TOKEN" '{"enabled":true}'
expect_code "admin re-enables employee B" 200
EB_TOKEN="$(login_token "$EB_EMAIL" "$PASSWORD")"
if [ -n "$EB_TOKEN" ]; then pass "re-enabled employee can log in"; else fail "re-enabled employee can log in"; fi

call PUT "/technicians/$T2_ID" "$ADMIN_TOKEN" '{"enabled":false}'
expect_code "admin disables technician two" 200
call POST /auth/login "" "$(jq -n --arg e "$T2_EMAIL" --arg p "$PASSWORD" '{email:$e,password:$p}')"
expect_code "disabled technician cannot log in (401)" 401
call PUT "/technicians/$T2_ID" "$ADMIN_TOKEN" '{"enabled":true}'
expect_code "admin re-enables technician two" 200

call POST /technicians "$ADMIN_TOKEN" "$(jq -n --arg e "$T4_EMAIL" '{fullName:"Role Inject",email:$e,password:"Password123",specialization:"Network",availability:true,role:"ADMIN"}')"
expect_code "technician creation with injected role is 409 (email already used)" 409
call POST /technicians "$ADMIN_TOKEN" "$(jq -n --arg e "inject.$STAMP@example.com" '{fullName:"Role Inject",email:$e,password:"Password123",specialization:"Network",availability:true,role:"ADMIN",enabled:false}')"
expect_code "technician creation with injected role succeeds" 201
expect_field "injected technician role is TECHNICIAN" ".user.role" "TECHNICIAN"
INJECT_TECH_ID="$(printf '%s' "$BODY" | jq -r '.id')"
call DELETE "/technicians/$INJECT_TECH_ID" "$ADMIN_TOKEN"
expect_code "cleanup injected technician" 204

# ---------------------------------------------------------------------------
printf '\n== Password storage and response safety ==\n'

HASH="$(docker exec helpdesk-postgres psql -U helpdesk -d helpdesk_db -tAc \
  "select password from users where email = '$EA_EMAIL';" 2>/dev/null | tr -d '[:space:]')"
case "$HASH" in
  \$2*) pass "stored password is a BCrypt hash" ;;
  *) fail "stored password is a BCrypt hash" "hash does not start with \$2" ;;
esac
if [ "$HASH" = "$PASSWORD" ]; then fail "stored password is not plain text"; else pass "stored password is not plain text"; fi

call GET /auth/me "$EA_TOKEN"
expect_no_password "me response has no password field"
call GET /tickets "$ADMIN_TOKEN"
expect_no_password "ticket list has no password field"

# ---------------------------------------------------------------------------
printf '\n== CORS ==\n'

CORS_5173="$(curl -s -D - -o /dev/null -X OPTIONS \
  -H 'Origin: http://localhost:5173' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: authorization' "$BASE/tickets")"
if printf '%s' "$CORS_5173" | grep -qi '^access-control-allow-origin: http://localhost:5173'; then
  pass "CORS allows localhost:5173"
else
  fail "CORS allows localhost:5173"
fi
if printf '%s' "$CORS_5173" | grep -qi '^access-control-allow-headers:.*authorization'; then
  pass "CORS allows the Authorization header"
else
  fail "CORS allows the Authorization header"
fi

CORS_3000="$(curl -s -D - -o /dev/null -X OPTIONS \
  -H 'Origin: http://localhost:3000' \
  -H 'Access-Control-Request-Method: GET' "$BASE/tickets")"
if printf '%s' "$CORS_3000" | grep -qi '^access-control-allow-origin: http://localhost:3000'; then
  pass "CORS allows localhost:3000"
else
  fail "CORS allows localhost:3000"
fi

# ---------------------------------------------------------------------------
printf '\n== Persistence across PostgreSQL restart ==\n'

docker compose -f "$ROOT_DIR/docker-compose.yml" restart postgres >/dev/null 2>&1
DB_STATUS=""
for _ in $(seq 1 30); do
  DB_STATUS="$(docker inspect -f '{{.State.Health.Status}}' helpdesk-postgres 2>/dev/null || echo unknown)"
  [ "$DB_STATUS" = "healthy" ] && break
  sleep 2
done
expect_eq "PostgreSQL is healthy after restart" "healthy" "$DB_STATUS"

LOGIN_CODE=""
for _ in $(seq 1 20); do
  call POST /auth/login "" "$(jq -n --arg e "$ADMIN_EMAIL" --arg p "$ADMIN_PASSWORD" '{email:$e,password:$p}')"
  LOGIN_CODE="$CODE"
  [ "$LOGIN_CODE" = "200" ] && break
  sleep 1
done
expect_code "admin login after PostgreSQL restart" 200
ADMIN_TOKEN="$(printf '%s' "$BODY" | jq -r '.token // empty')"
call GET "/tickets/$TB1_ID" "$ADMIN_TOKEN"
expect_code "data persists after PostgreSQL restart" 200
expect_field "persisted ticket title" ".title" "$TB1_TITLE"

# ---------------------------------------------------------------------------
printf '\n========================================\n'
printf 'TOTAL: %d passed, %d failed\n' "$PASS" "$FAIL"
printf '========================================\n'

[ "$FAIL" -eq 0 ]
