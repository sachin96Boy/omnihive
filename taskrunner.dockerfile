FROM node:lts-alpine

RUN npm install -g yarn -force

COPY /dist/packages/omnihive /home/node/app/
RUN mkdir -p /home/node/app/node_modules
RUN chown -R node:node /home/node/app

WORKDIR /home/node/app/

USER node
RUN yarn install --silent

ENTRYPOINT ["node", "omnihive.js"]

CMD [ "taskRunner" ]