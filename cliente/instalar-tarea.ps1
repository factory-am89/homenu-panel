$nombre = "HoMenu panel - enviar fabrica"
$log = Join-Path $env:USERPROFILE ".claude\menuplan-fabrica\enviar.log"
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null
$orden = "/c `"`"C:\Program Files\nodejs\node.exe`" C:\dev\homenu-panel\cliente\enviar-fabrica.mjs --menuplan C:\dev\MenuPlan --solo-si-cambia >> `"$log`" 2>&1`""
$accion = New-ScheduledTaskAction -Execute "conhost.exe" -Argument "--headless cmd.exe $orden"
$cada10 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 10)
$ajustes = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $nombre -Action $accion -Trigger $cada10 -Settings $ajustes -Force | Select-Object TaskName, State
(Get-ScheduledTask -TaskName $nombre).Actions | Select-Object Execute, Arguments | Format-List
