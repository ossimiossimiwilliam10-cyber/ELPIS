#!/bin/bash

# ======================================================================
# SCRIPT DE DÉPLOIEMENT ELPIS (UBUNTU / ORACLE CLOUD)
# ======================================================================

echo "🚀 Démarrage de l'installation d'ELPIS..."

# 1. Installation des prérequis
echo "📦 Installation de Node.js..."
if ! command -v node &> /dev/null
then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# 2. Build du Frontend React
echo "🌐 Build de l'interface React..."
cd interface/web
npm install
npm run build
cd ../..

# 3. Installation du Backend Node.js
echo "🌉 Installation du Bridge Node.js..."
cd interface/bridge
npm install
cd ../..

# 4. Lancement avec PM2
echo "🔥 Démarrage du serveur..."
sudo npm install -g pm2
cd interface/bridge
pm2 start server.js --name "elpis-server"
pm2 save
pm2 startup

echo "======================================================================"
echo "✅ DÉPLOIEMENT RÉUSSI !"
echo "ELPIS tourne maintenant sur le port 3001 de votre serveur."
echo "Vous pouvez y accéder via http://<IP_DE_VOTRE_SERVEUR>:3001"
echo "======================================================================"
