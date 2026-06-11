@echo off
title ELPIS - Ton Assistant d'Etude Personnel
echo ========================================================
echo Démarrage du serveur ELPIS...
echo ========================================================
echo.

cd /d "%~dp0\interface\bridge"
start /b node server.js

echo Le serveur est lance en arriere-plan.
echo Lancement de l'interface dans ton navigateur...
timeout /t 2 >nul
start http://localhost:3001

echo.
echo ========================================================
echo ELPIS est en cours d'execution !
echo Tu peux fermer cette fenetre noire quand tu as fini.
echo Pour eteindre completement ELPIS, ferme cette fenetre.
echo ========================================================
pause >nul
