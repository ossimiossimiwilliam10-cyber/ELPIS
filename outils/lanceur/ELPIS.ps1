# =============================================================================
#  Lanceur d'ELPIS
# =============================================================================
#
#  L'ancien lanceur ouvrait un terminal, tuait ce qui écoutait sur le port,
#  attendait deux secondes au jugé puis ouvrait le navigateur. Deux défauts,
#  l'un cosmétique et l'autre non :
#
#   - une fenêtre noire pleine de commandes s'affichait, ce qui n'a aucune
#     raison d'être pour une application qu'on utilise tous les jours ;
#   - surtout, l'attente était aveugle. Si le serveur mettait trois secondes à
#     ouvrir sa base, le navigateur s'ouvrait sur une page d'erreur, et rien
#     n'expliquait pourquoi. Si Node manquait, il ne se passait simplement rien.
#
#  Ce lanceur attend que le serveur réponde vraiment — `/api/health` vérifie
#  aussi que la base est ouverte — et dit ce qui bloque quand ça bloque. Aucune
#  console n'apparaît : il est démarré caché par `Lancer ELPIS.vbs`.
#
#  Une fois l'application ouverte, il reste dans la zone de notification. C'est
#  ce qui permet de l'arrêter proprement : sans lui, le serveur tournerait sans
#  fenêtre et il faudrait passer par le gestionnaire des tâches.
# =============================================================================

# -----------------------------------------------------------------------------
#  UN PIÈGE À CONNAÎTRE AVANT DE MODIFIER CE FICHIER
#
#  PowerShell accepte l'apostrophe typographique ’ (U+2019) comme délimiteur de
#  chaîne, exactement au même titre que '. Écrire 'Recherche d’une instance'
#  ferme donc la chaîne sur le ’, et tout ce qui suit part à la dérive — avec
#  une erreur signalée cent lignes plus loin, à un endroit parfaitement sain.
#
#  Règle : toute phrase française contenant une apostrophe va entre guillemets
#  doubles. Le fichier est enregistré en UTF-8 avec BOM, sans quoi Windows
#  PowerShell 5.1 le lit en ANSI et massacre les accents.
# -----------------------------------------------------------------------------

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # la barre de progression coûte cher en appels réseau

# Windows cherche un proxy automatique (WPAD) au premier appel réseau du
# processus. Mesuré ici : soixante secondes avant de rendre la main quand rien
# n'écoute — la boucle d'attente semblait figée alors qu'elle attendait une
# découverte de proxy pour joindre 127.0.0.1. Rien de ce que fait ce lanceur ne
# sort de la machine : la désactiver est sans effet de bord.
[System.Net.WebRequest]::DefaultWebProxy = $null

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

try { [System.Windows.Forms.Application]::EnableVisualStyles() } catch { }
try { [System.Windows.Forms.Application]::SetCompatibleTextRenderingDefault($false) } catch { }

# ----------------------------------------------------------------- Repères

$Racine   = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Bridge   = Join-Path $Racine 'interface\bridge'
$Journal  = Join-Path $PSScriptRoot 'journal.log'
$Icone    = Join-Path $PSScriptRoot 'elpis.ico'
$Port     = 3001

# Deux adresses pour un même serveur, et la distinction n'est pas cosmétique.
#
# `localhost` se résout d'abord en ::1 sur Windows, alors que le serveur Node
# n'écoute qu'en IPv4 (0.0.0.0). Une sonde sur localhost attend donc l'expiration
# du délai à chaque essai — mesuré ici : 1 500 ms d'échec contre 217 ms de succès
# sur 127.0.0.1. La boucle d'attente tournait sans jamais rien constater.
#
# Le navigateur, lui, reste sur `localhost` : c'est l'origine sous laquelle
# l'application a enregistré ses réglages, et passer à 127.0.0.1 les perdrait
# tous — origine différente, stockage local différent.
$Sonde    = "http://127.0.0.1:$Port"
$Adresse  = "http://localhost:$Port"

