# Production image: the built SPA served by nginx, which also forwards /api to the Mon-Ecole-Backend API
# so the browser talks to a single origin (the refresh-token cookie stays first-party).
# The main production host is Cloudflare Workers (see README); this image is for Docker-based hosting and demos.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Where the SPA sends API calls. The default (same origin, proxied by nginx below) suits this image.
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine
# API_UPSTREAM is substituted into the template when the container starts.
ENV API_UPSTREAM=http://host.docker.internal:8000
COPY nginx/security-headers.conf /etc/nginx/security-headers.conf
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
# The unprivileged nginx image already runs as uid 101; declare it so scanners and platforms can verify.
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD ["wget", "-q", "--spider", "http://127.0.0.1:8080/healthz"]
