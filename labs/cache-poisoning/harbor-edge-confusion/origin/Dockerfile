FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.js ./
COPY data ./data
COPY views ./views
COPY public ./public

RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 8080
CMD ["node", "server.js"]
