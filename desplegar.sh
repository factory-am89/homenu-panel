#!/bin/sh
# En el servidor: construye y arranca el panel con el commit dado, y falla en alto.
#   desplegar.sh <sha>
# Códigos de salida, uno por clase (los traduce despliegue/tirar.sh a su vocabulario):
#   0  desplegado: la web contesta con el SHA pedido en /version
#   2  uso: falta el SHA
#   10 fallo-build: docker compose build falló; no se llama a up
#   11 fallo-arranque: up falló, o /version no dio el SHA a tiempo
# Entorno (solo para test): ESPERA_MAX segundos de tope (60), ESPERA_PASO segundos entre intentos (2).
# Proyecto fijo "-p app": cambiarlo crearía otro volumen y se perderían los datos del panel.
set -eu

if [ $# -ne 1 ] || [ -z "$1" ]; then
  echo "uso: desplegar.sh <sha>" >&2
  exit 2
fi
sha=$1
espera_max=${ESPERA_MAX:-60}
espera_paso=${ESPERA_PASO:-2}
cd "$(dirname "$0")"

if ! GIT_SHA=$sha docker compose -p app build; then
  echo "desplegar: fallo-build" >&2
  exit 10
fi

if ! docker compose -p app up -d; then
  echo "desplegar: fallo-arranque (up falló)" >&2
  exit 11
fi

transcurrido=0
while :; do
  # la dirección sale de compose.yaml (ports), para no repetirla aquí; si el contenedor aún no existe, se reintenta
  direccion=$(docker compose -p app port panel 8080 2>/dev/null) || direccion=""
  if [ -n "$direccion" ]; then
    visto=$(curl -fsS --max-time 3 "http://$direccion/version" 2>/dev/null) || visto=""
    if [ "$visto" = "$sha" ]; then
      echo "desplegar: desplegado $sha"
      exit 0
    fi
  fi
  if [ "$transcurrido" -ge "$espera_max" ]; then
    echo "desplegar: fallo-arranque (/version no dio $sha en ${espera_max}s; vio '${visto:-nada}')" >&2
    exit 11
  fi
  sleep "$espera_paso"
  transcurrido=$((transcurrido + espera_paso))
done
