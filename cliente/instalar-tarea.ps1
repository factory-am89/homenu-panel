$nombre = "HoMenu panel - enviar fabrica"
$log = Join-Path $env:USERPROFILE ".claude\menuplan-fabrica\enviar.log"
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null
$vbs = Join-Path $PSScriptRoot "oculto.vbs"
$accion = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbs`""
$cada10 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 10)
$ajustes = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $nombre -Action $accion -Trigger $cada10 -Settings $ajustes -Force | Select-Object TaskName, State
(Get-ScheduledTask -TaskName $nombre).Actions | Select-Object Execute, Arguments | Format-List
