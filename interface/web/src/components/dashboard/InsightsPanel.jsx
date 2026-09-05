import { motion } from 'framer-motion';
import { Carte, Pastille, TitreCarte } from '../ui';

/**
 * Ce que le planificateur a remarqué : fatigue, matières qui résistent,
 * répartition des efforts dans la journée.
 */

/** Un constat, avec son ton et son explication. */
function Constat({ ton, titre, children }) {
  return (
    <div className={`constat constat--${ton}`}>
      <div className="constat__titre">{titre}</div>
      <div className="constat__corps">{children}</div>
    </div>
  );
}

/** Liste de matières, tronquée au-delà de cinq — le reste est annoncé. */
function ListeMatieres({ matieres, limite = 5 }) {
  const visibles = matieres.slice(0, limite);
  const reste = matieres.length - visibles.length;
  return (
    <div className="constat__etiquettes">
      {visibles.map(n => <Pastille key={n}>{n}</Pastille>)}
      {reste > 0 && <Pastille>+ {reste} autres</Pastille>}
    </div>
  );
}

const RISQUE = {
  high: { ton: 'danger', titre: 'Risque de surmenage élevé' },
  medium: { ton: 'attention', titre: 'Signes de fatigue' },
  low: { ton: 'info', titre: 'Sommeil perturbé' },
};

/** Intitulé propre à chaque signal relevé par la veille anti-épuisement. */
const SIGNAL = {
  'serie-tres-longue': { ton: 'danger', titre: 'Trop longtemps sans pause' },
  'serie-chargee': { ton: 'danger', titre: 'Série longue et chargée' },
  'serie-longue': { ton: 'attention', titre: 'Série de travail continue' },
  'charge-lourde': { ton: 'attention', titre: 'Journées très chargées' },
  'seances-tardives': { ton: 'info', titre: 'Séances tardives' },
};

export default function InsightsPanel({ intelligence }) {
  if (!intelligence) return null;

  const risque = intelligence.burnoutRisk;
  const niveau = risque && risque.riskLevel !== 'none' ? RISQUE[risque.riskLevel] : null;
  const signaux = Array.isArray(risque?.signaux) ? risque.signaux : [];

  const lentes = Object.entries(intelligence.velocityMap || {}).filter(([, v]) => v.isSlowLearner);

  const charge = Object.entries(intelligence.cognitiveLoadMap || {});
  const lourdes = charge.filter(([, v]) => v.cognitiveLoad === 'heavy').map(([n]) => n);
  const legeres = charge.filter(([, v]) => v.cognitiveLoad === 'light').map(([n]) => n);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      style={{ marginTop: 'var(--esp-6)' }}
    >
      <Carte>
        <TitreCarte>Ce que le planificateur observe</TitreCarte>

        <div className="constats">
          {/* Chaque signal relevé a sa propre carte : la veille en remonte
              plusieurs à la fois, et le plus grave masquait les autres — dont
              celui sur lequel il est le plus simple d'agir. */}
          {signaux.length > 0
            ? signaux.map(s => {
              const style = SIGNAL[s.cle] || { ton: 'attention', titre: 'Point de vigilance' };
              return <Constat key={s.cle} ton={style.ton} titre={style.titre}>{s.texte}</Constat>;
            })
            : niveau && (
              <Constat ton={niveau.ton} titre={niveau.titre}>
                {risque.reason}
              </Constat>
            )}

          {risque?.riskLevel === 'none' && (
            <Constat ton="succes" titre="Rythme soutenable">
              {risque.daysWithoutRest} jours sans repos,
              {' '}{Math.round((risque.avgDailyMinutes / 60) * 10) / 10} h de travail par jour en moyenne.
            </Constat>
          )}

          {lentes.length > 0 && (
            <Constat ton="attention" titre="Matières qui demandent plus de passages">
              {lentes.map(([nom, v]) => (
                <div key={nom} className="constat__ligne">
                  <strong>{nom}</strong> — {v.avgSessionsToMaster?.toFixed(1)} séances par cours en moyenne,
                  {' '}{v.masteredCMs} sur {v.totalCMs} maîtrisés,
                  {' '}environ {Math.round(v.estimatedRemainingMinutes / 60)} h restantes.
                </div>
              ))}
            </Constat>
          )}

          {(lourdes.length > 0 || legeres.length > 0) && (
            <Constat ton="accent" titre="Répartition dans la journée">
              {lourdes.length > 0 && (
                <div className="constat__ligne">
                  <strong>Le matin</strong>, quand la concentration est haute :
                  <ListeMatieres matieres={lourdes} />
                </div>
              )}
              {legeres.length > 0 && (
                <div className="constat__ligne">
                  <strong>Le soir</strong>, pour finir en douceur :
                  <ListeMatieres matieres={legeres} />
                </div>
              )}
            </Constat>
          )}
        </div>
      </Carte>
    </motion.div>
  );
}
