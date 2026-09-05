# Génère elpis.ico à partir de la marque de l'application.
#
# L'éclair reprend le tracé de `interface/web/public/favicon.svg`, simplifié en
# polygone : les dégradés et les flous du SVG ne survivraient pas à une icône de
# seize pixels, la silhouette si. Le script ne sert qu'une fois — l'icône est
# ensuite versionnée — mais il reste ici pour qu'on puisse la refaire si la
# marque change.

Add-Type -AssemblyName System.Drawing

$sortie = Join-Path $PSScriptRoot 'elpis.ico'

# Tracé de l'éclair, dans le repère 48 x 46 du SVG d'origine.
$points = @(
    [System.Drawing.PointF]::new(10.9, 0.0),
    [System.Drawing.PointF]::new(39.8, 0.0),
    [System.Drawing.PointF]::new(33.3, 12.3),
    [System.Drawing.PointF]::new(46.5, 15.8),
    [System.Drawing.PointF]::new(25.9, 44.9),
    [System.Drawing.PointF]::new(23.9, 31.7),
    [System.Drawing.PointF]::new(10.3, 31.7),
    [System.Drawing.PointF]::new(16.8, 19.4),
    [System.Drawing.PointF]::new(1.2, 15.8)
)

function New-Vignette([int]$taille) {
    $bmp = [System.Drawing.Bitmap]::new($taille, $taille, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    # L'éclair est plus haut que large : on le centre sur le côté du carré.
    $echelle = ($taille * 0.86) / 46.0
    $largeur = 48.0 * $echelle
    $hauteur = 46.0 * $echelle
    $dx = ($taille - $largeur) / 2.0
    $dy = ($taille - $hauteur) / 2.0

    $mis = $points | ForEach-Object {
        [System.Drawing.PointF]::new($_.X * $echelle + $dx, $_.Y * $echelle + $dy)
    }

    $chemin = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $chemin.AddPolygon([System.Drawing.PointF[]]$mis)

    $rect = [System.Drawing.RectangleF]::new($dx, $dy, $largeur, $hauteur)
    $degrade = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 134, 59, 255),   # violet de la marque
        [System.Drawing.Color]::FromArgb(255, 71, 191, 255),   # cyan d'accent
        [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
    )
    $g.FillPath($degrade, $chemin)

    $degrade.Dispose(); $chemin.Dispose(); $g.Dispose()
    return $bmp
}

# Un .ico moderne accepte des vignettes PNG : c'est ce qui donne un rendu net
# en 256 px sans faire exploser le poids du fichier.
$tailles = @(16, 24, 32, 48, 64, 128, 256)
$vignettes = @()
foreach ($t in $tailles) {
    $bmp = New-Vignette $t
    $flux = [System.IO.MemoryStream]::new()
    $bmp.Save($flux, [System.Drawing.Imaging.ImageFormat]::Png)
    $vignettes += , @{ Taille = $t; Octets = $flux.ToArray() }
    $flux.Dispose(); $bmp.Dispose()
}

$fichier = [System.IO.MemoryStream]::new()
$ecrivain = [System.IO.BinaryWriter]::new($fichier)

# En-tête ICONDIR : réservé, type 1 (icône), nombre d'images.
$ecrivain.Write([uint16]0)
$ecrivain.Write([uint16]1)
$ecrivain.Write([uint16]$vignettes.Count)

$decalage = 6 + (16 * $vignettes.Count)
foreach ($v in $vignettes) {
    $dim = if ($v.Taille -ge 256) { 0 } else { $v.Taille }   # 0 signifie 256
    $ecrivain.Write([byte]$dim)          # largeur
    $ecrivain.Write([byte]$dim)          # hauteur
    $ecrivain.Write([byte]0)             # palette
    $ecrivain.Write([byte]0)             # réservé
    $ecrivain.Write([uint16]1)           # plans
    $ecrivain.Write([uint16]32)          # bits par pixel
    $ecrivain.Write([uint32]$v.Octets.Length)
    $ecrivain.Write([uint32]$decalage)
    $decalage += $v.Octets.Length
}
foreach ($v in $vignettes) { $ecrivain.Write($v.Octets) }

$ecrivain.Flush()
[System.IO.File]::WriteAllBytes($sortie, $fichier.ToArray())
$ecrivain.Dispose(); $fichier.Dispose()

Write-Output "icone ecrite : $sortie ($([math]::Round((Get-Item $sortie).Length / 1KB, 1)) Ko, $($vignettes.Count) tailles)"
