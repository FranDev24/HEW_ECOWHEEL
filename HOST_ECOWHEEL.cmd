@echo off
setlocal
title EcoWheel - Host local (puerto 8080)
cd /d "%~dp0"
set "PORT=8080"
set "URL=http://localhost:%PORT%"

echo ============================================
echo   EcoWheel - Host local (http-server)
echo   Carpeta: %CD%
echo ============================================
echo.

rem --- 1) Sondeo HTTP: ya hay un host sirviendo EcoWheel? (comprobacion real) ---
powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; try { if ((Invoke-WebRequest -Uri '%URL%/index.html' -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { exit 0 } } catch { } exit 1" >nul 2>&1
if not errorlevel 1 (
    echo [OK] Ya hay un host sirviendo EcoWheel en %URL%. Reutilizando...
    goto :listo
)

rem --- 2) El puerto esta ocupado por otro proceso que no responde EcoWheel? ---
netstat -ano | findstr /R /C:":%PORT% " | findstr /I "LISTENING" >nul 2>&1
if not errorlevel 1 echo [!!] El puerto %PORT% esta ocupado por otro proceso. Si falla, cierralo o cambia PORT en este archivo.

rem --- 3) Existe http-server? ---
if not exist "node_modules\http-server\bin\http-server" (
    echo [..] Falta http-server. Instalando dependencias ^(npm install^)...
    call npm install
    if errorlevel 1 (
        echo [XX] npm install fallo. Revisa que Node.js este instalado: node -v
        pause
        exit /b 1
    )
)

rem --- 4) Levantar el host en segundo plano (ventana minimizada) ---
echo [..] Levantando http-server en el puerto %PORT%...
start "EcoWheel host %PORT%" /min cmd /c "node node_modules\http-server\bin\http-server . -p %PORT% -c-1"

rem --- 5) Esperar a que responda HTTP 200 (max ~24s) ---
set /a intentos=0
:wait
set /a intentos+=1
powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; try { if ((Invoke-WebRequest -Uri '%URL%/index.html' -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { exit 0 } } catch { } exit 1" >nul 2>&1
if errorlevel 1 (
    if %intentos% lss 8 (
        timeout /t 3 /nobreak >nul
        goto :wait
    )
    echo [XX] El host no respondio en %URL%
    echo      - Verifica Node.js: node -v
    echo      - Verifica que el puerto %PORT% este libre: netstat -ano ^| findstr :%PORT%
    pause
    exit /b 1
)

:listo
echo [OK] Host activo y funcionando:
echo      Wheel ........ %URL%/
echo      Admin ........ %URL%/admin.html
for /f "tokens=2 delims=:" %%I in ('ipconfig ^| findstr /C:"IPv4"') do (
    for /f "tokens=* delims= " %%J in ("%%I") do echo      Red local .... http://%%J:%PORT%/
)
echo.
if /I "%~1"=="noopen" (
    echo [i] Modo noopen: no se abre el navegador.
    exit /b 0
)
start "" "%URL%"
echo [i] Navegador abierto en %URL% - esta ventana se cierra en 5 segundos.
timeout /t 5 /nobreak >nul
exit /b 0
