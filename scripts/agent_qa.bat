@echo off
echo ==============================================
echo [ANTIGRAVITY ELITE] Lancement de la boucle QA
echo ==============================================

echo.
echo [1/4] Validation Frontend (Lint)...
cd interface\web
call npx eslint .
if %errorlevel% neq 0 (
    echo [ERREUR] Lint Frontend a echoue.
    exit /b %errorlevel%
)
cd ..\..

echo.
echo [2/4] Validation Frontend (Vitest)...
cd interface\web
call npx vitest run
if %errorlevel% neq 0 (
    echo [ERREUR] Tests Frontend ont echoue.
    exit /b %errorlevel%
)
cd ..\..

echo.
echo [3/4] Build Frontend (Vite)...
cd interface\web
call npm run build
if %errorlevel% neq 0 (
    echo [ERREUR] Build Frontend a echoue.
    exit /b %errorlevel%
)
cd ..\..

echo.
echo [4/4] Validation Backend (Vitest)...
cd interface\bridge
call npx vitest run --coverage
if %errorlevel% neq 0 (
    echo [ERREUR] Tests Backend ont echoue.
    exit /b %errorlevel%
)
cd ..\..

echo.
echo ==============================================
echo [SUCCES] Tous les systemes sont operationnels !
echo ==============================================
