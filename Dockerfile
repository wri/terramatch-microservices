FROM node:lts-alpine3.21 as builder
ARG NODE_ENV
ARG BUILD_FLAG

WORKDIR /app/builder
COPY . .

# Puppeteer requires many native dependencies for Chromium
# Add these Alpine packages to make Puppeteer work
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && npm install
