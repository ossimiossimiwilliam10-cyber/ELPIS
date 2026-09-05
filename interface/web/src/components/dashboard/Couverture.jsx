import { motion } from 'framer-motion';
import { Carte, Jauge, Pastille, TitreCarte, Texte } from '../ui';

/**
 * Couverture du programme avant échéance.
 *
 * Une matière peut être bien travaillée et rester perdue d'avance : si le
 * rythme de découverte ne permet pas d'atteindre le dernier chapitre avant
 * l'épreuve, aucune qualité de révision n'y changera rien. C'est le genre de
 * chose qu'on constate en décembre, quand il ne reste plus de marge — d'où
 * l'intérêt de le dire dès octobre.
 */

const ETATS = {
  'hors-delai': { ton: 'danger', libelle: 'Hors délai' },
  tendu: { ton: 'attention', libelle: 'Tendu' },
  tenable: { ton: 'succes', libelle: 'Tenable' },
  couvert: { ton: 'succes', libelle: 'Programme couvert' },
};

export default function Couverture({ couverture }) {
  if (!couverture) return null;

  const projetees = couverture.matieres.filter(m => m.tension !== null);
  if (projetees.length === 0) return null;

  // Ce qui va bien n'appelle aucune décision : seules les matières sous
  // tension méritent d'occuper le tableau de bord.
  const aSurveiller = projetees.filter(m => m.etat === 'hors-delai' || m.etat === 'tendu');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.25 }}
      style={{ marginTop: 'var(--esp-6)' }}
    >
      <Carte>
        <TitreCarte>Le programme tiendra-t-il ?</TitreCarte>

        {aSurveiller.length === 0 ? (
          <Texte doux petit>
            Toutes tes matières peuvent être couvertes avant leur échéance, au
            rythme de découverte que tu t'es fixé ({couverture.budgetDecouverteMin} min par jour).
          </Texte>
        ) : (
          <>
            <Texte doux petit>
              Chapitres jamais ouverts, comparés au temps qu'il reste pour les
              aborder — {couverture.budgetDecouverteMin} min de découverte par jour, partagées
              entre les matières concernées.
            </Texte>

            <div className="couv-liste">
              {aSurveiller.map(m => {
                const etat = ETATS[m.etat] || ETATS.tendu;
                return (
                  <div key={m.nom} className={`couv-ligne est-${m.etat}`}>
                    <div className="couv-ligne__identite">
                      <span className="couv-ligne__nom">{m.nom}</span>
                      <Pastille ton={etat.ton}>{etat.libelle}</Pastille>
                    </div>

                    <Jauge
                      valeur={Math.min(m.joursNecessaires, m.joursRestants * 1.5)}
                      max={Math.max(m.joursRestants, 1) * 1.5}
                      ton={etat.ton}
                      libelle={`${m.nom} : ${m.joursNecessaires} jours nécessaires pour ${m.joursRestants} restants`}
                    />

                    <div className="couv-ligne__mesure">
                      <b>{m.restants}</b> chapitres à ouvrir ·
                      {' '}<b>{m.joursNecessaires} j</b> nécessaires pour <b>{m.joursRestants} j</b> restants
                      {m.sourceEcheance === 'semestre' && ' — d\'ici la fin du semestre'}
                    </div>
                  </div>
                );
              })}
            </div>

            {couverture.laPlusMenacee && (
              <div className="couv-verdict">{couverture.laPlusMenacee.message}</div>
            )}
          </>
        )}
      </Carte>
    </motion.div>
  );
}
