# Labs

Twelve labs across twelve categories — browse them on the
[catalog site](https://buglabs.hxhunt.com/labs) or in the folders below.
Read [SECURITY.md](../SECURITY.md) before running anything that lands here.

Each category gets its own directory, one subfolder per lab:

```
labs/<category-slug>/<lab-slug>/
```

| Difficulty | Labs |
| --- | --- |
| Easy | `recon/vega-exposed-artifacts` · `idor/clearline-tenant-boundary` · `file-upload/atrium-avatar-pipeline` |
| Medium | `auth/atlas-stepup-mfa` · `ssrf/quill-webhook-allowlist` · `race-condition/corvus-ledger-toctou` · `sqli/blackthorn-operator-injection` |
| Hard | `xss/mosaic-status-mxss` · `api-graphql/orion-blind-schema` · `cache-poisoning/harbor-edge-confusion` · `prototype-pollution/kestrel-report-merge` · `ssti/lantern-campaign-preview` |

Every lab publishes a unique port, so several can run side by side. Start
with the lab's own `README.md` for credentials and scope; `SOLUTION.md` is
a full spoiler.
