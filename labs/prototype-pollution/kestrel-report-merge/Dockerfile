FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.js ./
COPY data ./data
COPY public ./public

# The renderer's real job: turn a report into a PDF. The binary is not in
# this image, which is why the render path is worth reading rather than
# using.
RUN mkdir -p /opt/kestrel \
    && printf 'workspace=northgate\nlicence=HxBugLabs{0pt10ns_0r_d3f4ult_1s_4_g4dg3t_ch41n}\nseats=25\n' \
       > /opt/kestrel/licence.key

RUN addgroup -S app && adduser -S app -G app && chown -R app:app /opt/kestrel
USER app

EXPOSE 8088
CMD ["node", "server.js"]
