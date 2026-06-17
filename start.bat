@echo off
title Claude Arcade - servidor
cd /d "%~dp0"
echo.
echo  Arrancando "Claude Arcade"...
echo  (No cierres esta ventana mientras juegas. Para salir, cierrala.)
echo.
start "" http://localhost:8123
node server.js
pause
