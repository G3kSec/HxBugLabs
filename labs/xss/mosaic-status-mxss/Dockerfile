FROM node:20-slim

# System Chromium rather than Puppeteer's bundled download: smaller image
# and the pattern Puppeteer's own Docker guide recommends.
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

COPY server.js sanitize.js bot.js ./
COPY data ./data
COPY views ./views
COPY public ./public

# Chromium under --no-sandbox has to run as a non-root user: root plus
# --no-sandbox is a genuine privilege-escalation footgun.
RUN groupadd -r app && useradd -r -g app -G audio,video app \
    && mkdir -p /home/app/Downloads \
    && chown -R app:app /home/app /app
USER app

EXPOSE 8085
CMD ["node", "server.js"]
