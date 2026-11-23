# Laboratorio del catalogo de Hindama para la demo: la API vulnerable de tests/lab del backend,
# publicada con un tunel de Cloudflare (la guardia SSRF no deja verificar localhost).
#
#   .\demo\lab-catalogo.ps1                      # enciende el laboratorio en modo vulnerable
#   .\demo\lab-catalogo.ps1 -Code <codigo>       # pone el codigo de verificacion del proyecto
#   .\demo\lab-catalogo.ps1 -Mode secure         # lo "corrige" para el "Volver a probar" (el tunel no cambia)
#   .\demo\lab-catalogo.ps1 -Action status
#   .\demo\lab-catalogo.ps1 -Action stop         # apaga el laboratorio y el tunel
#
# Necesita Docker y la imagen `hindama-api` (en hindama-backend: docker compose up -d --build).
# El laboratorio corre en un contenedor aparte, con la carpeta tests/ del backend en solo lectura.
param(
  [ValidateSet('start', 'stop', 'status')][string]$Action = 'start',
  [ValidateSet('vulnerable', 'secure')][string]$Mode = 'vulnerable',
  [string]$Code = '',
  # Carpeta de hindama-backend (por defecto, la hermana de este repositorio).
  [string]$Backend = (Join-Path $PSScriptRoot '..\..\hindama-backend')
)

# Windows PowerShell 5.1 convierte el stderr de docker en error terminante con 'Stop': se revisa
# $LASTEXITCODE donde importa.
$ErrorActionPreference = 'Continue'
$Lab = 'hindama-demo-lab'
$Tunnel = 'hindama-demo-lab-tunel'
$Data = Join-Path $PSScriptRoot '.datos\lab'

function Test-Running([string]$Name) {
  $state = docker inspect -f '{{.State.Running}}' $Name 2>$null
  return ($state -eq 'true')
}

function Remove-Container([string]$Name) {
  docker rm -f $Name 2>$null | Out-Null
}

function Set-Code([string]$Value) {
  New-Item -ItemType Directory -Force -Path $Data | Out-Null
  # Sin salto de linea ni BOM: el laboratorio responde el contenido recortado.
  [System.IO.File]::WriteAllText((Join-Path $Data 'verificacion.txt'), $Value.Trim(), (New-Object System.Text.UTF8Encoding($false)))
}

function Get-TunnelUrl {
  for ($i = 0; $i -lt 40; $i++) {
    $logs = docker logs $Tunnel 2>&1 | Out-String
    $m = [regex]::Match($logs, 'https://[a-z0-9-]+\.trycloudflare\.com')
    if ($m.Success) { return $m.Value }
    Start-Sleep -Seconds 1
  }
  throw 'El tunel no dio su URL en 40 segundos. Revisa: docker logs hindama-demo-lab-tunel'
}

# El nombre del tunel tarda unos segundos en resolverse desde fuera: se espera a que responda para
# que la URL que se imprime ya sirva.
function Wait-Url([string]$Url) {
  for ($i = 0; $i -lt 45; $i++) {
    try {
      Invoke-WebRequest -UseBasicParsing -Uri "$Url/openapi.json" -TimeoutSec 5 | Out-Null
      return
    } catch { Start-Sleep -Seconds 2 }
  }
  Write-Host "Aviso: $Url aun no responde desde este equipo; espera un minuto y vuelve a intentar." -ForegroundColor Yellow
}

function Show-Info([string]$Url) {
  Write-Host ''
  Write-Host "Laboratorio del catalogo ($Mode)" -ForegroundColor Cyan
  Write-Host "  URL base del proyecto : $Url"
  Write-Host "  Contrato (importar)   : $Url/openapi.json"
  Write-Host "  Archivo de verificacion: $Url/.well-known/hindama-verificacion.txt"
  Write-Host ''
  Write-Host 'Identidades de prueba:'
  Write-Host '  Ana   (inicio de sesion automatico)  POST /auth/login  usuario: ana  contrasena: clave-de-ana-del-laboratorio'
  Write-Host '  Beto  (token)                        tok-beto-laboratorio-7c1e'
  Write-Host '  Raiz  (token, administrador)         tok-raiz-laboratorio-42aa'
  Write-Host ''
  Write-Host 'Siguiente paso: crea el proyecto con la URL base, copia su codigo de verificacion y ejecuta:'
  Write-Host '  .\demo\lab-catalogo.ps1 -Code <codigo>'
}

switch ($Action) {
  'stop' {
    Remove-Container $Tunnel
    Remove-Container $Lab
    Write-Host 'Laboratorio y tunel apagados.'
    return
  }
  'status' {
    Write-Host ("Laboratorio: " + $(if (Test-Running $Lab) { 'encendido' } else { 'apagado' }))
    if (Test-Running $Tunnel) { Show-Info (Get-TunnelUrl) } else { Write-Host 'Tunel: apagado' }
    return
  }
}

# --- start ---
docker image inspect hindama-api 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw 'Falta la imagen hindama-api. En hindama-backend ejecuta: docker compose up -d --build'
}
$Tests = (Resolve-Path (Join-Path $Backend 'tests')).Path
if ($Code) { Set-Code $Code }
elseif (-not (Test-Path (Join-Path $Data 'verificacion.txt'))) { Set-Code '' }

Remove-Container $Lab
docker run -d --name $Lab -p 127.0.0.1:8100:8100 `
  -e "LAB_MODE=$Mode" -e 'PYTHONPATH=/lab:/app/src' `
  -v "${Tests}:/lab/tests:ro" `
  -v "$(Join-Path $PSScriptRoot 'lab-catalogo\run_lab.py'):/lab/run_lab.py:ro" `
  -v "${Data}:/data" `
  -w /lab hindama-api python /lab/run_lab.py | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'docker run fallo: revisa que Docker Desktop este encendido.' }

for ($i = 0; $i -lt 30; $i++) {
  try {
    Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8100/openapi.json' -TimeoutSec 2 | Out-Null
    break
  } catch { Start-Sleep -Seconds 1 }
  if ($i -eq 29) { throw 'El laboratorio no responde en 127.0.0.1:8100. Revisa: docker logs hindama-demo-lab' }
}

if (-not (Test-Running $Tunnel)) {
  Remove-Container $Tunnel
  docker run -d --name $Tunnel --add-host=host.docker.internal:host-gateway cloudflare/cloudflared:latest `
    tunnel --no-autoupdate --url http://host.docker.internal:8100 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'docker run fallo: revisa que Docker Desktop este encendido.' }
}
$u = Get-TunnelUrl
Wait-Url $u
Show-Info $u
