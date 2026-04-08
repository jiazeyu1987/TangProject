FROM debian:bookworm-slim

ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    PATH=/usr/local/node/bin:$PATH

ADD https://nodejs.org/dist/v20.20.2/node-v20.20.2-linux-x64.tar.gz /tmp/node.tar.gz

WORKDIR /app

RUN mkdir -p /usr/local/node \
    && tar -xzf /tmp/node.tar.gz -C /usr/local/node --strip-components=1 \
    && rm -f /tmp/node.tar.gz

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
