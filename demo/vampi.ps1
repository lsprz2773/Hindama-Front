# VAmPI (API vulnerable de la comunidad) para la demo, con Caddy delante para el archivo de
# verificacion de Hindama y un tunel de Cloudflare (la guardia SSRF no deja verificar localhost).
#
#   .\demo\vampi.ps1                       # enciende VAmPI, Caddy y el tunel
#   .\demo\vampi.ps1 -Code <codigo>        # pone el codigo de verificacion del proyecto
#   .\demo\vampi.ps1 -Action status
#   .\demo\vampi.ps1 -Action stop
#
# Necesita Docker; baja erev0s/vampi la primera vez.
param(
  [ValidateSet('start', 'stop', 'status')][string]$Action = 'start',
  [string]$Code = ''
)

# Windows PowerShell 5.1 convierte el stderr de docker en error terminante con 'Stop': se revisa
# $LASTEXITCODE donde importa.
$ErrorActionPreference = 'Continue'
$Net = 'hindama-demo-vampi-net'
$Vampi = 'hindama-demo-vampi'
$Caddy = 'hindama-demo-vampi-caddy'
$Tunnel = 'hindama-demo-vampi-tunel'
$Data = Join-Path $PSScriptRoot '.datos\vampi'

function Test-Running([string]$Name) {
  $state = docker inspect -f '{{.State.Running}}' $Name 2>$null
  return ($state -eq 'true')
}

function Remove-Container([string]$Name) {
  docker rm -f $Name 2>$null | Out-Null
}

function Set-Code([string]$Value) {
  New-Item -ItemType Directory -Force -Path $Data | Out-Null
  [System.IO.File]::WriteAllText((Join-Path $Data 'verificacion.txt'), $Value.Trim(), (New-Object System.Text.UTF8Encoding($false)))
}

function Get-TunnelUrl {
  for ($i = 0; $i -lt 40; $i++) {
    $logs = docker logs $Tunnel 2>&1 | Out-String
    $m = [regex]::Match($logs, 'https://[a-z0-9-]+\.trycloudflare\.com')
    if ($m.Success) { return $m.Value }
    Start-Sleep -Seconds 1
  }
  throw 'El tunel no dio su URL en 40 segundos. Revisa: docker logs hindama-demo-vampi-tunel'
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

function Show-Info([string]$Url, $Tokens) {
  Write-Host ''
  Write-Host 'VAmPI (modo vulnerable)' -ForegroundColor Cyan
  Write-Host "  URL base del proyecto : $Url"
  Write-Host "  Contrato (importar)   : $Url/openapi.json"
  Write-Host "  Archivo de verificacion: $Url/.well-known/hindama-verificacion.txt"
  if ($Tokens) {
    Write-Host ''
    Write-Host 'Identidades de prueba: crealas como "Token Bearer" con estos tokens (duran 1 hora):'
    foreach ($user in $Tokens.Keys) { Write-Host ("  {0,-6} {1}" -f $user, $Tokens[$user]) }
    Write-Host ''
    Write-Host 'No uses "inicio de sesion automatico": VAmPI devuelve el token en el campo auth_token y Hindama solo busca'
    Write-Host 'access_token, accessToken, token, jwt, id_token e idToken.'
  }
  Write-Host ''
  Write-Host 'Siguiente paso: crea el proyecto con la URL base, copia su codigo de verificacion y ejecuta:'
  Write-Host '  .\demo\vampi.ps1 -Code <codigo>'
}

# Tokens de VAmPI de name1, name2 y admin (lo que devuelve su inicio de sesion), validos 1 hora.
function Get-Tokens {
  $passwords = [ordered]@{ name1 = 'pass1'; name2 = 'pass2'; admin = 'pass1' }
  $tokens = [ordered]@{}
  foreach ($user in $passwords.Keys) {
    $body = @{ username = $user; password = $passwords[$user] } | ConvertTo-Json
    $answer = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8081/users/v1/login' -ContentType 'application/json' -Body $body
    $tokens[$user] = $answer.auth_token
  }
  return $tokens
}

switch ($Action) {
  'stop' {
    foreach ($name in @($Tunnel, $Caddy, $Vampi)) { Remove-Container $name }
    docker network rm $Net 2>$null | Out-Null
    Write-Host 'VAmPI, Caddy y el tunel apagados.'
    return
  }
  'status' {
    Write-Host ("VAmPI: " + $(if (Test-Running $Vampi) { 'encendido' } else { 'apagado' }))
    if (Test-Running $Tunnel) { Show-Info (Get-TunnelUrl) $null } else { Write-Host 'Tunel: apagado' }
    return
  }
}

# --- start ---
if ($Code) { Set-Code $Code }
elseif (-not (Test-Path (Join-Path $Data 'verificacion.txt'))) { Set-Code '' }

docker network inspect $Net 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { docker network create $Net | Out-Null }

Remove-Container $Vampi
docker run -d --name $Vampi --network $Net -e vulnerable=1 -e tokentimetolive=3600 erev0s/vampi:latest | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'docker run fallo: revisa que Docker Desktop este encendido.' }

Remove-Container $Caddy
docker run -d --name $Caddy --network $Net -p 127.0.0.1:8081:8080 `
  -v "$(Join-Path $PSScriptRoot 'vampi\Caddyfile'):/etc/caddy/Caddyfile:ro" `
  -v "${Data}:/data:ro" caddy:2.10 | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'docker run fallo: revisa que Docker Desktop este encendido.' }

for ($i = 0; $i -lt 30; $i++) {
  try {
    Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8081/openapi.json' -TimeoutSec 2 | Out-Null
    break
  } catch { Start-Sleep -Seconds 1 }
  if ($i -eq 29) { throw 'VAmPI no responde por Caddy en 127.0.0.1:8081. Revisa: docker logs hindama-demo-vampi' }
}
# VAmPI arranca sin datos: /createdb crea los usuarios y los libros de ejemplo.
Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8081/createdb' | Out-Null

if (-not (Test-Running $Tunnel)) {
  Remove-Container $Tunnel
  docker run -d --name $Tunnel --network $Net cloudflare/cloudflared:latest `
    tunnel --no-autoupdate --url http://hindama-demo-vampi-caddy:8080 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'docker run fallo: revisa que Docker Desktop este encendido.' }
}
$u = Get-TunnelUrl
Wait-Url $u
Show-Info $u (Get-Tokens)
