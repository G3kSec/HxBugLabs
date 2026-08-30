# Atlas Payroll — the OTP that never expires

**Category:** Auth · **Difficulty:** Medium

Atlas Payroll puts a second factor in front of every account: a numeric
code, mailed on each sign-in. You have an analyst seat. A payroll
administrator somewhere in the company can approve runs and read every
salary in the org.

Nothing here is a single broken check. The password policy, the sign-in
error messages and the code-delivery flow are each defensible on their
own; the takeover is in how they stack.

## Run it

```bash
docker compose up -d
```

The app is at **http://localhost:8082**.

## Your account

| Email | Password |
| --- | --- |
| `j.moreau@atlas.example` | `Payroll#2024` |

Your corporate webmail is at **/mailbox** and is already signed in as
you. It shows your inbox only — the lab ships Juliette's mail client, not
the mail server, so no other employee's mail is reachable through it. Your
own sign-in codes land there.

## Objectives

Two flags, format `HxBugLabs{...}`. Objective 2 needs a short script;
doing it by hand is not the point. `SOLUTION.md` is a full spoiler.

## Tear down

```bash
docker compose down
```
