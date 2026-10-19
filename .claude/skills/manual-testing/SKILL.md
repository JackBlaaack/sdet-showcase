---
name: manual-testing
description: "Use when designing test cases, test plans, checklists or acceptance scenarios from requirements. Triggers on: \"write test cases\", \"create test plan\", \"test this feature\", \"acceptance scenarios\", \"checklist for testing\", \"чек-лист для карточки\", \"IEEE 829\", \"normalize test case for Allure\", \"import to Qase\", \"Qase CSV\", \"Postman requests from API spec\", \"BVA\", \"equivalence partitioning\", \"pairwise\", \"state transition\", \"decision table\", \"CRUD matrix\", \"error guessing\". Covers test design techniques, API contract analysis, Allure TestOps normalization, Qase.io CSV import format, IEEE 829 plans."
---

# Manual Testing — Test Case Design

## Checklist Scope Contract

A checklist for a task consists of exactly three layers, in this order.
Nothing else goes in it.

| Layer | Content | When |
|---|---|---|
| 1. AC | One item per acceptance-criteria point of the task, 1:1 | Always |
| 2. Changed behaviour | Negative / boundary / transition items derived by the technique selector **from what this task changes** (fields, statuses, flags, endpoints), plus observability items using log/error codes from the requirements (no-code mode) or from the code with `file:line` (main-thread mode, see Source modes) | Always |
| 3. Compatibility | Backward compatibility of the old client / old contract | Only contract changes (a new API version, a changed field type, a new nullable field) |

The goal is to prove the feature works as the task states — not to re-run
regression of neighbouring features.

## Source modes

This skill is shared by two callers. The contract above is the same; only the
allowed sources differ.

| Mode | Who | Allowed sources |
|---|---|---|
| **No-code** | Subagent `manual-tester` | AC of the request → requirements (`README.md`, `docs/`) → API contract (`spec/openapi.json`). A log code, field or status that exists **only in code** is NOT a checklist item: it goes to «Открытые вопросы» («код ошибки X в требованиях не указан») |
| **Main thread** | Top-level Claude (code is readable) | The same, plus repository code and diff, always with `file:line`. Closes the open questions that the subagent returned |

If you are the `manual-tester` subagent, ignore every instruction below that
mentions code, diff or `file:line` as a source.

**Source trace (draft only).** While drafting, every item carries its source:

```
1. Проверить, что POST /api/v1/orders с quantity=100 отдаёт 400.      ← spec: CreateOrder.items[].quantity maximum 99
2. Проверить, что POST /api/v1/orders/{id}/pay отклоняет чужой заказ.  ← spec: «Pay a NEW order (owner only)»  (no-code) | src/…:42 (main thread)
3. Проверить, что v1 и v2 GET /orders/{id} отдают согласованные суммы. ← layer 3, /api/v1 vs /api/v2
```

An item with no source line is deleted before saving. The saved checklist
carries the flat numbered list **without** the `←` trace.

**Length** follows from the contract: number of AC points plus what the change
itself yields. No fixed cap — but an item that traces to neither AC nor the
change is not "extra coverage", it is a different task's regression.

## Checklist format

One flat numbered list `1..N` — no positive/negative/edge grouping, everything
mixed in one list. Item phrasing: `N. Проверить, что <behavior>` or
`N. Проверить код ошибки <code> при <event>`; imperative, one check per item.

- **Coverage in one list:** positive + negative + edge + observability — each of
  them only when it traces to the AC or to the change.
- **Never write `✅`.** Not in drafts, not in the saved text. The tester marks items while running the checks.
- **Never fabricate:** no code / endpoint / field in the sources → placeholder or open question, don't invent flags or fields.

### Mandatory minimum

Every checklist contains, each item still traced to AC / requirements / contract:

1. **Smoke** — at least one item that proves the main scenario of the task works end to end (for an endpoint: `<METHOD> <path>` returns the expected code and the expected structure).
2. **Negative** — at least one item per failure the AC or contract describes (invalid or missing input, forbidden state, not-found, auth failure). If the task describes no failure at all, say so in «Открытые вопросы» instead of inventing one.
3. **If the task touches an HTTP endpoint**, additionally:
   - **Response contract:** structure and field names, types, formats and the values (not just the status code) of every field the task adds or changes.
   - **Required fields:** every required field of the response is present in every element of a collection (not only the first); every required request field missing → the error code the contract names; optional fields omitted → still OK.
   - **Token:** the endpoint is closed by auth — no token / invalid token → the error code from the contract (not 500); if the contract defines roles, a token of a forbidden role → the error code from the contract. Code not stated in the contract → open question, never a guessed code.

### Style: no filler

- One check per item. Never join two behaviours with «и» unless they are one observable result.
- Concrete over general: name the method + path, the field, the code or the value. Examples in parentheses only when they carry a real value (`"tok_declined"`), not an explanation.
- No item that restates another in different words.
- Length follows the contract, not a quota.

## Test Case Template

```markdown
## Test Case N: Brief Description

**Objective:** What is being tested

**Preconditions:**
- User is authenticated
- Specific data exists

**Test Data:**
- Input values
- Expected outputs

**Steps:**
1. Action 1
2. Action 2
3. Verification point

**Expected Result:** Specific outcome

**Edge Cases:**
- Case 1
- Case 2
```

## Feature Checklist Template

