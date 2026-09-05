import { motion, AnimatePresence } from 'framer-motion';

/**
 * Écran d'accueil du premier lancement.
 *
 * Il s'appelait « Protocole d'Utilisation », s'ouvrait sur un panneau
 * d'avertissement et vouvoyait — alors que tout le reste de l'application
 * tutoie. Trois travers s'y ajoutaient :
 *
 *   - il décrivait une architecture qui n'existe plus : un cloud Render, un
 *     iPhone, et l'instruction de « demander à l'IA de faire un Commit & Push »
 *     après avoir ajouté un PDF. Rien de tout cela n'est vrai depuis que la
 *     synchronisation se fait d'appareil à appareil ;
 *   - il exigeait un engagement — « je m'engage à jouer le jeu » — avant même
 *     d'avoir rien montré ;
 *   - il expliquait le fonctionnement du logiciel, alors que la seule chose
 *     qu'un nouvel arrivant a besoin de comprendre au premier écran est
 *     *pourquoi* son honnêteté conditionne tout le reste.
 *
 * Ce qui subsiste tient en une idée : la répétition espacée ne fonctionne que
 * si l'auto-évaluation est sincère. Le reste s'apprend en s'en servant, et les
 * bulles d'aide sont là pour ça.
 */
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
          role="dialog"
          aria-modal="true"
          aria-labelledby="accueil-titre"
          initial={{ y: 50, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
        >
          <div className="disclaimer-header">
            <h2 id="accueil-titre">Bienvenue dans ELPIS</h2>
            <p className="disclaimer-accroche">
              ELPIS décide chaque jour de ce que tu dois réviser, à partir de ce que
              tu as réellement retenu. Une seule chose lui est indispensable.
            </p>
          </div>

          <div className="disclaimer-body custom-scrollbar-y">
            <div className="disclaimer-section">
              <h3>Ton évaluation doit être sincère</h3>
              <p>
                Après chaque révision, tu indiques si le cours était <em>oublié</em>,
                <em> difficile</em>, <em>correct</em> ou <em>évident</em>. Cette réponse
                n'est pas une note : c'est la mesure sur laquelle l'algorithme calcule
                le moment où tu seras sur le point d'oublier.
              </p>
              <p>
                Se surévaluer ne fait pas gagner de temps — cela repousse la révision
                au-delà de l'oubli, et le cours est à réapprendre depuis le début.
                Répondre <em>oublié</em> quand c'est le cas fait revenir la notion
                plus tôt : c'est plus court, pas plus long.
              </p>
            </div>

            <div className="disclaimer-section">
              <h3>La régularité prime sur la durée</h3>
              <p>
                Vingt minutes chaque jour valent mieux que trois heures le dimanche.
                Le calendrier des révisions se recalcule en continu ; si tu prends du
                retard, ELPIS réorganise plutôt que d'accumuler.
              </p>
            </div>

            <div className="disclaimer-section">
              <h3>Rien n'est définitif</h3>
              <p>
                Chaque élément se renomme et se supprime, et <kbd>Ctrl</kbd> +
                <kbd>Z</kbd> annule la dernière action. Explore sans crainte
                d'abîmer quelque chose.
              </p>
            </div>

            <p className="disclaimer-aide">
              Les repères marqués d'un <span aria-hidden="true">ℹ️</span> expliquent
              chaque indicateur. Reviens-y quand un chiffre te surprend.
            </p>
          </div>

          <div className="disclaimer-footer">
            <button className="btn-primary disclaimer-btn" onClick={onClose}>
              Commencer
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
