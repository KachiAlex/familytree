#!/bin/bash
set -e
source /opt/familytree/backend/.env
export DATABASE_URL
cd /opt/familytree/backend/scripts
node migrate.js
