import { motion, AnimatePresence } from 'framer-motion';

export default function DisclaimerModal({ onClose }) {
  return (
    <AnimatePresence>
      <motion.div
        className="disclaimer-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="disclaimer-content card glass-panel"
          initial={{ y: 50, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
        >
          <div className="disclaimer-header">
            <span className="disclaimer-icon">⚠️</span>
            <h2>Protocole d'Utilisation ELPIS</h2>
          </div>

          <div className="disclaimer-body custom-scrollbar-y">
            
            <div className="disclaimer-section">
              <h3>1. L'Algorithme est Roi (FSRS) 🧠</h3>
              <p>
                ELPIS repose sur la <strong>répétition espacée</strong>. L'algorithme calcule le moment précis où vous êtes sur le point d'oublier une information pour vous la faire réviser. 
              </p>
              <ul className="disclaimer-list">
                <li><strong>Soyez 100% honnête :</strong> Lors de l'évaluation (À revoir, Difficile, Bien, Parfait), ne trichez jamais. Si vous avez oublié, cliquez sur "À revoir".</li>
                <li><strong>Respectez le planning :</strong> Faites vos sessions tous les jours. L'algorithme perd de son efficacité si vous accumulez trop de retard.</li>
                <li><strong>Faites confiance au système :</strong> Ne révisez pas "en avance" sans raison, laissez ELPIS optimiser votre temps.</li>
              </ul>
            </div>

            <div className="disclaimer-section">
              <h3>2. Gestion des PDFs & Synchronisation (PC vs iPhone) 💻📱</h3>
              <p>
                L'application fonctionne en réseau entre votre ordinateur et le cloud (Render).
              </p>
              <ul className="disclaimer-list">
                <li><strong>Travaillez sur PC :</strong> Pour ajouter de nouveaux cours, uploader des PDFs ou configurer vos matières, privilégiez <strong>toujours l'ordinateur</strong> (en local).</li>
                <li><strong>Poussez les mises à jour :</strong> N'oubliez pas de demander à l'IA de faire un <strong>"Commit & Push"</strong> après avoir ajouté des PDFs locaux. Sans cela, ils n'apparaîtront jamais sur la version en ligne.</li>
                <li><strong>iPhone pour l'action :</strong> Gardez l'iPhone pour vos sessions de révision, lire vos PDFs déjà synchronisés, et valider vos tâches quotidiennes.</li>
              </ul>
            </div>

            <div className="disclaimer-alert">
              En respectant ces deux règles simples, vous garantissez l'efficacité de vos révisions et la stabilité de votre bibliothèque.
            </div>

          </div>

          <div className="disclaimer-footer">
            <button className="btn-primary disclaimer-btn" onClick={onClose}>
              J'ai compris, je m'engage à jouer le jeu 🚀
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
