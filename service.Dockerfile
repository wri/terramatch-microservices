FROM node:lts-alpine3.21 AS builder

ARG NODE_ENV
ARG SERVICE
ARG BUILD_FLAG

WORKDIR /app/builder
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

RUN npx nx run-many -t build build-repl -p ${SERVICE} ${BUILD_FLAG} && \
    ls dist/apps && \
    ls dist/apps/${SERVICE}*

FROM terramatch-microservices-base:nx-base

ARG SERVICE
ARG NODE_ENV
ARG SENTRY_DSN
ARG DEPLOY_ENV
WORKDIR /app
COPY --from=builder /app/builder ./
ENV SERVICE=${SERVICE}
ENV NODE_ENV=${NODE_ENV}
ENV SENTRY_DSN=${SENTRY_DSN}
ENV DEPLOY_ENV=${DEPLOY_ENV}

CMD ["sh", "-c", "node ./dist/apps/$SERVICE/main.js"]
