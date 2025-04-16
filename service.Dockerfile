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

# Add user so we don't need --no-sandbox.
#RUN addgroup -S pptruser && adduser -S -G pptruser pptruser \
#    && mkdir -p /home/pptruser/Downloads \
#    && chown -R pptruser:pptruser /home/pptruser

WORKDIR /app
#COPY --chown=pptruser:pptruser . .
COPY . .

# Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Install with development to get our dev dependencies, some of which are required for app build.
# TODO sort out dev deps - nx for instance should get moved out of the dev group
RUN HUSKY=0 NODE_ENV=development npm install

# I haven't been able to figure out why the build fails if it's run as the non-priveleged user, so
# we build as root, then chwon dist and switch users.
RUN npx nx run-many -t build build-repl -p ${SERVICE} --skip-nx-cache ${BUILD_FLAG}
#RUN chown -R pptruser:pptruser dist && ls -l dist/apps && ls -l dist/apps/${SERVICE}*

#USER pptruser

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV SERVICE=${SERVICE}
ENV NODE_ENV=${NODE_ENV}
ENV SENTRY_DSN=${SENTRY_DSN}
ENV DEPLOY_ENV=${DEPLOY_ENV}
CMD ["sh", "-c", "node ./dist/apps/$SERVICE/main.js"]
