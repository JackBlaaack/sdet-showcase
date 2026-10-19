# Test Design Techniques — Details

Loaded on demand from `SKILL.md`. Pick techniques via the selector table in
`SKILL.md`; apply only the ones whose signal is present. Domain examples use the
`orders-sut` online shop (заказ, товар, купон, остаток, статус заказа) — they are
illustrations of the technique, not a claim about current behaviour. Take real
field names, statuses and error codes from `spec/openapi.json` and the requirements
before writing a check (main-thread mode: also from the code, with `file:line` —
see «Source modes» in `SKILL.md`). Not found in the allowed sources → open question,
not an invented name.

---

## 1. Boundary Value Analysis (BVA)

**Signal:** range, limit, min/max, duration, count, TTL, date window.

**Method:** for a range `[min, max]` test `min-1, min, min+1, max-1, max, max+1`.
Two-value BVA (`min-1, min, max, max+1`) is enough when the middle is covered by
an equivalence-partitioning check.

```
quantity 1–99 (позиция заказа) → 0, 1, 2, 98, 99, 100
items 1–20 (позиций в заказе)  → 0, 1, 20, 21
couponCode ≤ 40 символов       → 40, 41
paymentToken 1–64 символа      → 0, 1, 64, 65
```

**Yield:** 2–4 checks per boundary. Only boundaries the change actually touches.
A limit that existed before and is untouched by the task → not in the checklist.

**Trap:** numbers have *two* boundaries — value and type. `quantity: 2.5` or
`"2"` is a separate type check, and only if the change touches input validation.

---

## 2. Equivalence Partitioning (EP)

**Signal:** a set of values with the same handling — роль, статус заказа,
токен оплаты, тип скидки.

**Method:** split the input into classes where behaviour is identical, take one
representative per class, plus one invalid class.

```
роль запроса: без токена | customer | admin → 1 проверка на класс, если AC различает
paymentToken: tok_ok | tok_declined | tok_insufficient | tok_timeout | tok_error
              → по одной проверке на класс, если AC даёт разный результат
invalid: quantity = "two" (строка вместо числа) → 1 проверка
```

**Yield:** 1 check per class. N classes → N checks, not N².

**Trap:** classes are defined by *behaviour*, not by enum size. If AC treats two
enum values identically, they are one class — one check, not two.

---

## 3. Decision Table

**Signal:** several conditions combine into different outcomes; AC reads
"если A и B, то X; если A и не B, то Y".

**Method:** enumerate condition combinations, collapse rows where a condition is
irrelevant (`any`), one check per surviving row.

| Токен валиден | Заказ существует | Статус заказа | Результат `POST /orders/{id}/cancel` |
|---|---|---|---|
| да | да | NEW | 200, статус CANCELLED |
| да | да | PAID | 200, статус REFUNDED |
| да | да | SHIPPED / DELIVERED / CANCELLED / REFUNDED | 409 — открытый вопрос: в спеке сказано только «NEW → CANCELLED, PAID → REFUNDED» |
| да | нет | any | 404 |
| нет | any | any | 401 |

**Yield:** 1 check per row after collapsing. 5 rows above instead of 16 raw
combinations.

**Trap:** collapsing to `any` must be justified by the requirement, not by
intuition — if AC does not say the condition is irrelevant, keep the rows split
and mark it as an open question.

---

## 4. State Transition

**Signal:** entity has a lifecycle — статус заказа, статус оплаты, состояние
остатка.

**Method:** draw states, list allowed transitions, then test (a) each allowed
transition the change touches, (b) the *forbidden* transitions — they are where
bugs live.

```
NEW → PAID → SHIPPED → DELIVERED
 ↓      ↓
CANCELLED  REFUNDED       (cancel: NEW → CANCELLED, PAID → REFUNDED)

Запрещённые (проверять!): NEW → SHIPPED       (ship без оплаты)
                          SHIPPED → REFUNDED  (cancel на отгруженном)
                          CANCELLED → PAID    (оплата отменённого)
```

**Yield:** 1 check per touched allowed transition + 1–3 for the most dangerous
forbidden ones. Not the full N×N matrix.

**Trap:** a forbidden transition check must state the observable rejection
(HTTP-код / тело ошибки), otherwise it is untestable. The spec documents `409`
for pay/cancel/ship/deliver; if the requirement names no code for a specific
forbidden transition → open question, never invent one.

---

## 5. Pairwise (All-Pairs)

**Signal:** 3+ independent flags/parameters, full combinatorics explodes.

