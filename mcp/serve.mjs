#!/usr/bin/env node
/**
 * serve.mjs - the launcher for the Meshy MCP server.
 *
 * The plugin does not vendor the server. The server is a TypeScript project
 * with 54 MB of dependencies, and a plugin that carries a build of it is a
 * plugin nobody can move between machines. Instead this launcher finds a
 * server that is already on the machine, and says clearly when it cannot.
 *
 * The search order, first hit wins:
 *
 *   1. MESHY_MCP_SERVER_PATH - a path to dist/index.js, or to the folder
 *      that contains it. Set this when the server lives somewhere unusual.
 *   2. mcp/server.json - {"path": "..."}. Written by
 *      scripts/install-meshy-mcp.ps1, and editable by hand.
 *   3. mcp/meshy-mcp-server/dist/index.js - the plugin's own copy, after
 *      the install script has built it.
 *   4. The build in the notecode checkout, if it is still there.
 *
 * The key is read from mcp/.env (or the plugin root's .env) and put into the
 * environment before the server is imported. The server loads its own .env
 * with dotenv, which does not overwrite a variable that is already set, so
 * this wins - and the server is never told a path it has to find on its own.
 *
 * The server calls main() when it is imported, so importing it is what starts
 * it. Nothing else happens in this file.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, '..');

/**
 * Put KEY=VALUE pairs from a .env file into the environment, without
 * overwriting a variable that is already set.
 */
function loadEnvFile(path) {
  if (!existsSync(path)) return 0;
  let loaded = 0;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const text = line.trim();
    if (!text || text.startsWith('#')) continue;
    const eq = text.indexOf('=');
    if (eq < 0) continue;
    const key = text.slice(0, eq).trim();
    if (!key) continue;
    let value = text.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
      loaded += 1;
    }
  }
  return loaded;
}

// The plugin's own key file wins, then the plugin root's.
const envFiles = [join(here, '.env'), join(pluginRoot, '.env')];
for (const file of envFiles) loadEnvFile(file);

/** Turn a candidate into the path of a built server entry point. */
function entryPoint(candidate) {
  if (!candidate) return null;
  const path = resolve(candidate);
  if (existsSync(path) && path.endsWith('.js')) return path;
  const inside = join(path, 'dist', 'index.js');
  if (existsSync(inside)) return inside;
  return null;
}

function candidates() {
  const list = [];

  if (process.env.MESHY_MCP_SERVER_PATH) {
    list.push(['MESHY_MCP_SERVER_PATH', process.env.MESHY_MCP_SERVER_PATH]);
  }

  const configPath = join(here, 'server.json');
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf8'));
      if (config?.path) list.push(['mcp/server.json', config.path]);
    } catch (err) {
      process.stderr.write(`[meshy] mcp/server.json is not valid JSON: ${err.message}\n`);
    }
  }

  list.push(['the plugin', join(here, 'meshy-mcp-server')]);
  list.push([
    'the notecode checkout',
    'C:/NexusOne/prototypes/notecode/meshy/meshy-mcp-server',
  ]);

  return list;
}

let found = null;
for (const [from, candidate] of candidates()) {
  const entry = entryPoint(candidate);
  if (entry) {
    found = { entry, from };
    break;
  }
}

if (!found) {
  process.stderr.write(
    [
      '',
      '[meshy] The Meshy MCP server was not found on this machine.',
      '',
      '  Looked in:',
      ...candidates().map(([from, candidate]) => `    - ${from}: ${candidate}`),
      '',
      '  Fix it with one of:',
      '    - run  scripts/install-meshy-mcp.ps1  (clones and builds it into this plugin)',
      '    - set  MESHY_MCP_SERVER_PATH  to a built server',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

process.stderr.write(`[meshy] Meshy MCP server: ${found.entry} (from ${found.from})\n`);

if (!process.env.MESHY_API_KEY) {
  process.stderr.write(
    '[meshy] MESHY_API_KEY is not set. The server will still start and list its ' +
      '28 tools, but every call that generates something will fail with 401.\n' +
      '        Put the key in mcp/.env - see the README.\n',
  );
}

// The server starts itself when it is imported.
await import(pathToFileURL(found.entry).href);
