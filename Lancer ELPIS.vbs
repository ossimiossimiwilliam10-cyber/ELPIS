' ============================================================================
'  Lancer ELPIS
' ============================================================================
'
'  Ce fichier ne fait qu'une chose : démarrer le vrai lanceur sans qu'aucune
'  fenêtre de console n'apparaisse, fût-ce un instant.
'
'  C'est le seul rôle qui lui reste. Toute la logique — attendre que le moteur
'  réponde vraiment, expliquer ce qui bloque, ouvrir l'application en fenêtre
'  propre, rester dans la zone de notification — vit dans
'  `outils\lanceur\ELPIS.ps1`, où elle est lisible et modifiable.
'
'  Le « 0 » du deuxième argument de Run est ce qui garantit l'absence de
'  terminal : PowerShell démarre sans hôte de console visible.
' ============================================================================

Option Explicit

Dim shell, fso, racine, lanceur, commande
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

racine = fso.GetParentFolderName(WScript.ScriptFullName)
lanceur = racine & "\outils\lanceur\ELPIS.ps1"

If Not fso.FileExists(lanceur) Then
    MsgBox "Le lanceur est introuvable :" & vbCrLf & lanceur & vbCrLf & vbCrLf & _
           "Le dossier outils\lanceur a-t-il été déplacé ?", _
           vbExclamation, "ELPIS"
    WScript.Quit 1
End If

' -NoProfile : le profil PowerShell de l'utilisateur n'a rien à voir ici, et
' peut coûter une seconde de démarrage.
' -ExecutionPolicy Bypass : la stratégie par défaut de Windows refuse les
' scripts non signés, y compris ceux qu'on a écrits soi-même.
commande = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & lanceur & """"

shell.Run commande, 0, False
