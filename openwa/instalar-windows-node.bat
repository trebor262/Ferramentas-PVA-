@echo off
REM Duplo clique para instalar e iniciar o OpenWA no Windows SEM Docker.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar-windows-node.ps1"
echo.
pause
