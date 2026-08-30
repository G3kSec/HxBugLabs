FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.js ./
COPY data ./data
COPY public ./public

# Delivery credentials, mounted from the secrets store in production and
# baked in here so the lab has something worth reaching.
RUN mkdir -p /opt/lantern \
    && printf 'host=smtp.eu.lantern-mail.example\nport=587\nuser=lantern-relay\npassword=HxBugLabs{d3nyl1sts_f1lt3r_str1ngs_n0t_s3m4nt1cs}\n' \
       > /opt/lantern/smtp.conf

RUN addgroup -S app && adduser -S app -G app && chown -R app:app /opt/lantern
USER app

EXPOSE 8092
CMD ["node", "server.js"]
