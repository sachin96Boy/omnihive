FROM node:lts-alpine
RUN npm install -g yarn
COPY ../dist/packages/omnihive /home/node/app/
RUN chown -R node:node /home/node/app
WORKDIR /home/node/app
USER node
RUN yarn install --silent
RUN next build
EXPOSE 3001

CMD [ "node", "--stack-size=16384", "--max-old-space-size=16384", "app/server/omnihive.js server" ]