# Palette reprise de l'application, pour que le démarrage et l'écran d'accueil
# ne semblent pas venir de deux logiciels différents.
$Fond      = [System.Drawing.Color]::FromArgb(255, 18, 20, 31)
$Bordure   = [System.Drawing.Color]::FromArgb(255, 45, 48, 68)
$Texte     = [System.Drawing.Color]::FromArgb(255, 236, 238, 248)
$Doux      = [System.Drawing.Color]::FromArgb(255, 148, 154, 178)
$Accent    = [System.Drawing.Color]::FromArgb(255, 134, 59, 255)
$AccentBis = [System.Drawing.Color]::FromArgb(255, 71, 191, 255)

function Ecrire-Journal([string]$ligne) {
    try {
        $horodatage = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
        Add-Content -Path $Journal -Value "[$horodatage] $ligne" -Encoding UTF8
    } catch { }
}

function Charger-Icone {
    if (Test-Path $Icone) {
        try { return [System.Drawing.Icon]::new($Icone) } catch { }
    }
    return [System.Drawing.SystemIcons]::Application
}

# L'icône est chargée une fois pour toutes.
#
# Elle l'était auparavant à chaque appel — y compris depuis le gestionnaire de
# dessin de l'écran d'attente, soit soixante icônes par seconde, jamais
# libérées. Le processus épuisait son quota de poignées GDI en une dizaine de
# secondes, après quoi `Application.DoEvents()` cessait de rendre la main : le
# lanceur restait figé sur « Recherche d'une instance… », sans erreur ni trace.
$IconeElpis = Charger-Icone

# ------------------------------------------------------------ Écran d'attente

# Fenêtre sans bordure, dessinée à la main : un cadre Windows classique aurait
# l'air d'une boîte de dialogue d'erreur, ce qui est exactement l'impression
# qu'on cherche à éviter au démarrage.
$splash = [System.Windows.Forms.Form]::new()
$splash.FormBorderStyle = 'None'
$splash.StartPosition   = 'CenterScreen'
$splash.Size            = [System.Drawing.Size]::new(440, 250)
$splash.BackColor       = $Fond
$splash.TopMost         = $true
$splash.ShowInTaskbar   = $false
$splash.Icon            = $IconeElpis

# Coins arrondis.
$region = [System.Drawing.Drawing2D.GraphicsPath]::new()
$r = 18
$region.AddArc(0, 0, $r, $r, 180, 90)
$region.AddArc($splash.Width - $r, 0, $r, $r, 270, 90)
$region.AddArc($splash.Width - $r, $splash.Height - $r, $r, $r, 0, 90)
$region.AddArc(0, $splash.Height - $r, $r, $r, 90, 90)
$region.CloseAllFigures()
$splash.Region = [System.Drawing.Region]::new($region)

$etatBarre = @{ Position = -140.0 }

$splash.Add_Paint({
    param($sender, $e)
    $g = $e.Graphics
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

    # Liseré, pour détacher la fenêtre d'un fond sombre.
    $stylo = [System.Drawing.Pen]::new($Bordure, 1)
    $g.DrawPath($stylo, $region)
    $stylo.Dispose()

    # La marque — l'icône partagée, surtout pas une nouvelle à chaque image.
    $g.DrawIcon($IconeElpis, [System.Drawing.Rectangle]::new(44, 62, 72, 72))

    $titre = [System.Drawing.Font]::new('Segoe UI Light', 30, [System.Drawing.FontStyle]::Regular)
    $sous  = [System.Drawing.Font]::new('Segoe UI', 10, [System.Drawing.FontStyle]::Regular)
    $pinceauTitre = [System.Drawing.SolidBrush]::new($Texte)
    $pinceauDoux  = [System.Drawing.SolidBrush]::new($Doux)

    $g.DrawString('ELPIS', $titre, $pinceauTitre, 136, 62)
    $g.DrawString('Assistant d''étude', $sous, $pinceauDoux, 141, 112)

    # Piste de progression, et le segment qui la parcourt.
    $x = 44; $y = 176; $largeur = $splash.Width - 88
    $piste = [System.Drawing.SolidBrush]::new($Bordure)
    $g.FillRectangle($piste, $x, $y, $largeur, 3)
    $piste.Dispose()

    $segment = [System.Drawing.RectangleF]::new($x + $etatBarre.Position, $y, 140, 3)
    $visible = [System.Drawing.RectangleF]::Intersect($segment, [System.Drawing.RectangleF]::new($x, $y, $largeur, 3))
    if ($visible.Width -gt 0) {
        $degrade = [System.Drawing.Drawing2D.LinearGradientBrush]::new($segment, $Accent, $AccentBis, 0.0)
        $g.FillRectangle($degrade, $visible)
        $degrade.Dispose()
    }

    $titre.Dispose(); $sous.Dispose(); $pinceauTitre.Dispose(); $pinceauDoux.Dispose()
})

