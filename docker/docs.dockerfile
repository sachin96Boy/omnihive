FROM nginx:latest
COPY ../src/other/omnihive-docs/build/ /usr/share/nginx/html
EXPOSE 80