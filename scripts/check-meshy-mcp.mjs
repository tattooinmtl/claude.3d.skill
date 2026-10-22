#!/usr/bin/env node
/**
 * check-meshy-mcp.mjs
 *
 * Starts the plugin's Meshy MCP server the way Claude Code would - through
 * mcp/serve.mjs - and checks what it publishes.
 *
 * The assertion that matters is not the count. It is that the three tools
 * Meshy's own agent instructions leave out are still there:
 * meshy_check_balance, meshy_list_usage and meshy_cancel_task. They are
 * registered in the server, they are in the live tool list, and the vendor's
 * instructions.ts never mentions them. A check that only counted tools would
 * pass on a server that had lost them.
 *
 * Usage: node scripts/check-meshy-mcp.mjs
 */

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = join(here, '..');

/** The three tools Meshy's own instructions omit, and that the skills rely on. */
const MUST_HAVE = [
  'meshy_text_to_3d',
  'meshy_get_task_status',
  'meshy_download_model',
  'meshy_check_balance',
  'meshy_list_usage',
  'meshy_cancel_task',
];

const EXPECTED_COUNT = 28;

const child = spawn('node', [join(pluginRoot, 'mcp', 'serve.mjs')], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

const pending = new Map();
let nextId = 1;
let buffer = '';
const stderr = [];

child.stdout.setEncoding('utf8');
child.stdout.on('data', (chunk) => {
  buffer += chunk;
  let i;
  while ((i = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, i).trim();
    buffer = buffer.slice(i + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

child.stderr.setEncoding('utf8');
child.stderr.on('data', (c) => stderr.push(String(c)));

const request = (method, params, timeoutMs = 60000) =>
  new Promise((resolve) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve({ id, error: { message: `timeout after ${timeoutMs}ms` } });
    }, timeoutMs);
    pending.set(id, (m) => { clearTimeout(timer); resolve(m); });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });

let failures = 0;
function check(label, ok, detail) {
  if (!ok) failures += 1;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ` - ${detail}` : ''}`);
}

const init = await request('initialize', {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: { name: 'claude-meshy-check', version: '0.1.0' },
});
child.stdin.write(
  JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n',
);

if (init?.error) {
  check('the server starts', false, init.error.message);
  console.log(stderr.join(''));
  process.exit(1);
}

const server = init?.result?.serverInfo ?? {};
check('the server starts', true, `${server.name} ${server.version}`);

const list = await request('tools/list', {});
if (list?.error) {
  check('the tool list arrives', false, list.error.message);
  console.log(stderr.join(''));
  process.exit(1);
}

const names = (list?.result?.tools ?? []).map((t) => t.name);
check(`the server publishes ${EXPECTED_COUNT} tools`, names.length === EXPECTED_COUNT, `got ${names.length}`);

for (const tool of MUST_HAVE) {
  check(`publishes ${tool}`, names.includes(tool));
}

const missing = names.filter((n) => !/^meshy_[a-z0-9_]+$/.test(n));
check('every tool name is a meshy_* name', missing.length === 0, missing.join(', '));

child.stdin.end();

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  console.log(stderr.join(''));
  process.exit(1);
}
console.log('\nThe plugin\'s Meshy MCP server is answering as expected.');
process.exit(0);
