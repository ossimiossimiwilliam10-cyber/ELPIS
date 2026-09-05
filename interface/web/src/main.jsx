import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { brancherMoteurLocal } from './moteur/sourceLocale'
import { calculerRapportLocal } from './moteur/rapportLocal'
import { consulterLocal } from './moteur/repetiteurLocal'
import { sourceExterne } from '../../bridge/moteur/stockage'
import useStore from './store'
import './index.css'

/*
 * Le moteur est branché avant le premier rendu, et pas plus tard.
 *
 * C'est le même moteur que celui du PC — pas une copie, pas une version
 * simplifiée : les fichiers de `interface/bridge/moteur` sont embarqués tels
 * quels. Seule change la source qui l'alimente : SQLite là-bas, les documents
 * de cet appareil ici. Une suite de tests vérifie que les deux produisent le
 * même rapport, faute de quoi la duplication reviendrait par la fenêtre.
 *
 * Le brancher ici, au tout début, garantit qu'aucun composant ne peut demander
 * un calcul avant que le moteur sache où lire.
 */
brancherMoteurLocal()

/*
 * Une poignée pour regarder à l'intérieur, depuis le téléphone.
 *
 * Sur le PC on ouvre les outils de développement ; sur le téléphone, non — et
 * un écran d'accueil vide y ressemble exactement à un écran d'accueil vide,
 * qu'il vienne d'un cursus absent, d'un moteur non branché ou d'une exception
 * avalée. Diagnostiquer à l'aveugle a coûté plusieurs cycles de compilation.
 *
 * Cette poignée n'est lue que par un humain qui enquête, via le débogage USB.
 * Elle n'expose rien que l'application n'ait déjà en mémoire.
 */
window.__elpis = {
  etat: () => useStore.getState(),
  rapport: () => useStore.getState().orchestratorData,
  moteurBranche: () => sourceExterne(),
  recalculer: (p) => calculerRapportLocal(p),
  // Le Repetiteur repond desormais sur l appareil : de quoi le verifier sans
  // avoir a taper dans le panneau, et sans que le PC soit joignable.
  repetiteur: (question) => consulterLocal(question),
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
