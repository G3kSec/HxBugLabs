FROM node:20-alpine

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.js ./

RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 8085
CMD ["node", "server.js"]
