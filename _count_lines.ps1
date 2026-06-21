$ErrorActionPreference = "SilentlyContinue"

# Répertoires à exclure complètement
$excludeDirs = @(
    '*\.git\*', '*\node_modules\*', '*\documents\*', '*\backups\*',
    '*\coverage\*', '*\playwright-report\*', '*\test-results\*',
    '*\dist\*', '*\.cache\*', '*\.parcel-cache\*'
)

$files = Get-ChildItem -Recurse -File | Where-Object {
    $full = $_.FullName
    $skip = $false
    foreach ($pattern in $excludeDirs) {
        if ($full -like $pattern) { $skip = $true; break }
    }
    return -not $skip
} | Where-Object {
    $ext = $_.Extension
    $ext -in @('.js','.jsx','.json','.html','.css','.sh','.ps1','.bat','.md','.yml','.yaml','.cjs','.mjs','.svg','.xml')
}

Write-Host "=== RESUME PAR EXTENSION (source uniquement) ==="
$summary = $files | Group-Object Extension | ForEach-Object {
    $totalLines = 0
    $_.Group | ForEach-Object { $totalLines += (Get-Content $_.FullName | Measure-Object -Line).Lines }
    [PSCustomObject]@{Extension=$_.Name; Files=$_.Count; Lines=$totalLines}
} | Sort-Object Lines -Descending

$summary | Format-Table -AutoSize

$grandTotal = ($summary | Measure-Object Lines -Sum).Sum
$grandFiles = ($summary | Measure-Object Files -Sum).Sum

Write-Host ""
Write-Host "=== TOTAL ==="
Write-Host "Fichiers source: $grandFiles"
Write-Host "Lignes totales: $grandTotal"
Write-Host ""
Write-Host "=== DETAIL FICHIERS (top 30) ==="
$files | ForEach-Object {
    $lines = (Get-Content $_.FullName | Measure-Object -Line).Lines
    [PSCustomObject]@{Path=$_.FullName.Replace("$PWD\",''); Lines=$lines}
} | Sort-Object Lines -Descending | Select-Object -First 30 | Format-Table -AutoSize
