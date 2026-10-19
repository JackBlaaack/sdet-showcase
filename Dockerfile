# Test runner image. The tag must match @playwright/test in package.json:
# the image ships the browsers built for exactly that version.
FROM mcr.microsoft.com/playwright:v1.64.1-noble

WORKDIR /tests

# Corepack in the image cannot launch pnpm 12 (see README), so pnpm is installed with npm.
RUN npm install --global pnpm@12.11.2

# Dependencies first: this layer is rebuilt only when the lockfile changes.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ENV CI=true

CMD ["pnpm", "test"]
