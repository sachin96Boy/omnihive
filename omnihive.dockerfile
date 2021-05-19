FROM node:lts-alpine
WORKDIR /opt/omnihive
COPY /dist/packages/omnihive ./
RUN chown -R node:node /opt/omnihive
USER node
ENTRYPOINT ["node", "omnihive.js"]
CMD [ "server" ]