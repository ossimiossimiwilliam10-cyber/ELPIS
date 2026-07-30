$ErrorActionPreference = "Stop"

# Répertoires à exclure
$excludeDirs = @(
    '*node_modules*', '*\.git*', '*\documents\*', '*\backups\*',
    '*\Sauvegarde Elp*', '*\coverage\*', '*\playwright-report\*', '*\test-results\*',
    '*\dist\*', '*\.cache\*', '*\.parcel-cache\*', '*\build\*',
    '*\.idea\*', '*\android\*', '*\ELPIS_APPRENTISSAGE\*',
    '*\data\*', '*\music\*', '*\.pytest_cache\*', '*\.ruff_cache\*', '*\.venv\*',
    '*\traces\*', '*\fiches_revision\*', '*\\.antigravity\*', '*\\.deepseek\*',
    '*\\.agents\*'
)

# Extensions source
$exts = @('.js', '.jsx', '.json', '.html', '.css', '.sh', '.ps1', '.bat', '.md',
          '.yml', '.yaml', '.cjs', '.mjs', '.svg', '.xml', '.py', '.toml', '.env', '.ts')

# Fichiers sans extension acceptés
$noExtOk = @('Dockerfile', '.editorconfig', '.gitignore', 'render.yaml')

$totalFiles = 0
$totalLines = 0
$byExt = @{}

Get-ChildItem -Recurse -File | ForEach-Object {
    $full = $_.FullName
    foreach ($p in $excludeDirs) {
        if ($full -like $p) { return }
    }
    $ext = $_.Extension
    $name = $_.Name
    $countThis = $false
    if ($ext -in $exts) {
        $countThis = $true
    } elseif ($name -in $noExtOk) {
        $countThis = $true
    }
    if (-not $countThis) { return }

    $lines = (Get-Content $_.FullName -ErrorAction SilentlyContinue | Measure-Object -Line).Lines
    $totalFiles++
    $totalLines += $lines

    $key = if ($ext) { $ext } else { $name }
    if (-not $byExt.ContainsKey($key)) {
        $byExt[$key] = @{ Files = 0; Lines = 0 }
    }
    $byExt[$key].Files++
    $byExt[$key].Lines += $lines
}

Write-Host ""
Write-Host "=============================================="
Write-Host "  RAPPORT LIGNES DE CODE - PROJET ELPIS"
Write-Host "  (hors backups, data, build, node_modules, etc.)"
Write-Host "=============================================="
Write-Host ""

# Tableau trié par lignes décroissant
$sorted = $byExt.GetEnumerator() | Sort-Object { $_.Value.Lines } -Descending

Write-Host ("{0,-15} {1,8} {2,10}" -f "Extension", "Fichiers", "Lignes")
Write-Host ("{0,-15} {1,8} {2,10}" -f "---------", "--------", "----------")
foreach ($entry in $sorted) {
    Write-Host ("{0,-15} {1,8} {2,10}" -f $entry.Key, $entry.Value.Files, $entry.Value.Lines)
}

Write-Host ("{0,-15} {1,8} {2,10}" -f "---------", "--------", "----------")
Write-Host ("{0,-15} {1,8} {2,10}" -f "TOTAL", $totalFiles, $totalLines)
Write-Host ""

# Top 20 des plus gros fichiers
Write-Host "=== TOP 20 FICHIERS LES PLUS VOLUMINEUX ==="
Write-Host ""
$allFiles = @()
Get-ChildItem -Recurse -File | ForEach-Object {
    $full = $_.FullName
    foreach ($p in $excludeDirs) {
        if ($full -like $p) { return }
    }
    $ext = $_.Extension
    $name = $_.Name
    if ($ext -in $exts -or $name -in $noExtOk) {
        $lines = (Get-Content $_.FullName -ErrorAction SilentlyContinue | Measure-Object -Line).Lines
        $relPath = $full.Replace("$PWD\", "")
        $allFiles += [PSCustomObject]@{ Path = $relPath; Lines = $lines; Ext = if($ext){$ext}else{$name} }
    }
}

$allFiles | Sort-Object Lines -Descending | Select-Object -First 20 | ForEach-Object {
    Write-Host ("  {0,6} lignes  {1}" -f $_.Lines, $_.Path)
}

Write-Host ""
Write-Host "=== DÉCOMPOSITION PAR CATÉGORIE ==="
Write-Host ""

# Catégories
$catJS = $byExt.GetEnumerator() | Where-Object { $_.Key -in @('.js', '.jsx', '.cjs', '.mjs') }
$catConfig = $byExt.GetEnumerator() | Where-Object { $_.Key -in @('.json', '.yml', '.yaml', '.toml', '.env', '.editorconfig', 'render.yaml') }
$catStyle = $byExt.GetEnumerator() | Where-Object { $_.Key -in @('.css', '.svg', '.xml') }
$catDoc = $byExt.GetEnumerator() | Where-Object { $_.Key -eq '.md' }
$catScript = $byExt.GetEnumerator() | Where-Object { $_.Key -in @('.ps1', '.bat', '.sh') }
$catPython = $byExt.GetEnumerator() | Where-Object { $_.Key -eq '.py' }
$catOther = $byExt.GetEnumerator() | Where-Object { $_.Key -in @('.html', '.ts', 'Dockerfile', '.gitignore') }

Write-Host ("  JavaScript/React  (.js/.jsx/.cjs/.mjs) : {0,5} fichiers, {1,8} lignes" -f ($catJS | Measure-Object { $_.Value.Files } -Sum).Sum, ($catJS | Measure-Object { $_.Value.Lines } -Sum).Sum)
Write-Host ("  Config/Data        (.json/.yml/.toml)  : {0,5} fichiers, {1,8} lignes" -f ($catConfig | Measure-Object { $_.Value.Files } -Sum).Sum, ($catConfig | Measure-Object { $_.Value.Lines } -Sum).Sum)
Write-Host ("  Styles/XML          (.css/.svg/.xml)   : {0,5} fichiers, {1,8} lignes" -f ($catStyle | Measure-Object { $_.Value.Files } -Sum).Sum, ($catStyle | Measure-Object { $_.Value.Lines } -Sum).Sum)
Write-Host ("  Documentation       (.md)              : {0,5} fichiers, {1,8} lignes" -f ($catDoc | Measure-Object { $_.Value.Files } -Sum).Sum, ($catDoc | Measure-Object { $_.Value.Lines } -Sum).Sum)
Write-Host ("  Scripts             (.ps1/.bat/.sh)    : {0,5} fichiers, {1,8} lignes" -f ($catScript | Measure-Object { $_.Value.Files } -Sum).Sum, ($catScript | Measure-Object { $_.Value.Lines } -Sum).Sum)
Write-Host ("  Python              (.py)              : {0,5} fichiers, {1,8} lignes" -f ($catPython | Measure-Object { $_.Value.Files } -Sum).Sum, ($catPython | Measure-Object { $_.Value.Lines } -Sum).Sum)
Write-Host ("  Autres              (.html/.ts/etc.)   : {0,5} fichiers, {1,8} lignes" -f ($catOther | Measure-Object { $_.Value.Files } -Sum).Sum, ($catOther | Measure-Object { $_.Value.Lines } -Sum).Sum)
Write-Host ""
