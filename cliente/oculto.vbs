' Lanza el envío del informe de fabrica sin abrir ventana (lo usa la tarea de Windows, ver instalar-tarea.ps1).
' Una línea por ejecución en ~\.claude\menuplan-fabrica\enviar.log. (Ojo: "log" es palabra reservada de VBScript.)
Set sh = CreateObject("WScript.Shell")
registro = sh.ExpandEnvironmentStrings("%USERPROFILE%") & "\.claude\menuplan-fabrica\enviar.log"
orden = "cmd.exe /c """"C:\Program Files\nodejs\node.exe"" C:\dev\homenu-panel\cliente\enviar-fabrica.mjs --menuplan C:\dev\MenuPlan-panel-lectura --actualizar --solo-si-cambia >> """ & registro & """ 2>&1"""
sh.Run orden, 0, True
