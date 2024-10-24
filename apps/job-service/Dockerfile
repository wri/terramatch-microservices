FROM terramatch-microservices-base:nx-base AS builder

ARG BUILD_FLAG
WORKDIR /app/builder
COPY . .
RUN npx nx build job-service ${BUILD_FLAG}

FROM terramatch-microservices-base:nx-base

ARG NODE_ENV
WORKDIR /app
COPY --from=builder /app/builder ./
ENV NODE_ENV=${NODE_ENV}

CMD ["node", "./dist/apps/job-service/main.js"]
