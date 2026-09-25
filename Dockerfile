# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN npm install --global pnpm@9.14.4
WORKDIR /app

# Full install, including devDependencies. `prisma/` and `prisma7.config.ts` are
# copied before the install on purpose: the package has a "postinstall" of
# `prisma generate`, so the schema has to be present or the install fails.
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY prisma7.config.ts ./
RUN pnpm install --frozen-lockfile

# Reusable build stage. It keeps devDependencies, so it is also the stage the
# compose `migrate` service uses to run migrations and the seed, both of which
# need the prisma CLI and tsx.
FROM deps AS build
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm prisma generate
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
# --ignore-scripts is required here: production dependencies do not include the
# prisma CLI, so the "postinstall" of `prisma generate` would fail. The generated
# client is already compiled into dist/ by the build stage instead.
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
COPY --from=build /app/dist ./dist
EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]
