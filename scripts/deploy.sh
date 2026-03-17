#!/bin/bash
set -e

IMAGE="registry.cn-hangzhou.aliyuncs.com/openz/hr-assistant:latest"
REMOTE_USER="zhaozhong"
REMOTE_HOST="115.191.30.167"
REMOTE_DIR="/home/zhaozhong/workspace/hr-assistant"

echo "=== Step 1: Build Docker image ==="
docker build --platform linux/amd64 -t "$IMAGE" .

echo "=== Step 2: Push to Alibaba Cloud Registry ==="
docker push "$IMAGE"

echo "=== Step 3: Prepare remote directory ==="
ssh "$REMOTE_USER@$REMOTE_HOST" "mkdir -p $REMOTE_DIR/data"

echo "=== Step 4: Upload config files ==="
scp docker-compose.yml "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"
scp .env.local "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"

echo "=== Step 5: Upload local data ==="
scp -r data/ "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"

echo "=== Step 6: Deploy on remote ==="
ssh "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_DIR && docker pull $IMAGE && docker compose down 2>/dev/null; docker compose up -d"

echo "=== Step 7: Check status ==="
sleep 5
ssh "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_DIR && docker compose ps"

echo ""
echo "Deployment complete! Access at: http://$REMOTE_HOST:3000"
