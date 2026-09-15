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
agent tool calls run through, and what six other platform services —
[ToolWeave](https://github.com/rajatarun/ToolWeave),
[CipherWeave](https://github.com/rajatarun/CipherWeave),
[DeviceWeave](https://github.com/rajatarun/DeviceWeave),
[ScreenWeave](https://github.com/rajatarun/ScreenWeave),
[DeployWeave](https://github.com/rajatarun/DeployWeave), and
[DataDictionary](https://github.com/rajatarun/DataDictionary) — are wired
into. Each of those six is drawn as its own box and confirmed individually
(source or README) to integrate mcp-observatory, rather than asserted as a
group; they're fed by one shared rail rather than six separate arrows
converging on the gate, since that's what they share — one contract, not
one flow. [TrainWeave](https://github.com/rajatarun/TrainWeave) is drawn
alongside them but *without* a rail connection: it's a batch EC2 Spot LoRA
fine-tuning job with no interactive gated action of its own; its real
relationship in this diagram is the flywheel arrow into DeployWeave.

IntentWeave and PromptWeave are **not** drawn as peer services. Both are
reserved repository names with no code — checked directly, not assumed —
so drawing them as active boxes wired to the gate would have been the
diagram asserting something false. They're shown as dashed, named
placeholders instead, each pointing to where its described capability
actually lives today: IntentWeave's in DeviceWeave and ToolWeave;
PromptWeave's in TeamWeave, RoutineWeave, and ai-content-orchestrator.

`system-diagram.svg` is hand-authored inline SVG — no build step, themed
for light and dark via `prefers-color-scheme`, matching the Tantu design
tokens (`src/tantu/tokens/tantu.tokens.json`) used elsewhere in this repo.
