FROM node:lts-alpine
RUN npm install -g yarn -force
WORKDIR /opt/omnihive
COPY /dist/packages/omnihive ./
RUN chown -R node:node /opt/omnihive
USER node
RUN yarn install --silent
ENTRYPOINT ["node", "omnihive.js"]
CMD [ "server" ]