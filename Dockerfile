FROM node:24-alpine
WORKDIR /app
COPY package.json server.mjs lib.mjs markdown.mjs estilo.mjs cockpit.mjs ./
COPY config ./config
ENV HOST=0.0.0.0 PORT=8080 DATOS=/data
RUN mkdir /data && chown node /data
USER node
CMD ["node", "server.mjs"]
