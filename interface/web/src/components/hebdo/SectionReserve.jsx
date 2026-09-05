import { motion, AnimatePresence } from 'framer-motion';
import ExerciceRow from '../cours/ExerciceRow';
import { Bouton } from '../ui';

/**
 * Une réserve d'exercices d'un type donné pour une matière.
 *
 * Les trois blocs TD / TP / Annales étaient recopiés à l'identique, chacun avec
 * sa propre grappe de styles écrits à la main : toute correction devait être
 * appliquée trois fois, et ne l'était pas toujours.
 */
export default function SectionReserve({
  type,
  intitule,
  libelleAjout,
  exercices,
  enReserve,
  cible,
  manquants,
  onAjouter,
  onModifier,
  onSupprimer,
  onEnvoyerPdf,
  onEditerNotes,
}) {
  // Seuls les exercices jamais pratiqués constituent la réserve.
  const disponibles = exercices
    .map((ex, i) => ({ ex, i }))
    .filter(({ ex }) => (ex.nombrePratiques || 0) === 0);

  return (
    <div className="hebdo-reserve">
      <div className="hebdo-reserve__entete">
        <div>
          <div className="hebdo-reserve__intitule">{intitule}</div>
          <div className="hebdo-reserve__compte">
            <b>{enReserve}/{cible}</b>
            {manquants > 0 && <span className="hebdo-reserve__manque"> · {manquants} manquant{manquants > 1 ? 's' : ''}</span>}
          </div>
        </div>
        {manquants > 0
          ? <Bouton onClick={onAjouter}>{libelleAjout}</Bouton>
          : <span className="hebdo-reserve__ok">Réserve complète</span>}
      </div>

      <AnimatePresence>
        {disponibles.map(({ ex, i }) => (
          <motion.div
            key={`${type}-${i}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <ExerciceRow
              exercice={ex}
              type={type}
              onUpdate={(champ, valeur) => onModifier(i, champ, valeur)}
              onDelete={() => onSupprimer(i, ex.titre)}
              onUploadPdf={() => onEnvoyerPdf(i)}
              onEditNotes={() => onEditerNotes(i, ex)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
