import { motion } from 'framer-motion';
import { Carte, Jauge, Pastille, TitreCarte, Texte } from '../ui';

/**
 * Progression par paliers et engagement de la semaine.
 *
 * L'application affichait auparavant une note visée et un rang visé — des
 * résultats lointains, atteints ou non. Tant qu'ils ne le sont pas, c'est-à-dire
 * presque toujours, l'étudiant se voit en échec. Ces paliers décrivent au
 * contraire l'état du travail : ils se franchissent en une à trois semaines, ne
 * dépendent d'aucune note, et rendent la progression visible bien avant que les
 * résultats ne tombent.
 */
export default function Progression({ objectifs }) {
  if (!objectifs) return null;

  const { engagements, progression, cap, budget } = objectifs;
  const palier = progression.enCours;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      style={{ marginTop: 'var(--esp-6)' }}
    >
      <Carte>
        <div className="prog-entete">
          <TitreCarte>Ta progression</TitreCarte>
          <Pastille ton="accent">{cap.libelle}</Pastille>
        </div>
        <Texte doux petit>{cap.intention}</Texte>

        <div className="prog-corps">
          {/* --- La semaine en cours --- */}
          <div className="prog-semaine">
            <div className="prog-semaine__entete">
              <span className="prog-semaine__titre">Cette semaine</span>
              <span className={`prog-semaine__compte${engagements.reussie ? ' est-tenue' : ''}`}>
                {engagements.joursTenus} / {engagements.joursVises} jours
              </span>
            </div>
            <Jauge
              valeur={engagements.joursTenus}
              max={engagements.joursVises}
              ton={engagements.reussie ? 'succes' : undefined}
              libelle={`Engagement de la semaine : ${engagements.joursTenus} jours sur ${engagements.joursVises}`}
            />
            <div className="prog-semaine__aide">
              {engagements.reussie
                ? 'Engagement tenu. C\'est la régularité qui construit la mémoire, pas le volume.'
                : `Encore ${engagements.joursVises - engagements.joursTenus} jour${engagements.joursVises - engagements.joursTenus > 1 ? 's' : ''} pour tenir ton engagement.`}
            </div>
          </div>

          {/* --- Le palier en cours --- */}
          {palier ? (
            <div className="prog-palier">
              <div className="prog-palier__rang">
                Palier {progression.franchis + 1} sur {progression.total}
              </div>
              <div className="prog-palier__titre">{palier.titre}</div>
              <div className="prog-palier__critere">{palier.critere}</div>
              <Jauge
                valeur={palier.valeur}
                max={palier.cible}
                libelle={`${palier.titre} : ${palier.valeur} sur ${palier.cible}`}
              />
              <div className="prog-palier__mesure">{palier.valeur} / {palier.cible}</div>
            </div>
          ) : (
            <div className="prog-palier est-complete">
              <div className="prog-palier__titre">Tous les paliers sont franchis</div>
              <div className="prog-palier__critere">
                Le système est en place. C'est le moment de relever ton régime de travail
                ou d'élargir ce que tu couvres.
              </div>
            </div>
          )}
        </div>

        <div className="prog-budget">
          Ta journée type : <strong>{budget.decouverte} min</strong> de nouveaux cours,
          {' '}<strong>{budget.entretien} min</strong> de révisions,
          {' '}<strong>{budget.entrainement} min</strong> d'exercices.
        </div>
      </Carte>
    </motion.div>
  );
}
