# System diagram

![AI Weave platform — request-authorization architecture](system-diagram.svg)

How a click in the tarunraja.info admin UI becomes a committed write. Two
gates, not one: **identity** (wallet connect + SIWE session, via AuthChain)
decides who may open the admin UI at all; **authorization**
([mcp-observatory](https://github.com/rajatarun/mcp-observatory)'s
propose → score six risk signals → commit/block contract) decides whether
the specific action that UI is trying to take may proceed. The two admin
tabs — the existing Content Manager and the newer Control Room — sit behind
the same identity gate and stage every consequential action through the
same authorization gate before
[ai-content-orchestrator](https://github.com/rajatarun/ai-content-orchestrator)
or [RoutineWeave](https://github.com/rajatarun/RoutineWeave) is allowed to
write. The public site (`/site/posts`, `/public/subscribe`) sits outside
both gates by design — it's read-only content, not an action.

The same propose → commit contract is what [TeamWeave](https://github.com/rajatarun/TeamWeave)'s
agent tool calls run through, and what the rest of the platform —
ToolWeave, CipherWeave, DeviceWeave, ScreenWeave, the
TrainWeave → DeployWeave fine-tuning flywheel, DataDictionary, IntentWeave,
PromptWeave — is wired into. mcp-observatory is the one thing that
verifiably touches all of them; everything else in this diagram is the
specific, current flow the two gates were built to protect.

`system-diagram.svg` is hand-authored inline SVG — no build step, themed
for light and dark via `prefers-color-scheme`, matching the Tantu design
tokens (`src/tantu/tokens/tantu.tokens.json`) used elsewhere in this repo.
