FROM node:24-alpine
WORKDIR /app
COPY package.json server.mjs lib.mjs markdown.mjs estilo.mjs ./
COPY config ./config
ARG GIT_SHA
ENV HOST=0.0.0.0 PORT=8080 DATOS=/data GIT_SHA=${GIT_SHA}
RUN mkdir /data && chown node /data
USER node
CMD ["node", "server.mjs"]
