FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY docs ./docs
COPY fixtures ./fixtures
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
ENV RXWF_HTTP_PORT=8787
ENV RXWF_DATA_DIR=/data
ENV RXWF_FEATURE_PLUS=true
EXPOSE 8787
COPY --from=build /app /app
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
