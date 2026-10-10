#!/usr/bin/env bash
# Called by terraform_data.deploy: waits for the instance to finish bootstrapping,
# then pulls the latest images and restarts the stack over SSM.
set -euo pipefail

echo "Waiting for SSM agent on $INSTANCE..."
for _ in $(seq 60); do
  [[ $(aws ssm describe-instance-information --filters "Key=InstanceIds,Values=$INSTANCE" \
    --query 'length(InstanceInformationList)' --output text) == 1 ]] && break
  sleep 10
done

COMMANDS=$(cat <<CMD
set -eux
for i in \$(seq 60); do [ -f /opt/honeyrizons/.ready ] && break; sleep 10; done
cd /opt/honeyrizons
echo $COMPOSE_B64 | base64 -d > docker-compose.yml
printf "REGISTRY=$REGISTRY\nIMAGE_TAG=$IMAGE_TAG\nHONEYPOT_SSH_PORT=22\nDASHBOARD_BIND=0.0.0.0\nHONEYPOT_LOCATION=$HONEYPOT_LOCATION\n" > .env
# Optional analyst key (SecureString). Tracing off so it never lands in SSM/CI output.
set +x
KEY=\$(aws ssm get-parameter --region $AWS_REGION --name /honeyrizons/openai_api_key --with-decryption --query Parameter.Value --output text 2>/dev/null || true)
[ -n "\$KEY" ] && echo "OPENAI_API_KEY=\$KEY" >> .env && echo "analyst key: set" || echo "analyst key: none"
set -x
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $REGISTRY
docker compose pull
docker compose up -d --no-build
docker image prune -f
docker compose ps
CMD
)
PARAMS=$(python3 -I -c 'import json,sys; print(json.dumps({"commands": [sys.argv[1]], "executionTimeout": ["900"]}))' "$COMMANDS")
ID=$(aws ssm send-command --instance-ids "$INSTANCE" --document-name AWS-RunShellScript \
  --parameters "$PARAMS" --timeout-seconds 900 --query Command.CommandId --output text)

echo "SSM command $ID..."
while :; do
  STATUS=$(aws ssm get-command-invocation --command-id "$ID" --instance-id "$INSTANCE" --query Status --output text 2>/dev/null || echo Pending)
  case $STATUS in
    Success) break ;;
    Pending|InProgress|Delayed) sleep 5 ;;
    *) aws ssm get-command-invocation --command-id "$ID" --instance-id "$INSTANCE" --query '[StandardOutputContent,StandardErrorContent]' --output text; exit 1 ;;
  esac
done
aws ssm get-command-invocation --command-id "$ID" --instance-id "$INSTANCE" --query StandardOutputContent --output text
