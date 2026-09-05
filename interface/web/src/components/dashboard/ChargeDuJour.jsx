import { motion } from 'framer-motion';
import { Carte, Jauge, Pastille, TitreCarte } from '../ui';

/** `95` → `1h35`. */
function enHeures(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, '0')}`;
}

/**
 * Comparaison entre ce que la journée demande et ce que l'orchestrateur juge
 * tenable. Le verdict est écrit en toutes lettres : un pourcentage seul ne dit
 * pas s'il faut s'inquiéter.
 */
export default function ChargeDuJour({ tempsRequisMin, tempsDispoMin, surcharge, arriereMin, nbEnSouffrance, retardMaxJours }) {
  const pourcentage = Math.min(100, Math.round((tempsRequisMin / (tempsDispoMin || 1)) * 100));

  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: 0.05 }}>
      <Carte>
        <div className="tdb-charge__entete">
          <TitreCarte>Charge du jour</TitreCarte>
          {surcharge && <Pastille ton="danger">Révisions décrochées</Pastille>}
        </div>

        <div className="tdb-charge__mesures">
          <span>Prévu&nbsp;: <strong>{enHeures(tempsRequisMin)}</strong></span>
          <span>Tenable&nbsp;: <strong>{enHeures(tempsDispoMin)}</strong></span>
        </div>
        <Jauge
          valeur={pourcentage}
          ton={surcharge ? 'danger' : 'succes'}
          libelle={`Charge de la journée : ${pourcentage} % du temps tenable`}
        />

        <div className={`tdb-charge__verdict tdb-charge__verdict--${surcharge ? 'surcharge' : 'tenable'}`}>
          {surcharge ? (
            <>
              <strong>Des révisions ont décroché.</strong>{' '}
              {nbEnSouffrance > 0 && (
                <>
                  {nbEnSouffrance} cours {nbEnSouffrance > 1 ? 'attendent' : 'attend'} depuis plus du double
                  du délai prévu{retardMaxJours > 0 && <>, jusqu’à <strong>{retardMaxJours} jours</strong></>}
                  {arriereMin > 0 && <> — soit {enHeures(arriereMin)} à reprendre</>}.{' '}
                </>
              )}
              Un chapitre est repris chaque jour en priorité, sans alourdir ta journée.
            </>
          ) : (
            <><strong>Charge équilibrée.</strong> Le programme du jour tient dans le temps que tu t'es fixé.</>
          )}
        </div>
      </Carte>
    </motion.div>
  );
}
