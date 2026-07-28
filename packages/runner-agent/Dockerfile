FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @rxwf/runner-agent... build

FROM node:20-alpine
WORKDIR /app/packages/runner-agent
ENV NODE_ENV=production
COPY --from=build /app /app
CMD ["node", "dist/cli/main.js", "start", "--config", "/config/rxwf-runner.json"]
