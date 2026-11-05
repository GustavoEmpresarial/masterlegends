#!/bin/bash

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "=========================================="
echo "🎮 MASTER LEGENDS LEAGUE"
echo "=========================================="
echo ""

if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker is running${NC}"

if [ ! -f .env ]; then
    cp .env.example .env 2>/dev/null || true
fi

echo ""
echo "🚀 Starting services..."
echo ""

echo "⏳ Building and waiting for healthchecks..."
docker compose up -d --build --wait

echo ""
echo "=========================================="
echo -e "${GREEN}✅ Services started!${NC}"
echo "=========================================="
echo ""
echo "📍 Access: http://localhost:15000"
echo ""
