# dev.ps1 - Aegis AI one-command launcher (Windows / macOS / Linux).
#
#   Windows : double-click dev.bat  (or .\dev.ps1 in PowerShell)
#   macOS   : pwsh -File dev.ps1    (or use ./dev.sh)
#
# Starts PostgreSQL if unreachable (Windows service / brew / pg_ctl), the
# FastAPI backend on :8000 and the Vite console on :5173, waits for readiness
# and streams prefixed logs. Ctrl+C stops both servers.

$ErrorActionPreference = 'Stop'

# --- configuration ------------------------------------------------------------
$Root         = $PSScriptRoot
$BackendDir   = Join-Path $Root 'backend'
$FrontendDir  = Join-Path $Root 'frontend'
$BackendPort  = 8000
$FrontendPort = 5173
$BackendUrl   = "http://localhost:$BackendPort"

# $IsWindows exists on PowerShell 6+; assume Windows on the legacy 5.1 shell.
if ($PSVersionTable.PSVersion.Major -ge 6) { $IsWin = [bool]$IsWindows }
else { $IsWin = $true }

if ($IsWin) { $VenvPython = Join-Path $BackendDir '.venv\Scripts\python.exe' }
else        { $VenvPython = Join-Path $BackendDir '.venv/bin/python' }
$VenvDir = Join-Path $BackendDir '.venv'

function Write-Dev([string]$Message)   { Write-Host "[dev] $Message" -ForegroundColor DarkGray }
function Write-Backend([string]$Msg)   { Write-Host "[backend] $Msg"  -ForegroundColor Green }
function Write-Frontend([string]$Msg)  { Write-Host "[frontend] $Msg" -ForegroundColor Cyan }
function Write-Warn2([string]$Message) { Write-Host "[dev] $Message"   -ForegroundColor Yellow }
function Write-Die([string]$Message)   { Write-Host "[dev] $Message"   -ForegroundColor Red; exit 1 }

function Test-Port([int]$Port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    if ($async.AsyncWaitHandle.WaitOne(300) -and $client.Connected) { return $true }
    return $false
  } catch { return $false } finally { $client.Close() }
}

function Wait-Http([string]$Url, [int]$Tries = 40) {
  for ($i = 0; $i -lt $Tries; $i++) {
    try {
      Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop | Out-Null
      return $true
    } catch { Start-Sleep -Seconds 1 }
  }
  return $false
}

# Run a native command with stderr discarded, ignoring its exit code.
function Invoke-Quiet([scriptblock]$Block) {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  & $Block *> $null
  $ErrorActionPreference = $prev
}

# --- 0. Prerequisites ----------------------------------------------------------
$PyCmd = $null
if    (Get-Command py      -ErrorAction SilentlyContinue) { $PyCmd = @('py', '-3') }
elseif (Get-Command python3 -ErrorAction SilentlyContinue) { $PyCmd = @('python3') }
elseif (Get-Command python -ErrorAction SilentlyContinue) { $PyCmd = @('python') }
if (-not $PyCmd)  { Write-Die 'Python 3.12+ not found (py launcher or python3/python on PATH).' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Die 'node not found - install Node 18+.' }
if (-not (Get-Command npm  -ErrorAction SilentlyContinue)) { Write-Die 'npm not found - install Node 18+.' }

# --- 1. Backend env + venv -------------------------------------------------------
$EnvFile = Join-Path $BackendDir '.env'
if (-not (Test-Path $EnvFile)) {
  Copy-Item (Join-Path $BackendDir '.env.example') $EnvFile
  Write-Dev 'created backend/.env from backend/.env.example'
}

