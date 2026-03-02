#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting deployment...${NC}"

# Check .env file
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo -e "${YELLOW}Please create it from .env.example${NC}"
    exit 1
fi

# Load environment variables
echo -e "${YELLOW}🔐 Loading environment variables...${NC}"
set -o allexport
source .env
set +o allexport

# Stop & remove existing containers, networks, volumes
echo -e "${YELLOW}🛑 Cleaning old containers & networks...${NC}"
docker compose down --volumes --remove-orphans || true

# Build all services
echo -e "${YELLOW}📦 Building Docker images...${NC}"
docker compose build --no-cache

# Start Redis first (external DB is already running)
echo -e "${YELLOW}🗄️ Starting Redis...${NC}"
docker compose up -d redis

# Wait for database to be ready
echo -e "${YELLOW}⏳ Waiting for database to initialize...${NC}"
sleep 10

# Run migrations
echo -e "${YELLOW}🗃️ Running Django migrations...${NC}"
docker compose run --rm backend python manage.py migrate

# Collect static files
echo -e "${YELLOW}📁 Collecting static files...${NC}"
docker compose run --rm backend python manage.py collectstatic --noinput

# Start all services
echo -e "${YELLOW}🐳 Starting all services...${NC}"
docker compose up -d

# Check status
echo -e "${YELLOW}✅ Checking service status...${NC}"
sleep 5
docker compose ps

echo -e "${GREEN}✨ Deployment complete!${NC}"
echo -e "${GREEN}📊 Frontend: http://localhost${NC}"
echo -e "${GREEN}🔧 Backend API: http://localhost/api${NC}"
echo -e "${GREEN}📈 Admin: http://localhost/admin${NC}"
echo -e "${YELLOW}📝 Check logs with: docker compose logs -f${NC}"