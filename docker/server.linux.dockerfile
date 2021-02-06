FROM node:lts-alpine
RUN npm install -g yarn
COPY ../dist/packages/omnihive /home/node/app/
RUN chown -R node:node /home/node/app
WORKDIR /home/node/app
USER node
RUN yarn install --silent
RUN next build
EXPOSE 3001

CMD [ "node", "app/server/omnihive.js server" ]