Set WshShell = CreateObject("WScript.Shell")

' 1. Fermer toute instance precedente
WshShell.Run "cmd /c for /f ""tokens=5"" %a in ('netstat -aon ^| findstr "":3001"" ^| find ""LISTENING""') do taskkill /F /PID %a", 0, True
WScript.Sleep 1000

' 2. Lancer le serveur Node en arriere-plan (invisible)
Set objFSO = CreateObject("Scripting.FileSystemObject")
strPath = objFSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strPath & "\interface\bridge"
WshShell.Run "cmd /c node server.js", 0, False

' 3. Attendre 2 secondes que le serveur demarre
WScript.Sleep 2000

' 4. Ouvrir le navigateur
WshShell.Run "http://localhost:3001"
