# =============================================================================
#  Mettre le téléphone à la version du PC
# =============================================================================
#
#  Quatre étapes, dont deux pièges qui font croire au succès.
#
#  Premier piège : le démon Gradle survit à chaque compilation et garde ouverts
#  des fichiers du projet Android. La synchronisation Capacitor suivante échoue
#  alors sur `capacitor.settings.gradle` — mais seulement après avoir vidé le
#  dossier des greffons Cordova, qu'elle n'a plus le droit de regénérer. La
#  compilation d'après échoue à son tour, sur un fichier manquant, et
#  `adb install` réinstalle joyeusement l'APK précédent : on croit avoir
#  déployé, il ne s'est rien passé. C'est arrivé deux fois avant qu'on comprenne.
#
#  Second piège : `adb install` réussit toujours, même quand la compilation a
#  échoué — il installe alors le fichier de la veille. On vérifie donc l'âge de
#  l'APK avant de l'envoyer.
#
#  Rappel utile, et il a changé : le moteur EST désormais dans l'APK. Les
#  fichiers de `interface/bridge/moteur` sont embarqués tels quels dans le paquet
#  de l'interface, Répétiteur compris, et le téléphone calcule son programme et
#  répond aux questions sans le PC. Une correction du moteur demande donc les
#  deux : redémarrer le serveur pour le PC, et relancer ce script pour le
#  téléphone. Le seul redémarrage du serveur ne suffit plus.
# =============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Racine  = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Web     = Join-Path $Racine 'interface\web'
$Android = Join-Path $Web 'android'
$Apk     = Join-Path $Android 'app\build\outputs\apk\debug\app-debug.apk'
$Port    = 3001

$Adb = @(
    "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
    "$env:ProgramFiles\Android\platform-tools\adb.exe"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

$Jbr = @(
    "$env:ProgramFiles\Android\Android Studio\jbr",
    $env:JAVA_HOME
) | Where-Object { $_ -and (Test-Path (Join-Path $_ 'bin\java.exe')) } | Select-Object -First 1

function Etape([string]$texte) { Write-Host "==> $texte" -ForegroundColor Cyan }
function Bien([string]$texte)  { Write-Host "    $texte" -ForegroundColor Green }
function Mal([string]$texte)   { Write-Host "    $texte" -ForegroundColor Red }

<#
  Les outils externes — Vite, Capacitor, Gradle — écrivent leurs avertissements
  sur la sortie d'erreur. Avec $ErrorActionPreference = 'Stop', PowerShell prend
  chacun de ces messages pour un échec et interrompt tout : la construction
  s'arrêtait sur un simple avertissement de découpage de bundle. On isole donc
  les appels externes, et on juge sur le code de retour — la seule chose qui
  dise vraiment si la commande a réussi.
#>
function Lancer-Externe {
    param([string]$Fichier, [string[]]$Arguments, [string]$Filtre)

    $ancien = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $sortie = & $Fichier @Arguments 2>&1 | ForEach-Object { "$_" }
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $ancien
    }

    if ($Filtre) { $sortie | Select-String $Filtre | ForEach-Object { Bien $_ } }
    return @{ Code = $code; Sortie = $sortie }
}

if (-not $Adb) { Mal 'adb est introuvable (platform-tools).'; exit 1 }
if (-not $Jbr) { Mal "Aucun Java utilisable (jbr d'Android Studio ou JAVA_HOME)."; exit 1 }

