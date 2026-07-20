#!/bin/bash

# ======================================================================
# SCRIPT DE DÉPLOIEMENT ELPIS POUR ORACLE CLOUD (UBUNTU)
# ======================================================================

echo "🚀 Démarrage de l'installation d'ELPIS..."

# 1. Mise à jour du système et installation des prérequis
echo "📦 Installation des dépendances système (CMake, g++, Node.js)..."
sudo apt update
sudo apt install -y build-essential cmake

# Installation de Node.js (via NodeSource)
if ! command -v node &> /dev/null
then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# 2. Compilation des moteurs C++
echo "⚙️ Compilation des Cerveaux C++..."
mkdir -p build
cd build
cmake ..
make
cd ..

# 3. Installation et Build du Frontend React
echo "🌐 Préparation de l'interface React..."
cd interface/web
npm install
npm run build
cd ../..

# 4. Installation du Backend Node.js
echo "🌉 Préparation du Bridge Node.js..."
cd interface/bridge
npm install

# 5. Lancement avec PM2 (Gestionnaire de processus)
echo "🔥 Démarrage du serveur..."
sudo npm install -g pm2
pm2 start server.js --name "elpis-server"
pm2 save
pm2 startup

echo "======================================================================"
echo "✅ DÉPLOIEMENT RÉUSSI !"
echo "ELPIS tourne maintenant sur le port 3001 de votre serveur."
echo "Vous pouvez y accéder via http://<IP_DE_VOTRE_SERVEUR>:3001"
echo "======================================================================"
