# --- build ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
# --include=dev ensures typescript/@types install even if NODE_ENV=production.
RUN npm ci --include=dev
COPY . .
RUN npm run build
# Fail loudly if tsc produced nothing.
RUN ls dist/ || (echo "dist is empty, build failed" && exit 1)

# --- runtime ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
RUN mkdir -p /app/uploads
EXPOSE 3001
CMD ["node", "dist/index.js"]