# Le démon Gradle n'est arrêté qu'en dernier recours : il garde une JVM chaude,
# et le tuer à chaque déploiement ajoute deux bonnes minutes de démarrage à
# froid. On ne s'en prend à lui que si la copie Capacitor échoue vraiment.
function Arreter-DemonGradle {
    $daemons = @(Get-CimInstance Win32_Process -Filter "Name='java.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine -match 'GradleDaemon' })
    foreach ($d in $daemons) {
        try { Stop-Process -Id $d.ProcessId -Force -ErrorAction Stop } catch { }
    }
    if ($daemons.Count -gt 0) { Mal "$($daemons.Count) démon(s) Gradle arrêté(s) pour libérer les fichiers" }
    Start-Sleep -Seconds 2
    return $daemons.Count
}

# L'interface.
Push-Location $Web
try {
    Etape "Construction de l'interface"
    $r = Lancer-Externe 'node' @('..\..\node_modules\vite\bin\vite.js', 'build') 'built in'
    if ($r.Code -ne 0) { throw "la construction de l'interface a échoué" }

    <#
      Trois tentatives, et ce n'est pas de la superstition.

      Capacitor échoue par intermittence sur `capacitor.settings.gradle` avec un
      « UNKNOWN: unknown error, open » — alors que le fichier existe, est lisible
      et n'est tenu par aucun processus identifiable. Un antivirus qui inspecte
      un fichier fraîchement écrit est le suspect le plus probable, sans qu'on
      l'ait prouvé. Ce qui est établi, en revanche : la même commande relancée
      deux secondes plus tard passe.

      Et cet échec-là n'est pas bénin. Capacitor vide le dossier des greffons
      Cordova avant de le regénérer : abandonner au milieu laisse le projet
      Android dans un état où la compilation suivante échoue, et où
      `adb install` repose l'APK de la veille sans rien dire.
    #>
    Etape 'Copie vers le projet Android'
    $reussi = $false
    foreach ($tentative in 1..3) {
        $r = Lancer-Externe 'node' @('..\..\node_modules\@capacitor\cli\bin\capacitor', 'sync', 'android') 'Sync finished'
        if ($r.Code -eq 0 -and -not ($r.Sortie -match 'failed')) { $reussi = $true; break }

        if ($tentative -eq 1) {
            # Deuxième essai tel quel : l'échec est le plus souvent passager.
            Mal 'copie échouée, nouvel essai…'
            Start-Sleep -Seconds 3
        } elseif ($tentative -eq 2) {
            # Troisième essai seulement après avoir libéré les fichiers.
            Arreter-DemonGradle | Out-Null
        }
    }
    if (-not $reussi) {
        $r.Sortie | Select-String 'error|failed' | ForEach-Object { Mal $_ }
        throw 'la synchronisation Capacitor a échoué trois fois — un processus garde-t-il le dossier android ouvert ?'
    }
} finally { Pop-Location }

# 3. L'APK.
$env:JAVA_HOME = $Jbr
Push-Location $Android
try {
    Etape "Compilation de l'APK"
    $r = Lancer-Externe "$Jbr\bin\java.exe" @(
        '-Dorg.gradle.appname=gradlew',
        '-classpath', 'gradle\wrapper\gradle-wrapper.jar',
        'org.gradle.wrapper.GradleWrapperMain', 'assembleDebug'
    ) 'BUILD SUCCESSFUL|BUILD FAILED|What went wrong|Could not'
    if ($r.Code -ne 0) { throw "la compilation a échoué — rien n'a été installé" }
} finally { Pop-Location }

# 4. L'installation, et seulement si l'APK vient d'être produit.
$age = (Get-Date) - (Get-Item $Apk).LastWriteTime
if ($age.TotalMinutes -gt 10) {
    Mal "L'APK date de $([int]$age.TotalMinutes) minutes : la compilation n'a rien produit de neuf. Installation annulée."
    exit 1
}

Etape 'Installation sur le téléphone'
$appareils = @(& $Adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "\bdevice\s*$" })
if ($appareils.Count -eq 0) {
    Mal 'Aucun téléphone détecté. Branche le câble et autorise le débogage USB.'
    exit 1
}

$r = Lancer-Externe $Adb @('install', '-r', $Apk) 'Success|Failure'
if ($r.Code -ne 0) { throw "l'installation a échoué" }

& $Adb reverse "tcp:$Port" "tcp:$Port" | Out-Null
Bien "liaison USB ouverte sur le port $Port"

Write-Host ''
Write-Host 'Le téléphone est à la version du PC.' -ForegroundColor Green
