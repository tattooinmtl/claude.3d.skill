# ---------------------------------------------------------------------------
# install-meshy-mcp.ps1
#
# Clones and builds the Meshy MCP server into this plugin, so the plugin
# carries a working server of its own instead of depending on another
# checkout being present.
#
# The plugin resolves the server from, in order: MESHY_MCP_SERVER_PATH,
# mcp/server.json, this plugin's own copy, and the notecode checkout. This
# script installs the third and points the second at it.
#
# Usage:
#   pwsh -File scripts/install-meshy-mcp.ps1
#   pwsh -File scripts/install-meshy-mcp.ps1 -Version 0.6.5
# ---------------------------------------------------------------------------

[CmdletBinding()]
param(
    [string] $Version = '0.6.5',
    [string] $Repo    = 'https://github.com/meshy-dev/meshy-mcp-server.git'
)

$ErrorActionPreference = 'Stop'
$pluginRoot = Split-Path -Parent $PSScriptRoot
$target = Join-Path $pluginRoot 'mcp\meshy-mcp-server'

function Step($m) { Write-Host "`n=== $m ===" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "  OK   $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  WARN $m" -ForegroundColor Yellow }
function Die($m)  { Write-Host "  FAIL $m" -ForegroundColor Red; exit 1 }

Step 'Checking the toolchain'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Die 'node is not on PATH' }
$nodeMajor = (node -p 'process.versions.node.split(".")[0]')
if ([int]$nodeMajor -lt 20) { Die "node 20 or newer is required (found $nodeMajor)" }
Ok "node $(node --version)"
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Die 'git is not on PATH' }
if (-not (Get-Command npm  -ErrorAction SilentlyContinue)) { Die 'npm is not on PATH' }

Step "Fetching the Meshy MCP server $Version"
if (Test-Path (Join-Path $target '.git')) {
    Ok 'already cloned - updating'
    git -C $target fetch --depth 1 --quiet origin "v$Version" 2>&1 | Out-Null
    git -C $target checkout --quiet FETCH_HEAD 2>&1 | Out-Null
}
else {
    git clone --depth 1 --branch "v$Version" --quiet $Repo $target
    if ($LASTEXITCODE -ne 0) { Die "git clone failed (tag v$Version not found?)" }
    Ok "cloned into $target"
}

Step 'Installing the dependencies'
Push-Location $target
try {
    npm install --omit=dev --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Die 'npm install failed' }
    Ok 'dependencies installed'

    Step 'Building'
    # The build needs the dev dependencies (typescript), so they go back for
    # the build and the tree is trimmed afterwards.
    npm install --no-audit --no-fund
    npm run build
    if ($LASTEXITCODE -ne 0) { Die 'npm run build failed' }
    $files = (Get-ChildItem 'dist' -Recurse -File | Measure-Object).Count
    Ok "dist/ built ($files files)"
}
finally { Pop-Location }

Step 'Pointing the plugin at the server'
$config = @{
    '$comment' = 'Where the Meshy MCP server lives. Written by scripts/install-meshy-mcp.ps1, and editable by hand. The path may point at the built dist/index.js or at the folder that contains it.'
    'path'     = ($target -replace '\\', '/')
} | ConvertTo-Json
Set-Content -Path (Join-Path $pluginRoot 'mcp\server.json') -Value $config -Encoding utf8
Ok "mcp/server.json -> $target"

$keyFile = Join-Path $pluginRoot 'mcp\.env'
if (-not (Test-Path $keyFile)) {
    @(
        '# The Meshy API key for this plugin.',
        '# Get one from https://www.meshy.ai/ - the API needs a Pro plan or above.',
        'MESHY_API_KEY='
    ) | Set-Content -Path $keyFile -Encoding utf8
    Ok "created mcp/.env - put your key in it"
}
elseif ((Get-Content $keyFile -Raw) -match '(?m)^MESHY_API_KEY=\s*$') {
    Warn 'mcp/.env has no key yet - every generating call will fail with 401'
}

Step 'Checking the server answers'
$check = Join-Path $PSScriptRoot 'check-meshy-mcp.mjs'
if (Test-Path $check) {
    node $check
    if ($LASTEXITCODE -ne 0) { Die 'the server did not answer as expected' }
}

Step 'Done'
Write-Host '  The plugin now carries its own server. Put your key in mcp/.env' -ForegroundColor Gray
Write-Host '  before the first generation call.' -ForegroundColor Gray
