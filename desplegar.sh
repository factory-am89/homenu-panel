#!/bin/sh
# En el servidor: reconstruye y arranca el panel. Lo lanza la sesión con nohup; el log queda en /root/panel-deploy.log
cd /opt/panel/app && docker compose up -d --build > /root/panel-deploy.log 2>&1 && echo "FIN ok" >> /root/panel-deploy.log || echo "FIN fallo" >> /root/panel-deploy.log
