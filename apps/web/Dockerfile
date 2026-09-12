FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/scraper/package.json packages/scraper/package.json
RUN npm install

FROM base AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--workspace", "apps/web", "--", "--host", "0.0.0.0"]

FROM base AS build
COPY . .
RUN npm run build --workspace apps/web

FROM nginx:1.27-alpine AS prod
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
