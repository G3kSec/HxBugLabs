FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.js ./
COPY data/ ./data/
COPY views/ ./views/

# Runs as an unprivileged user — nothing in this lab needs root, and there's
# no reason to make a container-escape bug easier than it already would be.
RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 8080
CMD ["node", "server.js"]
