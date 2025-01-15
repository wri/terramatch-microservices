FROM terramatch-microservices-base:nx-base AS builder

ARG BUILD_FLAG
WORKDIR /app/builder
COPY . .
RUN npx nx build user-service ${BUILD_FLAG}

FROM terramatch-microservices-base:nx-base

ARG NODE_ENV
ARG SENTRY_DSN
ARG DEPLOY_ENV
WORKDIR /app
COPY --from=builder /app/builder ./
ENV NODE_ENV=${NODE_ENV}
ENV SENTRY_DSN=${SENTRY_DSN}
ENV DEPLOY_ENV=${DEPLOY_ENV}

CMD ["node", "./dist/apps/user-service/main.js"]
