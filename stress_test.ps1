$ErrorActionPreference = "Stop"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Démarrage du Stress Test ELPIS (50 boucles)" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

Set-Location -Path "interface\web"

for ($i = 1; $i -le 50; $i++) {
    Write-Host "`n---> Boucle $i / 50" -ForegroundColor Yellow
    
    # Run Playwright test
    npx playwright test
    $exitCode = $LASTEXITCODE

    if ($exitCode -ne 0) {
        Write-Host "❌ ERREUR FATALE à la boucle $i ! Le test a échoué." -ForegroundColor Red
        Write-Host "Le stress test a été interrompu." -ForegroundColor Red
        exit $exitCode
    } else {
        Write-Host "✅ Boucle $i réussie avec succès." -ForegroundColor Green
    }
}

Write-Host "`n🎉 STRESS TEST TERMINÉ ! 50 boucles validées sans aucune erreur." -ForegroundColor Green
