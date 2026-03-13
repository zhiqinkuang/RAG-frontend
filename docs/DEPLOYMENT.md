# Deployment Guide

This guide covers deploying the Next.js Frontend application to production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Docker Deployment](#docker-deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [Nginx Configuration](#nginx-configuration)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- Docker 24.0+
- Docker Compose 2.20+
- 2GB+ RAM
- 10GB+ Disk Space

### Required Environment Variables

Before deployment, ensure you have:

1. **API Configuration**
   - NEXT_PUBLIC_API_URL - Backend API URL
   - Any other public environment variables

2. **SSL Certificates** (for production)
   - SSL certificate
   - SSL private key

## Quick Start

### 1. Clone and Configure

```bash
# Clone the repository
git clone <repository-url>
cd my-app

# Copy environment template
cp .env.example .env.production

# Edit environment variables
vim .env.production
```

### 2. Build and Run

```bash
# Build Docker image
docker build -t webchat-frontend:latest .

# Run container
docker run -p 3000:3000 webchat-frontend:latest

# Or using docker-compose
docker-compose up -d
```

### 3. Verify Deployment

```bash
# Check health
curl http://localhost:3000/api/health

# View logs
docker logs -f <container-id>
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | Yes |
| `NODE_ENV` | Environment (production) | Yes |

### Next.js Configuration

The `next.config.ts` includes:

- Standalone output for Docker
- Security headers
- Content Security Policy

### Docker Configuration

The Dockerfile uses multi-stage builds:

1. **deps** - Install dependencies
2. **builder** - Build the application
3. **runner** - Production image

## Docker Deployment

### Building Images

```bash
# Build with default settings
docker build -t webchat-frontend:latest .

# Build with build args
docker build \
  --build-arg NODE_ENV=production \
  -t webchat-frontend:latest .

# Build for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t webchat-frontend:latest .
```

### Running Containers

```bash
# Basic run
docker run -p 3000:3000 webchat-frontend:latest

# With environment variables
docker run \
  -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=https://api.example.com \
  webchat-frontend:latest

# With volume for logs
docker run \
  -p 3000:3000 \
  -v /var/log/webchat:/app/logs \
  webchat-frontend:latest
```

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=http://backend:8080
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    restart: unless-stopped
```

## CI/CD Pipeline

The project includes a comprehensive CI/CD pipeline in `.github/workflows/ci.yml`.

### Pipeline Stages

1. **Lint** - Code quality and type checking
2. **Test** - Unit tests
3. **E2E** - End-to-end tests with Playwright
4. **Build** - Build the application
5. **Docker** - Build and push Docker images
6. **Security** - Security scanning

### Required GitHub Secrets

Configure these secrets in your GitHub repository:

| Secret | Description |
|--------|-------------|
| `DOCKERHUB_USERNAME` | Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token |
| `SNYK_TOKEN` | Snyk API token (optional) |

### Manual Deployment

```bash
# Build and push
docker build -t your-registry/webchat-frontend:latest .
docker push your-registry/webchat-frontend:latest

# Deploy to server
ssh user@server "docker pull your-registry/webchat-frontend:latest && docker-compose up -d"
```

## Nginx Configuration

### Basic Setup

The `nginx/nginx.conf` provides:

- Reverse proxy to Next.js
- Static file caching
- Rate limiting
- Security headers

### SSL Configuration

1. **Let's Encrypt (Recommended)**

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo systemctl enable certbot.timer
```

2. **Manual Certificate**

```bash
# Create SSL directory
sudo mkdir -p /etc/nginx/ssl

# Copy certificates
sudo cp your-cert.pem /etc/nginx/ssl/cert.pem
sudo cp your-key.pem /etc/nginx/ssl/key.pem

# Set permissions
sudo chmod 600 /etc/nginx/ssl/key.pem
sudo chmod 644 /etc/nginx/ssl/cert.pem
```

### Docker Compose with Nginx

```yaml
version: '3.8'

services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
    networks:
      - web-network
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - frontend
    networks:
      - web-network
    restart: unless-stopped

networks:
  web-network:
    driver: bridge
```

## Security Considerations

### 1. Environment Variables

- **Never commit secrets** to version control
- Use `.env.production.local` for local secrets
- Use CI/CD secrets for deployment

### 2. Content Security Policy

Configured in `next.config.ts`:

```typescript
"Content-Security-Policy": [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https: wss:",
].join("; ")
```

### 3. Security Headers

All responses include:

- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin

### 4. Container Security

- Runs as non-root user (nextjs:nodejs)
- Minimal base image (node:20-alpine)
- Health checks configured

## Troubleshooting

### Common Issues

#### 1. Container fails to start

```bash
# Check logs
docker logs <container-id>

# Check build output
docker build --no-cache -t webchat-frontend:latest .
```

#### 2. API connection failed

```bash
# Verify environment variables
docker exec <container-id> env | grep NEXT_PUBLIC

# Check network connectivity
docker exec <container-id> wget -qO- http://backend:8080/health
```

#### 3. Out of memory

```bash
# Check resource usage
docker stats

# Increase Node.js memory
docker run -e NODE_OPTIONS="--max-old-space-size=4096" ...
```

#### 4. Build fails

```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
pnpm build
```

### Useful Commands

```bash
# View logs
docker logs -f <container-id>

# Execute command in container
docker exec -it <container-id> sh

# Check health
docker inspect <container-id> | jq '.[0].State.Health'

# Restart container
docker restart <container-id>
```

## Performance Optimization

### 1. Static Asset Caching

Nginx caches static assets for 1 year:

```nginx
location /_next/static/ {
    expires 1y;
    add_header Cache-Control "public, max-age=31536000, immutable";
}
```

### 2. Gzip Compression

Enabled in nginx:

```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript;
```

### 3. Image Optimization

Next.js Image component automatically optimizes images.

### 4. Code Splitting

Next.js automatically splits code by route.

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Docker Documentation](https://docs.docker.com/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)