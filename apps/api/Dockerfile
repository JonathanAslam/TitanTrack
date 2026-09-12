FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/scraper/package.json packages/scraper/package.json
RUN npm install

FROM base AS dev
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev", "--workspace", "apps/api"]

FROM base AS build
COPY . .
RUN npm run build --workspace apps/api

FROM node:20-alpine AS prod
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/packages/scraper/package.json packages/scraper/package.json
RUN npm install --workspace apps/api --omit=dev
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/packages/scraper/src packages/scraper/src
EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
