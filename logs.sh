#!/bin/bash

echo "📊 Master Legends League - Logs"
echo ""

if [ -z "$1" ]; then
    echo "Showing all logs (Ctrl+C to exit)..."
    echo ""
    docker compose logs -f
else
    echo "Showing logs for: $1"
    echo ""
    docker compose logs -f "$1"
fi
