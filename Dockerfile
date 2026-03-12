# Frontend build
FROM node:20-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN mkdir -p public/static
RUN npm run build

# Backend build
FROM golang:1.24 AS backend
WORKDIR /app/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/api ./cmd/api

# Runtime
FROM debian:bookworm-slim
WORKDIR /app
COPY --from=backend /out/api /app/api
COPY --from=frontend /app/build /app/build
COPY --from=frontend /app/public/static /app/public/static
ENV FRONTEND_DIR=/app/build
ENV STATIC_DIR=/app/public/static
ENV ADDR=:8080
EXPOSE 8080
CMD ["/app/api"]
