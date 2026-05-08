FROM node:24.15-alpine3.23 as builder
ARG NODE_ENV
ARG BUILD_FLAG

WORKDIR /app/builder
COPY . .
RUN npm i