$depsOk = $false
if (Test-Path $VenvPython) {
  Invoke-Quiet { & $VenvPython -c 'import uvicorn, fastapi, sqlalchemy' }
  if ($LASTEXITCODE -eq 0) { $depsOk = $true }
}
if (-not $depsOk) {
  Write-Dev 'backend dependencies missing - creating .venv and installing (one-time)...'
  if (Test-Path $VenvDir) { Remove-Item -Recurse -Force $VenvDir }
  & $PyCmd[0] $PyCmd[1..($PyCmd.Count-1)] -m venv $VenvDir
  if ($LASTEXITCODE -ne 0) { Write-Die 'could not create the Python virtual environment.' }
  $uv = Get-Command uv -ErrorAction SilentlyContinue
  if ($uv) {
    & $uv.Source pip install -q -p $VenvPython -e '.[dev]'
  } else {
    & $VenvPython -m pip install -q --upgrade pip
    & $VenvPython -m pip install -q -e '.[dev]'
  }
  if ($LASTEXITCODE -ne 0) { Write-Die 'backend dependency install failed.' }
  Write-Backend 'dependencies installed.'
}

# --- 2. Database -------------------------------------------------------------------
if (-not (Test-Port 5432)) {
  Write-Warn2 'PostgreSQL not reachable on :5432 - attempting to start it...'
  if ($IsWin) {
    $svc = Get-Service -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -like '*postgres*' -or $_.DisplayName -like '*PostgreSQL*' } |
      Select-Object -First 1
    if ($svc) {
      if ($svc.Status -ne 'Running') {
        try { Start-Service -Name $svc.Name -ErrorAction Stop }
        catch { Write-Warn2 "could not start service '$($svc.Name)' - try running PowerShell as Administrator." }
      }
    } else {
      Write-Warn2 'no PostgreSQL Windows service found - install it from https://www.postgresql.org/download/windows/'
    }
  } else {
    $pgCtl = '/opt/homebrew/opt/postgresql@17/bin/pg_ctl'
    $pgData = '/opt/homebrew/var/postgresql@17'
    if ((Test-Path $pgCtl) -and (Test-Path $pgData)) {
      & $pgCtl -D $pgData -l '/tmp/aegis-postgres.log' start 2>$null | Out-Null
    } elseif (Get-Command brew -ErrorAction SilentlyContinue) {
      brew services start postgresql@17 2>$null | Out-Null
      if (-not (Test-Port 5432)) { brew services start postgresql 2>$null | Out-Null }
    }
  }
  for ($i = 0; $i -lt 10 -and -not (Test-Port 5432); $i++) { Start-Sleep -Seconds 1 }
}

if (Test-Port 5432) {
  # Best effort: create the demo role/database on a fresh Postgres install.
  $psql = $null
  $cmd = Get-Command psql -ErrorAction SilentlyContinue
  if ($cmd) { $psql = $cmd.Source }
  else {
    foreach ($base in @('C:\Program Files\PostgreSQL', '/opt/homebrew/opt/postgresql@17/bin', '/opt/homebrew/opt/postgresql/bin')) {
      if (-not (Test-Path $base)) { continue }
      if ($IsWin) {
        $cand = Get-ChildItem $base -Filter psql.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($cand) { $psql = $cand.FullName; break }
      } else {
        $cand = Join-Path $base 'psql'
        if (Test-Path $cand) { $psql = $cand; break }
      }
    }
  }
  if ($psql) {
    $probe = Invoke-Quiet { & $psql -h localhost -U aegis -d aegis -c 'SELECT 1;' }
    if (-not ($LASTEXITCODE -eq 0)) {
      Write-Dev 'creating demo role/database (aegis)...'
      Invoke-Quiet { & $psql -d postgres -c "CREATE ROLE aegis WITH LOGIN PASSWORD 'aegis' SUPERUSER;" }
      Invoke-Quiet { & $psql -d postgres -c "CREATE DATABASE aegis OWNER aegis;" }
      if ($LASTEXITCODE -ne 0) {
        Write-Warn2 'could not auto-create the aegis role/db (needs superuser access). Create it manually:'
        Write-Warn2 "  CREATE ROLE aegis WITH LOGIN PASSWORD 'aegis' SUPERUSER; CREATE DATABASE aegis OWNER aegis;"
      }
    }
  }
  Write-Dev 'database ready on :5432'
} else {
  Write-Die 'PostgreSQL is not running and could not be started. Start it manually (services.msc on Windows, brew services start postgresql@17 on macOS) and re-run dev.ps1'
}

