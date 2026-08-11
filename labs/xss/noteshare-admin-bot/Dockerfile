FROM node:20-slim

# System Chromium instead of Puppeteer's bundled download — smaller image,
# and Puppeteer's own bundled Chromium has known issues on some bases.
# This is the standard pattern from Puppeteer's own Docker troubleshooting
# guide.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.js bot.js ./
COPY data/ ./data/
COPY views/ ./views/

# Chromium under --no-sandbox (necessary inside most container runtimes)
# has to run as a non-root user by convention — root + --no-sandbox is a
# real privilege-escalation footgun, not just a lint warning.
RUN groupadd -r app && useradd -r -g app -G audio,video app \
    && mkdir -p /home/app/Downloads \
    && chown -R app:app /home/app /app
USER app

EXPOSE 8080
CMD ["node", "server.js"]
