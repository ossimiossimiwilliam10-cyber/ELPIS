import { motion } from 'framer-motion';
import { Carte, Jauge, Pastille, TitreCarte, Texte } from '../ui';

/**
 * Vitesse de résolution rapportée à la durée réelle des épreuves.
 *
 * Une part de l'écart entre une bonne note et une très bonne note ne tient pas
 * à ce qu'on sait, mais au temps qu'on met à le restituer. Rendre un sujet aux
 * deux tiers plafonne mécaniquement la note, quelle que soit la maîtrise — et
 * cela ne se découvre qu'à l'épreuve, quand il est trop tard.
 *
 * L'application chronomètre déjà chaque exercice et connaît la durée officielle
 * de chaque épreuve : le rapprochement des deux donne un diagnostic qu'aucun
 * enseignant ne fournit.
 */

const ETATS = {
  critique: { ton: 'danger', libelle: 'Trop lent' },
  juste: { ton: 'attention', libelle: 'Sans marge' },
  confortable: { ton: 'succes', libelle: 'Dans les temps' },
  inconnu: { ton: null, libelle: 'À mesurer' },
};

export default function VitesseExamen({ vitesse }) {
  if (!vitesse || vitesse.matieres.length === 0) return null;

  const mesurees = vitesse.matieres.filter(m => m.ratio !== null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      style={{ marginTop: 'var(--esp-6)' }}
    >
      <Carte>
        <TitreCarte>Ta vitesse en conditions d'examen</TitreCarte>

        {mesurees.length === 0 ? (
          <Texte doux petit>
            Chronomètre tes annales et tes TD : l'application pourra alors te dire
            si tu termines les sujets dans le temps imparti. C'est ce qui sépare
            le plus souvent une bonne note d'une très bonne.
          </Texte>
        ) : (
          <>
            <Texte doux petit>
              Temps qu'il te faudrait pour un sujet complet, comparé à la durée
              réelle de l'épreuve.
            </Texte>

            <div className="vitesse-liste">
              {mesurees.map(m => {
                const etat = ETATS[m.etat] || ETATS.inconnu;
                return (
                  <div key={m.nom} className={`vitesse-ligne est-${m.etat}`}>
                    <div className="vitesse-ligne__identite">
                      <span className="vitesse-ligne__nom">{m.nom}</span>
                      <Pastille ton={etat.ton}>{etat.libelle}</Pastille>
                      {!m.fiable && <span className="vitesse-ligne__reserve">une seule mesure</span>}
                    </div>

                    <Jauge
                      valeur={Math.min(m.ratio, 1.5) * 100}
                      max={150}
                      ton={etat.ton}
                      libelle={`${m.nom} : ${m.besoin} minutes nécessaires pour ${m.duree} accordées`}
                    />

                    <div className="vitesse-ligne__mesure">
                      <b>{m.besoin} min</b> pour <b>{m.duree} min</b> accordées
                      {m.source === 'td' && ' — estimé sur tes TD, faute d\'annale chronométrée'}
                    </div>
                  </div>
                );
              })}
            </div>

            {vitesse.laPlusTendue && (
              <div className="vitesse-verdict">
                {vitesse.laPlusTendue.message}
              </div>
            )}
          </>
        )}
      </Carte>
    </motion.div>
  );
}
