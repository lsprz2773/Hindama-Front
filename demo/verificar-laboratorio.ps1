# Comprueba, SIN Hindama, que el laboratorio del catalogo tiene las vulnerabilidades que Hindama
# reporta: una peticion por cada falla, con lo que debe verse si esta en modo vulnerable y en modo
# seguro. Sirve para confirmar el resultado de la demo con otra herramienta.
#
#   .\demo\verificar-laboratorio.ps1 -Url https://<tu-tunel>.trycloudflare.com
#
# Solo hace peticiones de lectura, salvo una a /wishlist (crea un elemento y lo borra).
param(
  [Parameter(Mandatory = $true)][string]$Url
)

$Url = $Url.TrimEnd('/')
$Beto = 'tok-beto-laboratorio-7c1e'
$Results = New-Object System.Collections.ArrayList

# Una peticion: devuelve estado, cabeceras y cuerpo sin lanzar excepcion en 4xx o 5xx.
function Invoke-Check([string]$Method, [string]$Path, [hashtable]$Headers = @{}, [string]$Body = $null) {
  $args2 = @{ UseBasicParsing = $true; Method = $Method; Uri = "$Url$Path"; Headers = $Headers; TimeoutSec = 30 }
  if ($Body) { $args2.Body = $Body; $args2.ContentType = 'application/json' }
  try {
    $r = Invoke-WebRequest @args2
    return [pscustomobject]@{ Status = [int]$r.StatusCode; Headers = $r.Headers; Body = $r.Content }
  } catch {
    $resp = $_.Exception.Response
    if ($null -eq $resp) { return [pscustomobject]@{ Status = 0; Headers = @{}; Body = $_.Exception.Message } }
    $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $text = $reader.ReadToEnd()
    return [pscustomobject]@{ Status = [int]$resp.StatusCode; Headers = $resp.Headers; Body = $text }
  }
}

function Add-Result([string]$Id, [string]$Falla, [string]$Visto, [string]$Vulnerable, [string]$Seguro) {
  [void]$Results.Add([pscustomobject]@{ Id = $Id; Falla = $Falla; Visto = $Visto; 'Si es vulnerable' = $Vulnerable; 'Si es seguro' = $Seguro })
}

function ConvertTo-Base64Url([string]$Text) {
  [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Text)).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$bearerBeto = @{ Authorization = "Bearer $Beto" }

# --- API2 Autenticacion ---
$r = Invoke-Check 'GET' '/reports'
Add-Result 'API2' 'Operacion protegida accesible sin credenciales (GET /reports)' ("HTTP " + $r.Status) '200 con el informe' '401'

$login = Invoke-Check 'POST' '/auth/login' @{} '{"username":"ana","password":"clave-de-ana-del-laboratorio"}'
$ana = ($login.Body | ConvertFrom-Json).access_token
$parts = $ana.Split('.')
$tampered = "$($parts[0]).$($parts[1]).firma-falsa"
$r = Invoke-Check 'GET' '/orders' @{ Authorization = "Bearer $tampered" }
Add-Result 'API2' 'JWT con la firma alterada (GET /orders)' ("HTTP " + $r.Status) '200 (no revisa la firma)' '401'

$none = (ConvertTo-Base64Url '{"alg":"none","typ":"JWT"}') + '.' + (ConvertTo-Base64Url '{"sub":"raiz"}') + '.'
$r = Invoke-Check 'GET' '/admin/users' @{ Authorization = "Bearer $none" }
Add-Result 'API2' 'JWT sin firma, alg none, como administrador (GET /admin/users)' ("HTTP " + $r.Status) '200 con la lista de usuarios' '401'

# --- API1 Acceso a objetos (BOLA) ---
$r = Invoke-Check 'GET' '/orders/ord-ana-1' $bearerBeto
Add-Result 'API1' 'Beto lee el pedido de Ana (GET /orders/ord-ana-1)' ("HTTP " + $r.Status) '200 con el pedido de Ana' '404'

# --- API5 Acceso a funciones (BFLA) ---
$r = Invoke-Check 'GET' '/admin/users' $bearerBeto
Add-Result 'API5' 'Un usuario normal llama una funcion de administrador (GET /admin/users)' ("HTTP " + $r.Status) '200 con la lista' '403'

