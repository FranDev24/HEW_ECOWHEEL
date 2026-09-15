@echo off
rem ============================================================
rem  EcoWheel - permitir acceso desde el celular (puerto 8080)
rem  Clic derecho -> "Ejecutar como administrador"  (o doble clic y acepta UAC)
rem ============================================================
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Pidiendo permisos de administrador...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo Creando regla de firewall para EcoWheel (TCP 8080)...
netsh advfirewall firewall delete rule name="EcoWheel Host 8080" >nul 2>&1
netsh advfirewall firewall add rule name="EcoWheel Host 8080" dir=in action=allow protocol=TCP localport=8080 profile=private,public
if %errorlevel% equ 0 (
  echo.
  echo  [OK] Listo. Ahora desde tu celular (mismo WiFi) abre:
  echo.
  echo      http://192.168.20.28:8080/
  echo.
) else (
  echo  [XX] No se pudo crear la regla.
)
pause
