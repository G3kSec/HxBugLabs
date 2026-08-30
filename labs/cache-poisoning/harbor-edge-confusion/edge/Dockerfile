FROM node:20-alpine
WORKDIR /app
COPY package.json server.js ./
RUN addgroup -S app && adduser -S app -G app
USER app
EXPOSE 8087
CMD ["node", "server.js"]
