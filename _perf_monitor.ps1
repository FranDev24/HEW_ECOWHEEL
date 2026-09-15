# Vigilante de rendimiento 4h — EcoWheel (detecta lag y fugas de memoria, no modifica codigo)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$log  = Join-Path $root '_perf.log'
$deadline = (Get-Date).AddHours(4)
function Log($m) { Add-Content -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m) }
function Latency($url, $n, $timeout) {
    $times = @()
    for ($i = 0; $i -lt $n; $i++) {
        $sw = [Diagnostics.Stopwatch]::StartNew()
        try { $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec $timeout; if ($r.StatusCode -ne 200) { return -1 } }
        catch { return -1 }
        $sw.Stop(); $times += $sw.Elapsed.TotalMilliseconds
    }
    return [math]::Round(($times | Measure-Object -Average).Average, 0)
}
Log '=== PERF--monitor 4H INICIADO (cada 5 min: latencia x5 + RAM node) ==='
$baseRam = $null
while ((Get-Date) -lt $deadline) {
    $lLocal = Latency 'http://localhost:8080/index.html' 5 8
    $lPages = Latency 'https://frandev24.github.io/HEW_ECOWHEEL/' 3 20
    $node = Get-Process node -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($node) {
        $ram = [math]::Round($node.WorkingSet64/1MB, 1)
        if (-not $baseRam) { $baseRam = $ram }
        $creep = [math]::Round($ram - $baseRam, 1)
        $stL = if ($lLocal -ge 0) { "local=${lLocal}ms" } else { "local=CAIDO" }
        $stP = if ($lPages -ge 0) { "pages=${lPages}ms" } else { "pages=CAIDO/LENTO" }
        Log ("perf: {0} {1} nodeRAM={2}MB (creep={3}MB desde {4}MB)" -f $stL, $stP, $ram, $creep, $baseRam)
        if ($lLocal -gt 500) { Log "ALERTA LAG: host local >500ms (${lLocal}ms)" }
        if ($lPages -gt 3000) { Log "ALERTA LAG: Pages >3000ms (${lPages}ms) — puede ser tu red, Pages global sirve rapido" }
        if ($creep -gt 100) { Log "ALERTA MEMORIA: node crecio ${creep}MB — posible fuga; si el host se lentifica el otro monitor lo reiniciara" }
        if ($lLocal -lt 0) { Log 'ALERTA: host local caido — el monitor principal lo reinicia automaticamente en <=2 min' }
    } else {
        Log 'ALERTA: proceso node no existe — host local caido, el monitor principal lo reiniciara en <=2 min'
    }
    Start-Sleep -Seconds 300
}
Log '=== PERF-monitor FINALIZADO ==='