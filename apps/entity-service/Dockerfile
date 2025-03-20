FROM terramatch-microservices-base:nx-base AS builder

ARG BUILD_FLAG
WORKDIR /app/builder
COPY . .
RUN npx nx run entity-service:build-repl ${BUILD_FLAG} && \
    npx nx run entity-service:build ${BUILD_FLAG} && \
    ls dist/apps && \
    ls dist/apps/entity-service && \
    ls dist/apps/entity-service-repl

FROM terramatch-microservices-base:nx-base

ARG NODE_ENV
ARG SENTRY_DSN
ARG DEPLOY_ENV
WORKDIR /app
COPY --from=builder /app/builder ./
ENV NODE_ENV=${NODE_ENV}
ENV SENTRY_DSN=${SENTRY_DSN}
ENV DEPLOY_ENV=${DEPLOY_ENV}

CMD ["node", "./dist/apps/entity-service/main.js"]