# --- 3. Frontend deps ---------------------------------------------------------------
if (-not (Test-Path (Join-Path $FrontendDir 'node_modules'))) {
  Write-Dev 'frontend dependencies missing - running npm install...'
  Push-Location $FrontendDir
  try { npm install --no-audit --no-fund } finally { Pop-Location }
  if ($LASTEXITCODE -ne 0) { Write-Die 'npm install failed.' }
}

# --- 4. Ports ------------------------------------------------------------------------
$backendReused = $false
if (Test-Port $BackendPort) {
  $healthy = $false
  try {
    Invoke-WebRequest -Uri "$BackendUrl/api/v1/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop | Out-Null
    $healthy = $true
  } catch { $healthy = $false }
  if ($healthy) {
    $backendReused = $true
    Write-Warn2 "backend already healthy on :$BackendPort - reusing it"
  } else {
    Write-Die "port $BackendPort is busy with another service. Free it with: netstat -ano | findstr :$BackendPort (then: taskkill /PID <pid> /F)"
  }
}
if (Test-Port $FrontendPort) {
  Write-Die "port $FrontendPort is busy. Free it with: netstat -ano | findstr :$FrontendPort (Windows) or lsof -ti:$FrontendPort | xargs kill"
}

# --- 4b. Hard-stop support -------------------------------------------------------------
# Children are tracked explicitly so Ctrl+C always frees :8000/:5173. On Windows
# they also join a Job Object, so the OS kills them even if this host dies.
$Global:ManagedProcs = New-Object System.Collections.ArrayList
$Global:Stopping = $false

function Stop-ManagedServers {
  if ($Global:Stopping) { return }
  $Global:Stopping = $true
  foreach ($p in @($Global:ManagedProcs)) {
    if ($p -and -not $p.HasExited) {
      Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
    }
  }
}

if ($IsWin) {
  try {
    Add-Type -Namespace Aegis -Name Job -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("kernel32.dll")]
public static extern System.IntPtr CreateJobObject(System.IntPtr a, string n);
[System.Runtime.InteropServices.DllImport("kernel32.dll")]
public static extern bool SetInformationJobObject(System.IntPtr h, int c, System.IntPtr i, uint l);
[System.Runtime.InteropServices.DllImport("kernel32.dll")]
public static extern bool AssignProcessToJobObject(System.IntPtr j, System.IntPtr p);
'@ -ErrorAction Stop
    $script:JobHandle = [Aegis.Job]::CreateJobObject([System.IntPtr]::Zero, $null)
    # JOBOBJECT_EXTENDED_LIMIT_INFORMATION (144 bytes on x64).
    # BasicLimitInformation.LimitFlags sits at offset 16; JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000.
    $size = 144
    $buffer = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($size)
    for ($i = 0; $i -lt $size; $i++) { [System.Runtime.InteropServices.Marshal]::WriteByte($buffer, $i, 0) }
    $flags = 0x2000
    [System.Runtime.InteropServices.Marshal]::WriteInt32($buffer, 16, $flags)
    [void][Aegis.Job]::SetInformationJobObject($script:JobHandle, 9, $buffer, $size)
    [System.Runtime.InteropServices.Marshal]::FreeHGlobal($buffer)
    $Global:JobReady = $true
  } catch {
    $Global:JobReady = $false
    Write-Warn2 'job-object guard unavailable - falling back to process tracking only.'
  }
} else {
  $Global:JobReady = $false
}

# Register the cleanup as early as possible so every exit path frees the ports.
try { Register-EngineEvent -SourceIdentifier PowerShell.Exiting -SupportEvent -Action { Stop-ManagedServers } | Out-Null } catch { }
try {
  [Console]::add_CancelKeyPress({
    param($sender, $eventArgs)
    $eventArgs.Cancel = $true
    Stop-ManagedServers
    exit 130
  })
} catch { }

# --- 5. Launch -------------------------------------------------------------------------
function Read-NewLines([string]$Path, [string]$Prefix, [string]$Color, [ref]$Index) {
  if (-not (Test-Path $Path)) { return }
  $lines = @(Get-Content -Path $Path -ErrorAction SilentlyContinue)
  while ($Index.Value -lt $lines.Count) {
    Write-Host ($Prefix + $lines[$Index.Value]) -ForegroundColor $Color
    $Index.Value++
  }
}

