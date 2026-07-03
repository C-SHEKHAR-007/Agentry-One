FROM node:20-slim AS build

# Vite inlines env vars at build time, so the API key the SPA sends must be
# provided as a build arg (matching the api service's AGENTRY_API_KEY).
ARG VITE_AGENTRY_API_KEY
ENV VITE_AGENTRY_API_KEY=$VITE_AGENTRY_API_KEY

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
