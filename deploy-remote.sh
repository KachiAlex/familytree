#!/bin/bash
set -e

APP_DIR="/opt/familytree"
DB_NAME="familytree"
DB_USER="familytree_user"
DB_PASS=$(openssl rand -base64 24 | tr -d '/+' | cut -c1-24)
JWT_SECRET=$(openssl rand -base64 48)

# Basic packages
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y curl gnupg2 software-properties-common nginx postgresql postgresql-contrib build-essential

# NodeSource Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# PostgreSQL setup
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" || true
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" || true

# Extract app
mkdir -p "$APP_DIR"
tar -xzf /tmp/familytree-deploy.tar.gz -C "$APP_DIR"
cd "$APP_DIR"

# Backend
pushd backend
npm install
cat > .env <<EOF
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
JWT_SECRET=$JWT_SECRET
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
AWS_REGION=us-east-1
FRONTEND_URL=http://67.211.210.8
EOF
echo "Migrations skipped; server.js initializes the database on startup"
popd

# Frontend
pushd frontend
npm install
cat > .env <<EOF
REACT_APP_API_URL=http://67.211.210.8:5000/api
EOF
npm run build
popd

# Backend service
npm install -g pm2
cd "$APP_DIR/backend"
pm2 start server.js --name familytree-backend
pm2 startup systemd -u root --hp /root
pm2 save

# Nginx
rm -f /etc/nginx/sites-enabled/default
cat > /etc/nginx/sites-available/familytree <<'NGINX'
server {
    listen 80;
    server_name _;

    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        root /opt/familytree/frontend/build;
        try_files $uri $uri/ /index.html;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/familytree /etc/nginx/sites-enabled/familytree
nginx -t
systemctl restart nginx

echo "=== FAMILYTREE DEPLOYMENT COMPLETE ==="
echo "Backend: http://67.211.210.8:5000"
echo "Frontend: http://67.211.210.8"
echo "DB User: $DB_USER"
echo "DB Pass: $DB_PASS"
echo "JWT Secret: $JWT_SECRET"
