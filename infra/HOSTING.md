# Giving Storybook and the playground their own origins

Both shipped at `https://aiweave.org/storybook/` and `https://aiweave.org/playground/`,
sharing one browser origin with the site (and, until it moved, with
SOUNDING). That move is the precedent this follows — read
[rajatarun/sounding's infra/HOSTING.md](https://github.com/rajatarun/sounding/blob/main/infra/HOSTING.md)
first; this file only covers what is specific to Storybook and the
playground. Everything about *how* — origin shape, certificate, DNS,
cutover order, undo — is identical, because the templates
(`storybook-hosting.yaml`, `playground-hosting.yaml`) are near-duplicates
of `sounding-hosting.yaml` on purpose.

**State of play.** Neither hostname is live. `STORYBOOK_OWN_ORIGIN` and
`PLAYGROUND_OWN_ORIGIN` are unset, so the `storybook` and `playground` jobs
in `.github/workflows/deploy.yaml` keep publishing exactly where they
always have, and `storybook-hosting` / `playground-hosting` do not run.

---

## What's different from SOUNDING here

- **No identity stack.** Neither deliverable has player accounts or saved
  progress, so there is nothing matching `sounding-identity.yaml`.
- **No bridge page.** SOUNDING's bridge exists to carry a player's saved
  progress across the origin change — real state that would otherwise be
  stranded. Storybook and the playground hold nothing per-visitor worth
  carrying across, so cutover is one switch each, not two. The old prefix
  (`storybook/`, `playground/`) simply stops being written once the switch
  is on; whatever was last published there keeps being served, frozen,
  rather than being deleted or replaced.
- **Same certificate and zone, reused, not re-requested.** Both templates
  default `CertificateArn` and `HostedZoneId` empty, but the deploy jobs
  pass the same wildcard certificate and hosted zone `sounding-hosting`
  already uses (`*.aiweave.org` / `Z08177421DQ2ZF8VY74UQ`), overridable via
  `STORYBOOK_CERT_ARN`/`STORYBOOK_HOSTED_ZONE_ID` and
  `PLAYGROUND_CERT_ARN`/`PLAYGROUND_HOSTED_ZONE_ID` if those values ever
  move.
- **`OriginShape=Website` is hardcoded in the workflow**, not read from a
  repository variable, because it must always match whatever
  `sounding-hosting` (and the bucket itself) is actually using. If that
  ever changes to `RestOac`, change all three hosting jobs together — see
  sounding's HOSTING.md § What to check first and § The REST origin trap.

## Verification content check

Each `*-hosting` job's last step fetches the distribution's own domain name
(not the alias — proving the change with nothing pointing DNS at it yet)
and looks for a string that can only be in the right document:

| job | string checked | why it's safe |
|---|---|---|
| `storybook-hosting` | `storybook` (case-insensitive) | Storybook's own default page `<title>` |
| `playground-hosting` | `Tantu Playground` | the playground's `<title>`, see `playground/index.html` |

Same idea as the `sounding` job's `grep -qF -- 'SOUNDING'`, adapted to what
each build actually emits.

## Cutting over

For each deliverable, independently:

1. Set the repository variable — `STORYBOOK_OWN_ORIGIN=true` or
   `PLAYGROUND_OWN_ORIGIN=true` — and run the deploy workflow.
2. The job builds for the domain root, publishes to the new prefix
   (`storybook-app` / `playground-app`), and `needs` gates the matching
   `*-hosting` job to run only after that publish succeeds. The hosting job
   provisions the certificate (if not already covered), the distribution
   and the DNS record, then proves the hostname serves the right content
   before reporting success.
3. Open `https://storybook.aiweave.org/` or `https://playground.aiweave.org/`
   yourself and look. The old subpath (`aiweave.org/storybook/`,
   `aiweave.org/playground/`) keeps serving its last build — nothing there
   breaks the moment the switch flips.
4. Once satisfied, update the one hardcoded link to Storybook —
   `generate_site.jsx`'s "This site is built with Tantu" credit, currently
   `href="/storybook/"` — to `https://storybook.aiweave.org/`, and update
   `src/tantu/README.md`'s Storybook link the same way. Neither is
   changed by this move on its own: they still point at the subpath, which
   is correct as long as that is where Storybook is actually served.
5. Retiring the old prefix (emptying `storybook/` or `playground/` in the
   bucket) is a separate, manual decision — nothing here does it
   automatically, the same way SOUNDING's phase 1 leaves `/sounding/`
   serving the previous build until the bridge is deliberately published
   over it.

## Undo

```bash
aws cloudformation delete-stack --region us-east-1 --stack-name storybook-hosting
aws cloudformation delete-stack --region us-east-1 --stack-name playground-hosting
```

Unset the repository variable(s) and re-run the deploy job to resume
publishing to the subpath. Nothing outside each stack changes state, and
HSTS is the one thing a delete cannot recall from browsers that already
visited — see the `HstsMaxAgeSeconds` parameter in each template.