```markdown
# {Feature} Testing Checklist

## Functional
- [ ] Positive scenarios
- [ ] Negative scenarios
- [ ] Boundary value testing
- [ ] Error handling

## Data Validation
- [ ] Input validation
- [ ] Output validation
- [ ] Data persistence

## Security
- [ ] Authentication
- [ ] Authorization
- [ ] Input sanitization (SQL injection, XSS)

## Integration
- [ ] API integration
- [ ] Cross-feature dependencies
```

## Technique Selector

Read the AC and the change (task description / requirements / contract; in
main-thread mode also the diff), find which signals are present, apply **only**
the techniques those signals trigger. A technique whose signal is absent
produces zero items.

| Signal in the AC / change | Technique |
|---|---|
| Range, limit, min/max, duration, date window | Boundary Value Analysis |
| Set of values handled the same way (роль, статус, тип) | Equivalence Partitioning |
| Several conditions combining into different outcomes | Decision Table |
| Entity lifecycle, statuses, transitions | State Transition (+ forbidden transitions) |
| 3+ independent flags/parameters | Pairwise |
| Entity is created / updated / deleted | CRUD matrix + idempotency, concurrency |
| Long "если A и B, то X" chain in the AC text | Cause-Effect Graphing |
| Change lands in an area with known defect history | Error Guessing (domain taxonomy) |

Methods, worked domain examples, expected item yield per technique and the
traps of each: [techniques.md](techniques.md).

## API Contract Analysis

When analyzing OpenAPI/Swagger:
1. Endpoint purpose and HTTP method
2. Request: path params, query params, headers, body schemas
3. Responses: success (200/201), errors (400/401/403/404/500), schemas
4. Auth requirements (what tokens/roles)
5. Business rules (validation, state transitions, constraints)
6. Edge cases from schema (nullable, min/max, enums)

## Postman Request Format

```json
{
  "name": "Request Name",
  "request": {
    "method": "POST",
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Authorization", "value": "Bearer {{token}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{ \"field\": \"value\" }"
    },
    "url": {
      "raw": "{{baseUrl}}/api/endpoint",
      "host": ["{{baseUrl}}"],
      "path": ["api", "endpoint"]
    }
  }
}
```

## Allure TestOps Normalization

Normalize test cases to this structure:

```markdown
ID: <id or auto>
Title: <clear scenario name>

Layer: api|ui
Component: <service-name>
Priority: High|Medium|Low
Type: smoke|regression|acceptance

Tags:
- @allure.id:<ID>
- @allure.label.layer:api
- @allure.label.component:<component>

Description:
<1-3 sentences>

Preconditions:
- <precondition>

Steps:
1. <Action> <METHOD> <PATH>       # API: parent step
   - Attachment: { "field": "value" }  # child = body only, no method/path
2. ...

Expected result:
- <observable outcome>
```

**Rules:**
- Parent step: `<description> POST /api/path`
- Child step attachment: request body only (no endpoint duplication)
- Preserve original language (RU/EN)
- Never invent endpoints — find from OpenAPI spec

## IEEE 829 Test Plan Structure

13 sections:
1. Test Plan ID (`TP-PROJECT-001`, version, date)
2. Introduction (goals, context, scope)
3. Test Items (specific endpoints/pages/components)
4. Features to Test (business functions)
5. Approach (levels: unit/integration/system; types: smoke/regression; techniques: BVA/EP)
6. Pass/Fail Criteria (100% smoke pass, ≥95% regression pass)
7. Deliverables (test cases, reports, collections)
8. Testing Tasks (table: task | responsible | deadline)
9. Environment (stand, tools, test data)
10. Responsibilities (table: role | person | duties)
11. Schedule (table: phase | start | end | comment)
12. Risks (table: risk | probability | impact | mitigation)
13. Approvals

## Qase.io CSV Import Format

Qase UI import ("Import Data" → source Qase.io) accepts ONLY their exact template — any other structure fails with `"Invalid Qase CSV file."`. Never invent headers, never capitalize enum values.

**26 exact headers (order/casing fixed):**
```
v2.id,title,description,preconditions,postconditions,tags,priority,severity,type,behavior,automation,status,is_flaky,layer,steps_type,steps_actions,steps_result,steps_data,milestone_id,milestone,suite_id,suite_parent_id,suite,suite_without_cases,parameters,is_muted
```

**Rules:**
- Values are lowercase API slugs: priority `undefined|high|medium|low`, severity `normal|critical|major`, automation `is-not-automated|to-be-automated|automated`, status `actual|draft`, layer `unknown|api|e2e`, steps_type `classic|gherkin`.
- Suites = their own rows: case columns empty, set `suite_id`, `suite` (name), `suite_without_cases=1`, `suite_parent_id` for nesting. Case rows reference `suite_id` + repeat `suite` name.
- Steps of a case packed into ONE cell per column (`steps_actions`/`steps_result`/`steps_data`), numbered multiline: `1. "action"\n2. "action"`. Empty step = `1. ""`. Nested substeps = tab-indented sub-numbering.
- Sanitize inner double-quotes in step text (→ `'`).
- Official template: https://drive.google.com/uc?export=download&id=1QGcRpFcoQk8tJnObh_u7E-gRVjhsJi9c
- API path (`api.qase.io` REST/MCP) may be network-blocked — CSV via UI is the fallback that always works.
