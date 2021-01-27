FROM mcr.microsoft.com/windows/servercore:20H2
RUN powershell -Command New-Item -ItemType directory -Path C:\\Downloads
ADD https://nodejs.org/dist/latest-v14.x/node-v14.15.4-x64.msi C:\\Downloads\\nodejs.msi
RUN powershell -Command Start-Process C:\\Downloads\\nodejs.msi -ArgumentList "/qn" -Wait
RUN powershell -Command New-Item -ItemType directory -Path C:\\OmniHive
COPY ../dist/packages/omnihive-server C:/OmniHive
WORKDIR C:/OmniHive
RUN yarn install --silent
RUN next build
EXPOSE 3001

CMD [ "node", "--stack-size=16384", "--max-old-space-size=16384", "app/server/omnihive.js server" ]