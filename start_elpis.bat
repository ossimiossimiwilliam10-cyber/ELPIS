@echo off
color 0B
title ELPIS - Ton Assistant d'Etude Personnel

echo ========================================================
echo.
echo      [ ELPIS - ASSISTANT D'ETUDE INTELLIGENT ]
echo.
echo ========================================================
echo.
echo [*] Demarrage du systeme...

:: Liberer le port 3001 proprement
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001" ^| find "LISTENING"') do taskkill /F /PID %%a >nul 2>&1

cd /d "%~dp0interface\bridge"
start "ELPIS Server" /b node server.js

echo [*] Serveur Node.js demarre en arriere-plan.
echo [*] Lancement de l'interface web dans le navigateur...
timeout /t 2 >nul
start http://localhost:3001

echo.
echo ========================================================
echo [OK] ELPIS est en ligne !
echo.
echo Instructions :
echo - L'application est disponible sur http://localhost:3001
echo - Garde cette fenetre ouverte pendant ton utilisation.
echo - Pour eteindre ELPIS, ferme simplement cette fenetre.
echo ========================================================
echo.

pause >nul
