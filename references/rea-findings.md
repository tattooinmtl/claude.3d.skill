# REA findings on the Meshy MCP server

This is the evidence behind this plugin. It was produced by pointing REA
(reverse-engineer-anything) at the built Meshy MCP server and comparing what
it found **statically** against what the server publishes **live**.

Why keep it: a tool list written from a README drifts. A tool list written
from the server's own `tools/list` does not. This plugin's reference is
generated from that list, and this document explains what the static pass
found that the live pass could not.

## The method

Two passes, deliberately different, so they can be compared.

**Static.** REA's `analyze_javascript_application` reconstructs the
application graph from the built bundle without executing it. What the code
says it does.

**Live.** The server is started over stdio and asked for `tools/list`. What a
client actually receives.

Where the two disagree, the disagreement is the finding.

## What REA recovered

REA 6.4.0, MCP protocol 2024-11-05, 170 tools advertised.

| Measure | `meshy-mcp-server` 0.6.5 | `meshy-3d-agent` |
|---|---|---|
| Files parsed | 68 | 4 |
| Bytes read | 401,177 | 66,493 |
| AST nodes visited | 39,367 | 10,386 |
| Findings | 730 | 90 |
| **Parse failures** | **0** | **0** |
| **Invalid UTF-8 files** | **0** | **0** |
| Coverage | complete, 0 omitted, not truncated | complete |
| Integrity contradictions | 0 | 0 |
| Graph nodes / edges | 496 / 866 | 76 / 101 |
| Semantic nodes / relations | 19,874 / 15,624 | 8,001 / 8,792 |

Zero parse failures and zero integrity contradictions across 68 files means
the bundle REA read is the bundle that ships. Nothing was skipped and nothing
contradicted itself.

The relation kinds say what the server *does*, rather than what it is named:

| Relation | Count | What it says |
|---|---|---|
| aliases | 5,051 | local-name churn |
| reads | 4,954 | |
| reads-property | 2,047 | |
| defines | 1,667 | |
| captures | 691 | |
| writes-property | 309 | |
| returns-to-call | 242 | |
| calls | 225 | |
| argument-to-parameter | 171 | |
| writes | 102 | |
| awaits | 70 | |
| creates-promise | 8 | |
| reads-config | 8 | |
| **registers-listener** | **5** | the server's own lifecycle |
| **reads-environment** | **7** | `MESHY_API_KEY` and friends |
| **returns-task** | **3** | asynchronous generation |
| **detaches-task** | **2** | cancellation |

The `meshy-3d-agent` pack has a different vocabulary - `connects-stdio` (7),
`spawns` (7), `supplies-env` (7), `forwards-signal` (7), `listens-error` (7),
`supplies-argv` (5). That is the shape of a process supervisor: that pack is
not an MCP server, it is a launcher that runs one. Which is why this plugin
talks to the MCP server directly instead of the CLI the vendor's own plugin
drives.

## The finding worth keeping

25 of the 28 live tool names were attributed to a specific static node with a
source location. All 25 land in the same literal: `instructions.d.ts`, line 6
- the `MESHY_INSTRUCTIONS` string the server hands to the client as its
instructions.

Three did not:

- `meshy_cancel_task`
- `meshy_check_balance`
- `meshy_list_usage`

That is not a REA gap. Confirmed directly against the source:

| Tool | Registered at | In `instructions.ts`? |
|---|---|---|
| `meshy_cancel_task` | `src/tools/tasks.ts:734` | no |
| `meshy_check_balance` | `src/tools/balance.ts:19` | no |
| `meshy_list_usage` | `src/tools/balance.ts:75` | no |

**The vendor's own agent instructions name 25 of its 28 tools and omit exactly
these three.** They are the credit-balance check, the usage breakdown and the
cancellation. An agent that trusts the instructions alone will spend the
user's credits without ever checking the balance, and will not know a
cancellation tool exists - so a stuck generation cannot be stopped.

This plugin is built around that. The `meshy-3d` skill tells the agent to
check the balance *before* an expensive call rather than after a 402, and
`scripts/check-meshy-mcp.mjs` asserts that all three tools are still
published - a check that only counted tools would pass on a server that had
lost them.

## Three things REA could not do here

**No managed artifact to inspect.** `inspect_managed_artifact` needs a
compiled .NET assembly. The Unity plugin ships as C# source - an Editor
asmdef plus `.cs` files - and its `.unitypackage` contains only source, an
icon and a `package.json`. Unity's own managed assemblies are not on the
machine either: the Unity install there is a stub, with no `UnityEngine.dll`
to compile against and no editor to compile with.

**No Python analyzer.** REA covers native binaries, JavaScript/Electron,
.NET assemblies and websites. The Blender and Unity DCC adapters are Python,
so there is no analyzer for them; they were read as source instead.

**Nothing to say about the DCC side.** The four gateway verbs - `search`,
`describe`, `load_skill`, `call` - are a *reduction* by design, not a
subset that REA failed to reach. The gateway publishes four tools and keeps
the full backend surface behind `search`.

## Three things worth remembering about REA itself

**The response budget is real.** The full analysis of the MCP server is
~10.5 MB of MCP response against a ~10 MB budget. `detail: "complete"` fails
with `resource_constraint` even though the analysis itself succeeded. The
remedy REA gives is the right one: `detail: "summary"` retains the complete
Evidence in-session, and `export_evidence_bundle` writes all of it to a file
(33 MB here).

**With `detail: "summary"`, the evidence id you get back belongs to the
projection, not to the analysis.** The analysis id is
`parameters.parent_evidence_id`. Handing the projection's id to
`inspect_analysis_view` fails with `unsupported_target` and the message
*"Parent Evidence operation `inspect_analysis_view` is not
`inspect_binary_layout`, `analyze_javascript_application` or
`analyze_function`"* - which reads like a REA bug and is really a
parent-pointer mismatch.

**Tool names live in string-literal node values.** A node's
`properties.value` is where `meshy_text_to_3d` and the rest actually sit;
the label and the identity fields do not. A cross-check that only scans
labels finds zero of twenty-eight tool names and looks like a total failure
of the analysis.

## Reproducing this

The probe lives in the notecode checkout, next to the integration that
spawned this plugin:

```powershell
node C:\NexusOne\prototypes\notecode\scripts\rea-meshy-probe.mjs
```

It writes the raw Evidence bundles, the mined graphs, the live tool list and
the cross-check into `rea/findings/`.
