FROM terramatch-microservices-base:nx-base AS builder

ARG SERVICE
ARG BUILD_FLAG
ARG SENTRY_AUTH_TOKEN
WORKDIR /app/builder
COPY . .
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}
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
