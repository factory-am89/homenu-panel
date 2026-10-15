FROM node:24-alpine
WORKDIR /app
COPY package.json server.mjs lib.mjs markdown.mjs estilo.mjs ./
COPY config ./config
COPY despliegue/resultados.json ./despliegue/resultados.json
ENV HOST=0.0.0.0 PORT=8080 DATOS=/data
RUN mkdir /data && chown node /data
# carpeta de estado.json, montada solo lectura (compose.yaml); la escribe despliegue/tirar.sh en el servidor
ENV ESTADO_DESPLIEGUE=/despliegue/estado.json
USER node
CMD ["node", "server.mjs"]