$statut = [System.Windows.Forms.Label]::new()
$statut.AutoSize  = $false
$statut.Size      = [System.Drawing.Size]::new(360, 22)
$statut.Location  = [System.Drawing.Point]::new(44, 196)
$statut.ForeColor = $Doux
$statut.BackColor = $Fond
$statut.Font      = [System.Drawing.Font]::new('Segoe UI', 9)
$statut.Text      = 'Préparation…'
$splash.Controls.Add($statut)

$minuterie = [System.Windows.Forms.Timer]::new()
$minuterie.Interval = 33
$minuterie.Add_Tick({
    $etatBarre.Position += 6
    if ($etatBarre.Position -gt ($splash.Width - 88)) { $etatBarre.Position = -140.0 }
    $splash.Invalidate([System.Drawing.Rectangle]::new(40, 172, $splash.Width - 80, 12))
})

function Dire([string]$message) {
    $statut.Text = $message
    Ecrire-Journal $message
    [System.Windows.Forms.Application]::DoEvents()
}

function Fermer-Splash {
    try { $minuterie.Stop(); $minuterie.Dispose() } catch { }
    try { $splash.Hide(); $splash.Dispose() } catch { }
}

function Echouer([string]$titre, [string]$detail, [switch]$ProposerJournal) {
    Fermer-Splash
    Ecrire-Journal "ECHEC — $titre : $detail"
    $texte = $detail
    if ($ProposerJournal) {
        $texte += "`n`nVeux-tu ouvrir le journal de démarrage ?"
        $reponse = [System.Windows.Forms.MessageBox]::Show(
            $texte, "ELPIS — $titre",
            [System.Windows.Forms.MessageBoxButtons]::YesNo,
            [System.Windows.Forms.MessageBoxIcon]::Warning)
        if ($reponse -eq [System.Windows.Forms.DialogResult]::Yes -and (Test-Path $Journal)) {
            Start-Process notepad.exe -ArgumentList "`"$Journal`""
        }
    } else {
        [System.Windows.Forms.MessageBox]::Show(
            $texte, "ELPIS — $titre",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Warning) | Out-Null
    }
    exit 1
}

# ----------------------------------------------------------------- Le serveur

# Le port d'abord : une connexion TCP refusée revient en quelques
# millisecondes, là où une requête HTTP vers un port fermé traîne. Tant que
# personne n'écoute, inutile de parler HTTP.
function Test-Port {
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $essai = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        if (-not $essai.AsyncWaitHandle.WaitOne(400)) { return $false }
        $client.EndConnect($essai)
        return $true
    } catch { return $false }
    finally { $client.Close() }
}

function Test-Serveur {
    # `/api/health` ne répond que si la base est ouverte : c'est ce qui
    # distingue « le port est pris » de « l'application est prête ».
    if (-not (Test-Port)) { return $false }
    # Requête au plus court. `Invoke-WebRequest` déclenche la découverte du
    # proxy système, qui prend ici une dizaine de secondes : le délai de deux
    # secondes expirait avant même que la connexion soit tentée, et la boucle
    # d'attente tournait sans jamais rien constater. Proxy désactivé, la réponse
    # arrive en quelques millisecondes.
    try {
        $req = [System.Net.HttpWebRequest]::Create("$Sonde/api/health")
        $req.Method           = 'GET'
        $req.Timeout          = 1500
        $req.ReadWriteTimeout = 1500
        $req.Proxy            = $null
        $rep = $req.GetResponse()
        $ok = ([int]$rep.StatusCode -eq 200)
        $rep.Close()
        return $ok
    } catch { return $false }
}

function Trouver-Node {
    $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    foreach ($p in @(
        "$env:ProgramFiles\nodejs\node.exe",
        "${env:ProgramFiles(x86)}\nodejs\node.exe",
        "$env:LOCALAPPDATA\Programs\nodejs\node.exe"
    )) { if ($p -and (Test-Path $p)) { return $p } }
    return $null
}

function Pid-DuPort([int]$port) {
    try {
        $c = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop
        return @($c | Select-Object -ExpandProperty OwningProcess -Unique)
    } catch { return @() }
}

# En mode application, la fenêtre n'a ni barre d'adresse ni onglets : ELPIS
# ressemble à un logiciel, pas à un site ouvert dans un navigateur.
function Ouvrir-Application {
    $navigateurs = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
    )
    foreach ($n in $navigateurs) {
        if ($n -and (Test-Path $n)) {
            try {
                Start-Process -FilePath $n -ArgumentList "--app=$Adresse" | Out-Null
                Ecrire-Journal "fenêtre ouverte via $(Split-Path -Leaf $n)"
                return
            } catch { }
        }
    }
    # Aucun navigateur en mode application : le navigateur par défaut fera l'affaire.
    Start-Process $Adresse | Out-Null
    Ecrire-Journal 'fenêtre ouverte via le navigateur par défaut'
}

# Un verrou nommé empêche deux lanceurs de démarrer en même temps : sans lui,
# un double clic un peu vif fait naître deux instances qui se libèrent le port
# l'une l'autre, et aucune ne survit.
#
# Mais le verrou seul ne suffit pas à décider. Le lanceur reste dans la zone de
# notification tant qu'ELPIS tourne, et garde donc le verrou toute sa vie. Si son
# moteur meurt — plantage, arrêt manuel — le verrou reste pris alors que plus
# rien ne répond : tout nouveau lancement se contentait alors d'ouvrir une page
# blanche, indéfiniment, sans jamais relancer le serveur.
#
# C'est donc le moteur qui tranche, pas le verrou. S'il répond, il y a bien une
# instance vivante et on se contente d'ouvrir la fenêtre. S'il ne répond pas, on
# reprend la main, verrou ou pas : le détenteur est un fantôme.
$verrou = [System.Threading.Mutex]::new($false, "Local\ELPIS-lanceur")
$seul = $false
try { $seul = $verrou.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $seul = $true }

if (-not $seul) {
    if (Test-Serveur) {
        Ecrire-Journal 'un lanceur est déjà en marche et le moteur répond : ouverture simple'
        Ouvrir-Application
        exit 0
    }
    Ecrire-Journal 'verrou tenu par un lanceur dont le moteur ne répond plus : reprise en main'
}

$splash.Show()
$minuterie.Start()
[System.Windows.Forms.Application]::DoEvents()

Ecrire-Journal '--- démarrage demandé ---'

# Filet de sécurité. Sans lui, la moindre exception tue le script en silence :
# aucune fenêtre, aucun message, et rien à lire pour comprendre. Un lanceur qui
# échoue sans laisser de trace est pire qu'un lanceur qui ouvre un terminal.
trap {
    Ecrire-Journal ("EXCEPTION : " + $_.Exception.Message)
    Ecrire-Journal ("  ligne " + $_.InvocationInfo.ScriptLineNumber + " : " + $_.InvocationInfo.Line.Trim())
    try { Fermer-Splash } catch { }
    [System.Windows.Forms.MessageBox]::Show(
        ("ELPIS n'a pas pu démarrer." + "`n`n" + $_.Exception.Message + "`n`n" + "Le journal du lanceur contient le détail."),
        "ELPIS",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error) | Out-Null
    exit 1
}

# Une instance déjà en marche ne doit pas en faire naître une seconde : deux
# serveurs sur la même base, c'est la garantie d'une écriture perdue.
$dejaLa = $false
$script:MoteurPid = 0
Dire "Recherche d’une instance déjà ouverte…"
$chrono = [System.Diagnostics.Stopwatch]::StartNew()
if (Test-Serveur) {
    $dejaLa = $true
    Dire 'ELPIS tourne déjà — ouverture de la fenêtre.'
} else {
    Ecrire-Journal "  (sonde initiale : $($chrono.ElapsedMilliseconds) ms)"
    $chrono.Restart()
    $node = Trouver-Node
    Ecrire-Journal "  (recherche de Node : $($chrono.ElapsedMilliseconds) ms)"
    $chrono.Restart()
    if (-not $node) {
        Echouer 'Node.js est introuvable' `
            "ELPIS a besoin de Node.js pour fonctionner, et je ne le trouve ni dans le PATH ni à ses emplacements habituels.`n`nInstalle-le depuis nodejs.org, puis relance ELPIS."
    }
    if (-not (Test-Path (Join-Path $Bridge 'server.js'))) {
        Echouer 'Fichiers introuvables' `
            "Je ne trouve pas le serveur à l'emplacement attendu :`n$Bridge`n`nLe raccourci pointe-t-il toujours vers le bon dossier ?"
    }

    # Un serveur d'une session précédente peut encore occuper le port sans
    # répondre — il faut alors le libérer, sinon le nouveau ne démarrera pas.
    # Le @() est indispensable : une fonction PowerShell qui retourne un tableau
    # vide rend $null, et .Count sur $null lève une exception sous StrictMode.
    #
    # `Get-NetTCPConnection` charge tout le module NetTCPIP au premier appel, ce
    # qui coûtait une quinzaine de secondes à chaque démarrage. On ne l'invoque
    # donc que si le port est effectivement occupé — c'est-à-dire presque jamais.
    # Le @() enveloppe tout le `if` : un `if` employé comme expression rend le
    # flux de sortie de sa branche, et une branche qui produit un tableau vide
    # ne produit rien du tout — donc $null, sur lequel .Count échoue.
    Ecrire-Journal "  (vérification des fichiers : $($chrono.ElapsedMilliseconds) ms)"
    $chrono.Restart()
    $occupants = @( if (Test-Port) { Pid-DuPort $Port } )
    Ecrire-Journal "  (examen du port : $($chrono.ElapsedMilliseconds) ms)"
    if ($occupants.Count -gt 0) {
        Dire 'Libération du port…'
        foreach ($procId in $occupants) {
            try { Stop-Process -Id $procId -Force -ErrorAction Stop; Ecrire-Journal "processus $procId arrêté" } catch { }
        }
        Start-Sleep -Milliseconds 700
    }

    Dire 'Démarrage du moteur…'
    $info = [System.Diagnostics.ProcessStartInfo]::new()
    $info.FileName               = $node
    $info.Arguments              = 'server.js'
    $info.WorkingDirectory       = $Bridge      # aucun shell : l'esperluette du chemin ne gêne pas
    $info.UseShellExecute        = $false
    $info.CreateNoWindow         = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError  = $true
    # Le serveur écrit en UTF-8. Sans ces deux lignes, .NET décode sa sortie
    # dans l'encodage de la console et le journal se remplit de « d├®marr├® ».
    $info.StandardOutputEncoding = [System.Text.Encoding]::UTF8
    $info.StandardErrorEncoding  = [System.Text.Encoding]::UTF8

    try {
        $serveur = [System.Diagnostics.Process]::Start($info)
        $script:MoteurPid = $serveur.Id
    } catch {
        Echouer "Le moteur n’a pas pu démarrer" "Windows a refusé de lancer Node.js :`n$($_.Exception.Message)"
    }
    Ecrire-Journal "moteur lancé (PID $($serveur.Id))"

    # La sortie du serveur part au journal : c'est elle qu'on montrera si le
    # démarrage échoue, plutôt qu'un « ça ne marche pas » sans contenu.
    $collecte = {
        param($envoyeur, $e)
        if ($e.Data) { Ecrire-Journal "  moteur | $($e.Data)" }
    }
    $serveur.EnableRaisingEvents = $true
    Register-ObjectEvent -InputObject $serveur -EventName OutputDataReceived -Action $collecte | Out-Null
    Register-ObjectEvent -InputObject $serveur -EventName ErrorDataReceived  -Action $collecte | Out-Null
    $serveur.BeginOutputReadLine()
    $serveur.BeginErrorReadLine()

    # Attente réelle : `/api/health` ne répond que lorsque la base est ouverte.
    $limite = 40
    $pret = $false
    for ($i = 1; $i -le $limite -and -not $pret; $i++) {
        if ($serveur.HasExited) {
            $fin = if (Test-Path $Journal) { (Get-Content $Journal -Tail 12) -join "`n" } else { '' }
            Echouer "Le moteur s’est arrêté" `
                "Le serveur a quitté pendant le démarrage (code $($serveur.ExitCode)).`n`nDernières lignes :`n$fin" -ProposerJournal
        }
        Dire "Ouverture de la base et du planificateur… ($i s)"
        Start-Sleep -Milliseconds 500
        [System.Windows.Forms.Application]::DoEvents()
        Start-Sleep -Milliseconds 500
        $pret = Test-Serveur
    }

    if (-not $pret) {
        $fin = if (Test-Path $Journal) { (Get-Content $Journal -Tail 12) -join "`n" } else { '' }
        Echouer 'Le moteur ne répond pas' `
            "Le serveur a été lancé mais ne répond toujours pas après $limite secondes.`n`nDernières lignes :`n$fin" -ProposerJournal
    }
    Dire 'Moteur prêt.'
}

# ---------------------------------------------------------------- L'affichage

Dire 'Ouverture de la fenêtre…'
Ouvrir-Application
Start-Sleep -Milliseconds 900
Fermer-Splash

# ------------------------------------------------------- Zone de notification

# Le serveur n'a pas de fenêtre : sans cette icône, l'arrêter demanderait le
# gestionnaire des tâches. Elle est aussi le seul rappel visible qu'ELPIS
# tourne encore quand on a fermé la fenêtre de l'application.
$tray = [System.Windows.Forms.NotifyIcon]::new()
$tray.Icon    = $IconeElpis
$tray.Text    = 'ELPIS — en marche'
$tray.Visible = $true

$menu = [System.Windows.Forms.ContextMenuStrip]::new()

$mOuvrir = $menu.Items.Add('Ouvrir ELPIS')
$mOuvrir.Font = [System.Drawing.Font]::new('Segoe UI', 9, [System.Drawing.FontStyle]::Bold)
$mOuvrir.Add_Click({ Ouvrir-Application })

$mDonnees = $menu.Items.Add('Ouvrir le dossier de données')
$mDonnees.Add_Click({
    $d = Join-Path $Racine 'data'
    if (Test-Path $d) { Start-Process explorer.exe -ArgumentList "`"$d`"" }
})

$mJournal = $menu.Items.Add('Voir le journal de démarrage')
$mJournal.Add_Click({ if (Test-Path $Journal) { Start-Process notepad.exe -ArgumentList "`"$Journal`"" } })

$mLiaison = $menu.Items.Add('Rétablir la liaison USB')
$mLiaison.Add_Click({
    if (-not $Adb) {
        [System.Windows.Forms.MessageBox]::Show(
            "adb est introuvable. Il vient avec les outils de plateforme Android (platform-tools).",
            'ELPIS', [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information) | Out-Null
        return
    }
    $script:TelephoneRelie = $false
    Rafraichir-Liaison
    $etat = Etat-Telephone
    $message = switch ($etat) {
        'relie'        { "Téléphone relié. La redirection est ouverte : le bouton Synchroniser est actif dans l'application." }
        'non-autorise' { "Le téléphone est branché mais pas encore autorisé. Regarde son écran : une confirmation attend." }
        'absent'       { "Aucun téléphone détecté. Vérifie le câble, et que le débogage USB est activé." }
        default        { "adb ne répond pas." }
    }
    [System.Windows.Forms.MessageBox]::Show($message, 'ELPIS',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information) | Out-Null
})

$menu.Items.Add([System.Windows.Forms.ToolStripSeparator]::new()) | Out-Null

$mQuitter = $menu.Items.Add('Arrêter ELPIS')
$mQuitter.Add_Click({
    $tray.Visible = $false
    try { $veilleUsb.Stop() } catch { }
    Ecrire-Journal 'arrêt demandé depuis la zone de notification'
    # On connaît le moteur qu'on a lancé : inutile de relire la table des
    # connexions. Elle ne sert que si ELPIS tournait déjà à notre arrivée.
    $cibles = if ($script:MoteurPid -gt 0) { @($script:MoteurPid) } else { @(Pid-DuPort $Port) }
    foreach ($procId in $cibles) {
        try { Stop-Process -Id $procId -Force -ErrorAction Stop; Ecrire-Journal "moteur $procId arrêté" } catch { }
    }
    [System.Windows.Forms.Application]::Exit()
})

$tray.ContextMenuStrip = $menu
$tray.Add_DoubleClick({ Ouvrir-Application })

# ----------------------------------------------------- Le câble et le tunnel

# Le téléphone n'a aucune route vers le PC quand c'est lui qui fournit la
# connexion : c'est le cas dès qu'il sert de partage. Le câble USB reste alors
# le seul chemin, et il demande une redirection côté PC —
# `adb reverse tcp:3001 tcp:3001` — qui ne survit pas au débranchement.
#
# La poser à la main à chaque fois serait exactement le genre de corvée qu'un
# lanceur doit absorber. On surveille donc l'apparition d'un appareil et on
# rétablit la redirection dès qu'il y en a un, sans rien demander.
$Adb = @(
    "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
    "$env:ProgramFiles\Android\platform-tools\adb.exe"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

$script:TelephoneRelie = $false

function Invoquer-Adb([string[]]$arguments) {
    if (-not $Adb) { return $null }
    $info = [System.Diagnostics.ProcessStartInfo]::new()
    $info.FileName               = $Adb
    $info.Arguments              = ($arguments -join ' ')
    $info.UseShellExecute        = $false
    $info.CreateNoWindow         = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError  = $true
    try {
        $p = [System.Diagnostics.Process]::Start($info)
        $sortie = $p.StandardOutput.ReadToEnd()
        $p.WaitForExit(5000) | Out-Null
        return $sortie
    } catch { return $null }
}

# Un appareil « device » est branché et autorisé. « unauthorized » signifie que
# la fenêtre de confirmation attend sur le téléphone : ce n'est pas une panne,
# et le dire évite de chercher un câble défectueux.
function Etat-Telephone {
    $sortie = Invoquer-Adb @('devices')
    if ($null -eq $sortie) { return 'sans-adb' }
    $lignes = $sortie -split "`n" | Select-Object -Skip 1 | Where-Object { $_.Trim() }
    if ($lignes | Where-Object { $_ -match "\bdevice\s*$" }) { return 'relie' }
    if ($lignes | Where-Object { $_ -match 'unauthorized' }) { return 'non-autorise' }
    return 'absent'
}

function Ouvrir-Tunnel {
    $deja = Invoquer-Adb @('reverse', '--list')
    if ($deja -and $deja -match "tcp:$Port") { return $true }
    $r = Invoquer-Adb @('reverse', "tcp:$Port", "tcp:$Port")
    return ($null -ne $r)
}

function Rafraichir-Liaison {
    $etat = Etat-Telephone

    if ($etat -eq 'relie') {
        if (-not $script:TelephoneRelie) {
            if (Ouvrir-Tunnel) {
                Ecrire-Journal "téléphone branché : redirection USB ouverte sur le port $Port"
                $script:TelephoneRelie = $true
                $tray.Text = 'ELPIS — téléphone relié'
                $tray.BalloonTipTitle = 'Téléphone relié'
                $tray.BalloonTipText  = "La synchronisation est disponible depuis le téléphone."
                $tray.ShowBalloonTip(3000)
            }
        } else {
            # La redirection peut tomber sans que le câble bouge : on la remet.
            Ouvrir-Tunnel | Out-Null
        }
        return
    }

    if ($script:TelephoneRelie) {
        Ecrire-Journal 'téléphone débranché'
        $script:TelephoneRelie = $false
    }

    $tray.Text = switch ($etat) {
        'sans-adb'     { "ELPIS — en marche (adb absent)" }
        'non-autorise' { "ELPIS — téléphone à autoriser" }
        default        { 'ELPIS — en marche' }
    }
}

$veilleUsb = [System.Windows.Forms.Timer]::new()
$veilleUsb.Interval = 8000
$veilleUsb.Add_Tick({ try { Rafraichir-Liaison } catch { } })
if ($Adb) {
    $veilleUsb.Start()
    Rafraichir-Liaison
    Ecrire-Journal "surveillance du câble USB active ($Adb)"
} else {
    Ecrire-Journal "adb introuvable : la liaison USB ne sera pas ouverte automatiquement"
}

$tray.BalloonTipTitle = 'ELPIS est ouvert'
$tray.BalloonTipText  = if ($dejaLa) {
    "Le moteur tournait déjà. Clic droit sur cette icône pour l’arrêter."
} else {
    "Le moteur tourne en arrière-plan. Clic droit sur cette icône pour l’arrêter."
}
$tray.ShowBalloonTip(4000)

Ecrire-Journal 'lanceur en veille dans la zone de notification'
[System.Windows.Forms.Application]::Run()

$tray.Visible = $false
$tray.Dispose()
