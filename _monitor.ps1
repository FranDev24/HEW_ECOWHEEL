# Monitor 4h — EcoWheel (no modifica codigo, solo supervisa y reinicia host local si cae)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$log  = Join-Path $root '_monitor.log'
$deadline = (Get-Date).AddHours(4)
function Log($m) { Add-Content -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m) }
function Check($url, $timeout) {
    try { $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec $timeout; return ($r.StatusCode -eq 200) } catch { return $false }
}
function Start-Host {
    Log 'HOST CAIDO -> reiniciando http-server en puerto 8080'
    Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -eq '' } | Out-Null
    Start-Process -FilePath 'node' -ArgumentList (Join-Path $root 'node_modules\http-server\bin\http-server'), '.', '-p', '8080', '-c-1' -WorkingDirectory $root -WindowStyle Hidden
    Start-Sleep -Seconds 4
}
Log '=== MONITOR 4H INICIADO (cada 2 min) ==='
$localFails = 0; $pagesFails = 0; $localRestarts = 0; $checks = 0
while ((Get-Date) -lt $deadline) {
    $checks++
    $okLocal = Check 'http://localhost:8080/index.html' 8
    $okPages = Check 'https://frandev24.github.io/HEW_ECOWHEEL/' 20
    if ($okLocal) { $localFails = 0 } else { $localFails++; Start-Host; $localRestarts++; $okLocal = Check 'http://localhost:8080/index.html' 8 }
    if ($okPages) { $pagesFails = 0 } else { $pagesFails++ }
    $stLocal = if ($okLocal) { 'OK' } else { 'FALLA' }
    $stPages = if ($okPages) { 'OK' } else { 'FALLA' }
    Log ("check#{0} local={1} pages={2} (rachas: local={3} pages={4} reinicios={5})" -f $checks, $stLocal, $stPages, $localFails, $pagesFails, $localRestarts)
    if ($pagesFails -ge 5) { Log 'ALERTA: Pages con 5 fallos seguidos — puede ser red local o despliegue de GitHub' }
    Start-Sleep -Seconds 120
}
Log ("=== MONITOR FINALIZADO: {0} checks, reinicios host={1} ===" -f $checks, $localRestarts)
