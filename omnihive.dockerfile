FROM node:lts-alpine

RUN npm install -g pnpm -force

COPY /dist/server/omnihive /home/node/app/
RUN mkdir -p /home/node/app/node_modules
RUN chown -R node:node /home/node/app

WORKDIR /home/node/app/

USER node
RUN pnpm install

EXPOSE 3001 7205 7206
ENTRYPOINT ["node", "omnihive.js"]