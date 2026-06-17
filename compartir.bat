@echo off
title Mi Oficina 3D - compartir por internet (Dev Tunnel)
cd /d "%~dp0"
echo.
echo  Arrancando servidor local + tunel de Azure...
echo  (No cierres esta ventana mientras quieras que el enlace funcione.)
echo.
REM 1) Servidor web local en una ventana aparte
start "Oficina 3D - servidor" cmd /c "node server.js"
timeout /t 2 /nobreak >nul
REM 2) Tunel publico (anonimo) -> imprime la URL "Connect via browser"
echo  Copia y comparte la URL que aparece como "Connect via browser":
echo.
devtunnel host -p 8123 --allow-anonymous
pause
