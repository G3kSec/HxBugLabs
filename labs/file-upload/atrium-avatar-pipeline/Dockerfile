FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.js ./
COPY data ./data
COPY public ./public

RUN mkdir -p /app/uploads \
    && addgroup -S app && adduser -S app -G app \
    && chown -R app:app /app/uploads /app/public
USER app

EXPOSE 8091
CMD ["node", "server.js"]