**Method:** cover every *pair* of parameter values at least once instead of every
combination. Most defects are triggered by one parameter or one pair.

```
Параметры: токен оплаты (3: tok_ok | tok_declined | tok_timeout)
         × купон (2: без | процентный)
         × роль (3: без токена | customer | admin)
Полный перебор: 18
Pairwise: 9 наборов — каждая пара значений встречается ≥1 раза
```

Build the set with a generator (PICT, allpairspy) or by hand for small cases;
state in the checklist that coverage is pairwise, not exhaustive.

**Yield:** roughly `max(|P1|×|P2|)` checks for the two largest parameters.

**Trap:** pairwise is invalid when parameters interact in a known 3-way rule —
that rule goes into a decision table as an explicit case, and pairwise covers
the rest.

---

## 6. CRUD / Data Lifecycle

**Signal:** the change creates, reads, updates or deletes an entity (заказ,
товар, купон).

**Method:** matrix entity × operation; for each touched cell check the effect on
*state*, not only the response code. For API, add idempotency and concurrency.

| Сущность | Create | Read | Update | Delete |
|---|---|---|---|---|
| заказ | 201, остаток зарезервирован, есть в `GET /orders/{id}` | клиент видит свои, admin — все | pay / cancel / ship / deliver меняют статус | нет endpoint, вместо него cancel |
| товар | 201 (admin) | `GET /products`, `GET /products/{id}` | PATCH цены/остатка/видимости; существующие заказы сохраняют цены | нет endpoint |

Extra checks for touched write operations:
- повторная оплата с тем же `Idempotency-Key` → тот же результат, не двойное списание (идемпотентность);
- два параллельных заказа на последнюю единицу остатка → один успех, второй отказ (код ответа — по контракту, иначе открытый вопрос);
- отмена заказа → связанные сущности согласованы (остаток вернулся, статус обновился).

**Yield:** 1 check per touched cell + 1–2 for идемпотентность/гонка when the
operation writes.

**Trap:** "виден в списке" and "лежит в БД" are different checks. Pick the one
the AC actually promises.

---

## 7. Cause-Effect Graphing (CEG)

**Signal:** one AC paragraph packs a long chain of conditions and effects
(illustrative AC: «если подытог не меньше минимальной суммы купона, купон не
просрочен и лимит использований не исчерпан, скидка применяется, а счётчик
использований увеличивается»).

**Method:** extract causes (C1..Cn) and effects (E1..Em) from the text, link them
with AND/OR/NOT, then derive the minimal set of cause combinations that produce
each effect. Result feeds a decision table.

```
C1: подытог ≥ minSubtotalCents
C2: купон не просрочен (expiresAt)
C3: usedCount < usageLimit
E1: скидка применена
E2: usedCount увеличен

C1 AND C2 AND C3 → E1 AND E2
NOT C1           → нет E1;  что именно вернётся (отказ или заказ без скидки) — открытый вопрос, в AC не сказано
```

**Yield:** 2–5 checks, plus — the real value — a list of gaps in the AC where a
cause combination has no defined effect. Those go to the analyst, not the
checklist.

**Trap:** CEG output is only as good as the AC text. Do not fill an undefined
combination with a guess — record it as an open question.

---

## 8. Error Guessing (domain taxonomy)

**Signal:** the change touches an area with a known defect history. Use the
taxonomy, not generic "unicode/emoji/malformed JSON" lists.

| Область изменения | Что подозревать |
|---|---|
| Создание заказа | 200 вместо 201, двойной сабмит → дубль заказа и двойное резервирование остатка |
| Купоны | округление скидки (проценты × центы), граница `minSubtotalCents` (`>` vs `>=`), последнее использование при `usageLimit`, просроченный `expiresAt` |
| Остаток | гонка за последнюю единицу, остаток уходит в минус, остаток не возвращается при отмене |
| Оплата | повтор без `Idempotency-Key` → двойное списание; `tok_timeout`, 502, 504 оставляют заказ в промежуточном состоянии |
| Права | чужой заказ должен выглядеть как отсутствующий (404); ship/deliver от customer → 403 |
| Цена | существующий заказ сохраняет цену на момент покупки после PATCH товара |
| Контракт API | v1 vs v2: разная форма сумм; поле в ответе, которого нет в спеке; nullable (`couponCode`, `chargeId`) для старого клиента |

**Yield:** 0–3 checks. Zero is a valid answer when the change does not touch any
row.

**Trap:** this is the technique that most easily generates irrelevant items.
A row applies only if the changed code actually reaches that area — otherwise
it is regression of someone else's feature and does not belong in this task.
