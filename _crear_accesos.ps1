# Crea accesos directos clickeables en el Escritorio para EcoWheel.
# Ejecutar:  powershell -NoProfile -ExecutionPolicy Bypass -File .\_crear_accesos.ps1
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$host_cmd = Join-Path $root 'HOST_ECOWHEEL.cmd'
$desktop = [Environment]::GetFolderPath('Desktop')
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = 'C:\Program Files\nodejs\node.exe' }

if (-not (Test-Path $host_cmd)) { Write-Error "No existe $host_cmd"; exit 1 }

$ws = New-Object -ComObject WScript.Shell

# --- 1) Acceso directo principal: levanta el host y abre el navegador ---
$lnkPath = Join-Path $desktop 'EcoWheel Host.lnk'
$lnk = $ws.CreateShortcut($lnkPath)
$lnk.TargetPath = Join-Path $env:SystemRoot 'System32\cmd.exe'
$lnk.Arguments = '/c "' + $host_cmd + '"'
$lnk.WorkingDirectory = $root
$lnk.IconLocation = "$node,0"
$lnk.Description = 'Levanta el host local de EcoWheel (http://localhost:8080) y abre el navegador'
$lnk.WindowStyle = 1
$lnk.Save()
Write-Output "[OK] $lnkPath"

# --- 2) Accesos directos directos a las paginas (host ya encendido) ---
$paginas = @(
    @{ Nombre = 'EcoWheel Wheel.url';  Url = 'http://localhost:8080/' },
    @{ Nombre = 'EcoWheel Admin.url';  Url = 'http://localhost:8080/admin.html' }
)
foreach ($p in $paginas) {
    $urlPath = Join-Path $desktop $p.Nombre
    $cuerpo = "[InternetShortcut]`r`nURL=$($p.Url)`r`nIconFile=$node`r`nIconIndex=0`r`n"
    # ANSI/ASCII para que Windows lo lea sin problemas
    [System.IO.File]::WriteAllText($urlPath, $cuerpo, [System.Text.Encoding]::ASCII)
    Write-Output "[OK] $urlPath"
}

Write-Output ''
Write-Output "Escritorio: $desktop"
Write-Output 'Doble clic en "EcoWheel Host" para levantar el host y abrir el navegador.'
