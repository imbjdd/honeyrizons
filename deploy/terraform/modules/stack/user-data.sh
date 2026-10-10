#!/bin/bash
# Installs Docker + Compose and starts the stack. Later updates go through deploy.sh (SSM).
set -eux
dnf install -y docker
mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL https://github.com/docker/compose/releases/download/v2.39.4/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
echo '{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}}' > /etc/docker/daemon.json
systemctl enable --now docker

# Port 22 belongs to the honeypot; admin access is through SSM.
systemctl disable --now sshd.socket sshd.service || true

mkdir -p /opt/honeyrizons && cd /opt/honeyrizons
echo '${compose_b64}' | base64 -d > docker-compose.yml
printf 'REGISTRY=${registry}\nIMAGE_TAG=${image_tag}\nHONEYPOT_SSH_PORT=22\nDASHBOARD_BIND=0.0.0.0\nHONEYPOT_LOCATION=${location}\n' > .env
aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin ${registry}
docker compose pull
docker compose up -d --no-build
touch /opt/honeyrizons/.ready
