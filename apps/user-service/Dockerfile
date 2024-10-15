FROM terramatch-microservices-base:nx-base AS builder

ARG BUILD_FLAG
WORKDIR /app/builder
COPY . .
RUN npx nx build user-service ${BUILD_FLAG}

FROM terramatch-microservices-base:nx-base

ARG NODE_ENV
WORKDIR /app
COPY --from=builder /app/builder ./
ENV NODE_ENV=${NODE_ENV}

CMD ["node", "./dist/apps/user-service/main.js"]
