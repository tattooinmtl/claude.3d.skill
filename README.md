# claude-meshy

A Claude Code plugin for Meshy: make 3D models, textures, rigs and
animations; check whether a model is printable; and hand the result to
Blender or Unity.

It is built against the **Meshy MCP server** rather than the vendor's CLI,
and it was written from a reverse-engineering pass over that server's source
rather than from its README. The difference shows up in the details - see
[What the REA found](#what-the-rea-found).

## What is in the box

| Component | What it does |
|---|---|
| `skills/meshy-3d/` | The generation skill. The three-step async flow, the real credit costs, and the three tools Meshy's own instructions leave out. |
| `skills/meshy-dcc-handoff/` | Getting a finished model into a running Blender or Unity, and driving those applications. |
| `commands/` | `/meshy-3d:generate`, `/meshy-3d:balance`, `/meshy-3d:print` |
| `agents/meshy-3d.md` | A subagent scoped to 3D work, with the Meshy tools attached. |
| `references/tools.md` | **Generated** from the server's own tool list - all 28 tools, their real parameters, their real costs. |
| `references/rea-findings.md` | The reverse-engineering evidence behind this plugin. |
| `mcp/serve.mjs` | The launcher that finds the server and loads the key. |
| `scripts/` | Install the server, check it, regenerate the tool reference. |

## Install

### 1. The API key

Get one from <https://www.meshy.ai/> - the API needs a **Pro plan or above**;
the free plan does not expose it. Put it in `mcp/.env`:

```
MESHY_API_KEY=your-key-here
```

The server checks the key on the *first tool call*, not at startup. So the
server starts and lists all 28 tools with an empty key, and the failure shows
up as a 401 on the first call that actually generates something.

`mcp/.env` is gitignored. Do not paste a key into a chat.

### 2. The Meshy MCP server

The plugin does not vendor the server - it is 54 MB of dependencies, and a
plugin that carries a build of it is a plugin nobody can move between
machines. The launcher finds one that is already on the machine, in this
order:

1. `MESHY_MCP_SERVER_PATH` - a path to `dist/index.js`, or to the folder
   that contains it.
2. `mcp/server.json` - the path the install script writes.
3. `mcp/meshy-mcp-server/dist/index.js` - the plugin's own copy.
4. The build in the notecode checkout, if it is still there.

To give the plugin its own copy:

```powershell
pwsh -File scripts/install-meshy-mcp.ps1
```

It clones `meshy-dev/meshy-mcp-server`, installs the dependencies, builds
`dist/`, points `mcp/server.json` at the result and checks the server
answers.

### 3. The plugin itself

From a Claude Code session, with this directory as the plugin root:

```
/plugin marketplace add C:\claude_meshy
/plugin install meshy-3d@claude-meshy
```

Or load it for one session:

```
claude --plugin-dir C:\claude_meshy
```

### 4. The DCC side (Blender and Unity)

The gateway that connects to Blender and Unity is a separate piece - the
Meshy DCC core. It is already installed on this machine at
`~/.local/bin/meshy-dcc.exe`, and its own skill is in `~/.claude/skills/meshy-dcc`.

```powershell
meshy-dcc doctor                 # is the local runtime healthy
meshy-dcc list                   # which DCC instances are live right now
meshy-dcc install --dcc-type blender --dcc-path "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --execute
```

**A DCC only becomes an instance while its host application is running.**
Blender publishes its tools when Blender is open and stops when Blender
closes. A Unity project with the package installed but Unity never opened has
no instance either. `meshy-dcc list` shows the difference.

## The two surfaces

| | What it is | Tools |
|---|---|---|
| `meshy` (MCP) | The Meshy cloud API. Generation, texturing, rigging, animation, conversion. | 28 |
| `meshy-dcc` (MCP or CLI) | The DCC gateway - the live Blender and Unity instances. | 4 |

The cloud API makes the model. The gateway puts it where the user can see it.

The gateway deliberately publishes only four tools - `search`, `describe`,
`load_skill`, `call` - because the full backend surface is far too large to
hand a model. You search for a capability, describe it to get its schema,
load its skill, and call it.

## What the REA found

REA 6.4.0 was pointed at the built server and the result was diffed against
a live `tools/list`. The full write-up is in
[`references/rea-findings.md`](references/rea-findings.md). The short version:

**Meshy's own agent instructions name 25 of its 28 tools.** They never mention
`meshy_check_balance`, `meshy_list_usage` or `meshy_cancel_task` - all three
are registered, all three appear in the live tool list, and the source
confirms it (`src/tools/balance.ts:19`, `src/tools/balance.ts:75`,
`src/tools/tasks.ts:734`).

An agent that trusts that prose will spend the user's credits without ever
checking the balance, and will not know that a stuck generation can be
cancelled. This plugin is built around that:

- the skill says to check the balance **before** an expensive call, not
  after a 402;
- `scripts/check-meshy-mcp.mjs` asserts that all three tools are still
  published - a check that only counted tools would pass on a server that had
  lost them.

The static pass also confirmed the bundle is clean: 68 files, 39,367 AST
nodes, **0 parse failures, 0 invalid UTF-8, 0 integrity contradictions**, and
coverage complete rather than truncated.

## Checking it

```powershell
node scripts/check-meshy-mcp.mjs        # the server starts and publishes what it should
node scripts/build-tools-reference.mjs  # regenerate references/tools.md
```

`check-meshy-mcp.mjs` starts the server the way Claude Code does, through
`mcp/serve.mjs`, and asserts the tool count, the six tools the skills depend
on, and that every tool name is a `meshy_*` name.

## Layout

```
claude_meshy/
├─ .claude-plugin/
│  ├─ plugin.json            the manifest
│  └─ marketplace.json       so the directory can be added as a local marketplace
├─ .mcp.json                 the plugin's MCP server
├─ mcp/
│  ├─ serve.mjs              the launcher
│  ├─ server.json            where the server lives
│  └─ .env                   the API key (gitignored)
├─ skills/
│  ├─ meshy-3d/SKILL.md
│  └─ meshy-dcc-handoff/SKILL.md
├─ commands/
│  ├─ balance.md
│  ├─ generate.md
│  └─ print.md
├─ agents/meshy-3d.md
├─ references/
│  ├─ tools.md               generated from the live tool list
│  └─ rea-findings.md
└─ scripts/
   ├─ install-meshy-mcp.ps1
   ├─ check-meshy-mcp.mjs
   └─ build-tools-reference.mjs
```

## Troubleshooting

**The server does not start.** `mcp/serve.mjs` prints every path it tried.
Run `scripts/install-meshy-mcp.ps1`, or set `MESHY_MCP_SERVER_PATH`.

**Every call fails with 401.** The key is missing or wrong. It goes in
`mcp/.env`, and the server has to be restarted to pick it up.

**`meshy-dcc list` is empty.** No host application is running. Open Blender,
or open the Unity project. An adapter that is installed but whose host is
closed publishes nothing.

**A task is stuck.** `meshy_cancel_task` - free, and the vendor's own
instructions never mention it.

## Related

This plugin and the notecode integration at
`C:\NexusOne\prototypes\notecode` share one build of the Meshy MCP server.
The REA probe that produced this plugin's evidence lives there, at
`scripts/rea-meshy-probe.mjs`.

## License

MIT. The Meshy MCP server, the DCC core and the Blender and Unity adapters
are Meshy's, under their own licences.