$stamp  = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')
$LogDir = Join-Path ([System.IO.Path]::GetTempPath()) "aegis-dev-$stamp"
$BeatFile = Join-Path $LogDir 'heartbeat'
$Watchdog = Join-Path $BackendDir 'scripts/watchdog.py'
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
$BLogOut = Join-Path $LogDir 'backend.out.log'
$BLogErr = Join-Path $LogDir 'backend.err.log'
$FLogOut = Join-Path $LogDir 'frontend.out.log'
$FLogErr = Join-Path $LogDir 'frontend.err.log'

$backendProc  = $null
$frontendProc = $null

try {
  if (-not $backendReused) {
    $env:AEGIS_HEARTBEAT = $BeatFile
    $env:AEGIS_PORT = "$BackendPort"
    $backendProc = Start-Process -FilePath $VenvPython `
      -ArgumentList @($Watchdog) `
      -WorkingDirectory $BackendDir -NoNewWindow `
      -RedirectStandardOutput $BLogOut -RedirectStandardError $BLogErr -PassThru
    if ($Global:JobReady) { [void][Aegis.Job]::AssignProcessToJobObject($script:JobHandle, $backendProc.Handle) }
    [void]$Global:ManagedProcs.Add($backendProc)
    Write-Backend "starting on :$BackendPort (pid $($backendProc.Id))"
  }

  $viteBin = Join-Path $FrontendDir 'node_modules/vite/bin/vite.js'
  $env:AEGIS_HEARTBEAT = $BeatFile
  $frontendProc = Start-Process -FilePath $VenvPython `
    -ArgumentList @($Watchdog, '--', $viteBin, '--port', "$FrontendPort", '--strictPort') `
    -WorkingDirectory $FrontendDir -NoNewWindow `
    -RedirectStandardOutput $FLogOut -RedirectStandardError $FLogErr -PassThru
  if ($Global:JobReady) { [void][Aegis.Job]::AssignProcessToJobObject($script:JobHandle, $frontendProc.Handle) }
  [void]$Global:ManagedProcs.Add($frontendProc)
  Write-Frontend "starting on :$FrontendPort (pid $($frontendProc.Id))"

  if (-not $backendReused) {
    if (Wait-Http "$BackendUrl/api/v1/health" 40) {
      Write-Backend "ready -> $BackendUrl/api/v1   (Swagger: $BackendUrl/docs)"
    } else {
      Write-Warn2 "backend not healthy yet - log: $BLogErr"
    }
  }
  if (Wait-Http "http://localhost:$FrontendPort/" 40) {
    Write-Frontend "ready -> http://localhost:$FrontendPort"
  }
  Write-Dev "console -> http://localhost:$FrontendPort | api -> $BackendUrl/api/v1 | Ctrl+C stops both"

  # --- 6. Stream logs until a server exits --------------------------------------------
  $bIndex = 0
  $fIndex = 0
  while ($true) {
    try { Set-Content -Path $BeatFile -Value 'alive' -NoNewline -ErrorAction Stop } catch { }

    Read-NewLines $BLogOut '[backend] '  'Green'     ([ref]$bIndex)
    Read-NewLines $BLogErr '[backend] '  'DarkGreen' ([ref]$bIndex)
    Read-NewLines $FLogOut '[frontend] ' 'Cyan'      ([ref]$fIndex)
    Read-NewLines $FLogErr '[frontend] ' 'DarkCyan'  ([ref]$fIndex)

    $bAlive = $backendReused -or ($backendProc -and -not $backendProc.HasExited)
    $fAlive = $frontendProc -and -not $frontendProc.HasExited
    if (-not $bAlive -or -not $fAlive) { break }
    Start-Sleep -Milliseconds 500
  }
  Write-Warn2 'a server exited - shutting the other one down.'
}
finally {
  Stop-ManagedServers
  Write-Dev 'servers stopped.'
}
