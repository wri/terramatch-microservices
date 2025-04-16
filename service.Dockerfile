FROM node:lts-alpine3.21 AS builder

ARG NODE_ENV
ARG SERVICE
ARG BUILD_FLAG
ARG SENTRY_DSN
ARG DEPLOY_ENV

WORKDIR /app
COPY . .

# Puppeteer requires many native dependencies for Chromium
# https://pptr.dev/troubleshooting#running-on-alpine
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && npm install

# Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN npx nx run-many -t build build-repl -p ${SERVICE} ${BUILD_FLAG} && \
    ls dist/apps && \
    ls dist/apps/${SERVICE}*

# Add user so we don't need --no-sandbox.
RUN addgroup -S pptruser && adduser -S -G pptruser pptruser \
    && mkdir -p /home/pptruser/Downloads /app \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /app

USER pptruser

ENV SERVICE=${SERVICE}
ENV NODE_ENV=${NODE_ENV}
ENV SENTRY_DSN=${SENTRY_DSN}
ENV DEPLOY_ENV=${DEPLOY_ENV}
CMD ["sh", "-c", "node ./dist/apps/$SERVICE/main.js"]
