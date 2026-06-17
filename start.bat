@echo off
title Mi Oficina 3D - servidor
cd /d "%~dp0"
echo.
echo  Arrancando "Mi Oficina 3D"...
echo  (No cierres esta ventana mientras juegas. Para salir, cierrala.)
echo.
start "" http://localhost:8123
node server.js
pause
