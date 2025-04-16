FROM node:lts-alpine3.21

ARG NODE_ENV
ARG SERVICE
ARG BUILD_FLAG
ARG SENTRY_DSN
ARG DEPLOY_ENV

# Puppeteer requires many native dependencies for Chromium
# https://pptr.dev/troubleshooting#running-on-alpine
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

WORKDIR /app
COPY . .

# Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Install with development to get our dev dependencies, some of which are required for app build.
# TODO sort out dev deps - nx for instance should get moved out of the dev group
RUN HUSKY=0 NODE_ENV=development npm install

RUN npx nx run-many -t build build-repl -p ${SERVICE} --skip-nx-cache ${BUILD_FLAG}

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV SERVICE=${SERVICE}
ENV NODE_ENV=${NODE_ENV}
ENV SENTRY_DSN=${SENTRY_DSN}
ENV DEPLOY_ENV=${DEPLOY_ENV}
CMD ["sh", "-c", "node ./dist/apps/$SERVICE/main.js"]
