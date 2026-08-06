# Stage 1: Build
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy dependency files first for layer caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build static binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /tealtiger-sidecar .

# Stage 2: Runtime
FROM alpine:3.19

RUN apk --no-cache add ca-certificates && \
    adduser -D -u 1000 tealtiger

WORKDIR /app

# Copy binary and default config
COPY --from=builder /tealtiger-sidecar /app/tealtiger-sidecar
COPY config.yaml /app/config.yaml

USER tealtiger

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:8080/health || exit 1

ENTRYPOINT ["/app/tealtiger-sidecar"]
CMD ["-config", "/app/config.yaml"]
