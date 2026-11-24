# PINASTER 360 - alta local de 3 usuarios (sin secretos en Git o Vercel)
# Ejecutar exclusivamente en el ordenador seguro del administrador.
$ErrorActionPreference = "Stop"
$productionDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if ($productionDir -match "(?i)(OneDrive|Dropbox|Google Drive)") {
  throw "No guarde las contrasenas en una carpeta sincronizada. Copie primero la carpeta a una ruta local privada."
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Instale Node.js LTS antes de continuar." }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "Instale npm antes de continuar." }
Push-Location $productionDir
try {
  Write-Host "Instalando dependencias comprobables, ANTES de introducir la clave de servicio..."
  npm install --omit=dev --ignore-scripts --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "No se han instalado las dependencias." }
  $env:SUPABASE_URL = "https://bwjzmulohyjffvokpprk.supabase.co"
  Write-Host "Escriba la clave de servicio SOLO aqui. No la pegue en ChatGPT ni la guarde en el repositorio."
  $secureValue = Read-Host "Clave de servicio de PINASTER 360 Produccion" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
  try {
    $env:SUPABASE_SERVICE_ROLE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
  try {
    node scripts/bootstrap-users.mjs
    if ($LASTEXITCODE -ne 0) { throw "Fallaron las altas. Revise el error antes de reintentar." }
  } finally {
    Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:SUPABASE_URL -ErrorAction SilentlyContinue
  }
} finally {
  Pop-Location
}
Write-Host "Revise el CSV local de contrasenas generado, entregue cada clave de forma privada y borre el CSV despues."