# --- API8 Configuracion ---
$r = Invoke-Check 'GET' '/orders' @{ Authorization = "Bearer $Beto"; Origin = 'https://sitio-ajeno.example' }
$acao = $r.Headers['Access-Control-Allow-Origin']
$acac = $r.Headers['Access-Control-Allow-Credentials']
Add-Result 'API8' 'CORS acepta cualquier origen con credenciales' ("ACAO=$acao ; credenciales=$acac") 'repite el origen y credenciales=true' 'sin esas cabeceras'
$faltan = @(
  @('Strict-Transport-Security'), @('X-Content-Type-Options'), @('X-Frame-Options')
) | Where-Object { -not $r.Headers[$_[0]] } | ForEach-Object { $_[0] }
Add-Result 'API8' 'Faltan cabeceras de seguridad' ("faltan: " + ($faltan -join ', ')) 'faltan las tres' 'no falta ninguna'
Add-Result 'API8' 'La cabecera X-Powered-By anuncia la version' ("X-Powered-By=" + $r.Headers['X-Powered-By']) 'Python/3.12 FastAPI/0.115' 'sin la cabecera'
$r = Invoke-Check 'GET' '/invoices/abc' $bearerBeto
$trace = if ($r.Body -match 'Traceback') { 'si, con la traza y rutas del servidor' } else { 'no' }
Add-Result 'API8' 'Un error expone detalles internos (GET /invoices/abc)' ("HTTP " + $r.Status + " ; traza: " + $trace) '500 con Traceback' '200 sin traza'

# --- API3 Propiedades ---
$r = Invoke-Check 'GET' '/profile' $bearerBeto
$extra = if ($r.Body -match 'password_hash') { 'password_hash y role' } else { 'solo name y email' }
Add-Result 'API3' 'La respuesta trae campos que su esquema no declara (GET /profile)' $extra 'password_hash y role' 'solo name y email'
$r = Invoke-Check 'POST' '/wishlist' $bearerBeto '{"product":"x","owner":"raiz"}'
$owner = if ($r.Body) { ($r.Body | ConvertFrom-Json).owner } else { '?' }
Add-Result 'API3' 'La API acepta campos protegidos al crear (POST /wishlist con owner=raiz)' ("owner guardado = $owner") 'raiz (acepto el campo)' 'beto (lo ignoro)'
if ($r.Status -eq 201) {
  $id = ($r.Body | ConvertFrom-Json).id
  [void](Invoke-Check 'DELETE' "/wishlist/$id" $bearerBeto)
}

# --- API4 Consumo de recursos ---
$limitado = 0
1..30 | ForEach-Object { if ((Invoke-Check 'GET' '/catalog').Status -eq 429) { $limitado++ } }
Add-Result 'API4' 'Sin limite de peticiones (30 veces GET /catalog)' ("$limitado respuestas 429") '0 respuestas 429' 'varias 429 desde la 21'

# --- Inyeccion SQL ---
$q = [uri]::EscapeDataString("'")
$r = Invoke-Check 'GET' "/products?name=$q" $bearerBeto
$trace = if ($r.Body -match 'sqlite3|Traceback|syntax') { 'si, con el error de la base de datos' } else { 'no' }
Add-Result 'SQL' 'Una comilla provoca un error de la base de datos (GET /products?name=)' ("HTTP " + $r.Status + " ; error SQL: " + $trace) '500 con el error de SQLite' '200 con []'
$none1 = Invoke-Check 'GET' ("/products?name=" + [uri]::EscapeDataString('zzz')) $bearerBeto
$true1 = Invoke-Check 'GET' ("/products?name=" + [uri]::EscapeDataString("zzz' OR '1'='1")) $bearerBeto
$nNone = @($none1.Body | ConvertFrom-Json).Count
$nTrue = @($true1.Body | ConvertFrom-Json -ErrorAction SilentlyContinue).Count
Add-Result 'SQL' 'Una condicion SQL cambia la respuesta (zzz frente a zzz'' OR ''1''=''1)' ("sin la condicion: $nNone productos ; con ella: $nTrue") '0 y 3 productos' '0 y 0 productos'

$Results | Format-List Id, Falla, Visto, 'Si es vulnerable', 'Si es seguro'
Write-Host 'Compara cada "Visto" con la columna de tu modo. El modo lo elige el script del laboratorio (-Mode vulnerable o secure).' -ForegroundColor Cyan
