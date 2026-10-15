#!/bin/bash
# En el servidor: tira de origin/main y despliega si toca. Lo lanzará un temporizador (trozo 5).
# Cada ejecución deja UNA clase de resultado en $ESTADO/estado.json (vocabulario cerrado: despliegue/resultados.json).
# Sale con 0 si no hay nada que lamentar (desplegado, sin-cambios, ocupado) y con 1 si hay algo que mirar.
# Excepción, a propósito: si desplegar.sh sale con un código que no conoce, sale con 70 y NO toca estado.json
# (no hay clase honesta que poner); queda el motivo en stderr y el SHA como último fallido.
# Rutas inyectables (test): REPO ESTADO LOCK LLAVE DESPLEGAR.
set -euo pipefail

REPO=${REPO:-/opt/panel/app}
ESTADO=${ESTADO:-/var/lib/panel-despliegue}
LOCK=${LOCK:-/run/panel-tirar.lock}
LLAVE=${LLAVE:-/root/.ssh/panel_despliegue}
DESPLEGAR=${DESPLEGAR:-$REPO/desplegar.sh}
objetivo=""

leer() { if [ -f "$ESTADO/$1" ]; then cat "$ESTADO/$1"; fi; }

# Escribe un fichero de $ESTADO de golpe (nunca queda a medias): guardar <nombre> <contenido>
guardar() {
  local tmp
  tmp=$(mktemp "$ESTADO/.tmp.XXXXXX")
  printf '%s\n' "$2" > "$tmp"
  mv "$tmp" "$ESTADO/$1"
}

# terminar <clase> <código de salida>: apunta la clase en estado.json y sale
terminar() {
  guardar estado.json "$(printf '{"resultado":"%s","sha":"%s","desplegado":"%s","hora":"%s"}' \
    "$1" "$objetivo" "$(leer desplegado)" "$(date -u +%Y-%m-%dT%H:%M:%SZ)")"
  echo "tirar: $1 ${objetivo}" >&2
  exit "$2"
}

mkdir -p "$ESTADO"

exec 9> "$LOCK"
flock -n 9 || terminar ocupado 0

cd "$REPO"
export GIT_SSH_COMMAND="ssh -i $LLAVE -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes"
git fetch origin main || terminar fallo-fetch 1
objetivo=$(git rev-parse origin/main) || terminar fallo-fetch 1

actual=$(leer desplegado)
fallido=$(leer ultimo-fallido)

if [ "$objetivo" = "$actual" ]; then terminar sin-cambios 0; fi
if [ "$objetivo" = "$fallido" ]; then terminar sigue-fallido 1; fi

# Guardia: lo que cambia las reglas del despliegue lo mira una persona antes (el primer despliegue no tiene base)
if [ -n "$actual" ]; then
  cambios=$(git diff --name-only "$actual..$objetivo") || terminar necesita-ok 1
  if printf '%s\n' "$cambios" | grep -qE '^(compose\.yaml|desplegar\.sh|despliegue/)'; then terminar necesita-ok 1; fi
fi

git checkout --detach "$objetivo" || terminar necesita-ok 1

if sh "$DESPLEGAR" "$objetivo"; then
  guardar desplegado "$objetivo"
  rm -f "$ESTADO/ultimo-fallido"
  terminar desplegado 0
else
  codigo=$?
  guardar ultimo-fallido "$objetivo"
  case $codigo in
    10) terminar fallo-build 1 ;;
    11) terminar fallo-arranque 1 ;;
    *) echo "tirar: desplegar.sh salió con $codigo, un código que no conozco" >&2; exit 70 ;;
  esac
fi
