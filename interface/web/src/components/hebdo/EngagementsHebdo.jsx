import { Bouton, BoutonIcone, Carte, Pile, Texte, TitreCarte } from '../ui';
import { dureeEngagementMin, formaterDuree, dureeSuspecte } from '../../utils/engagements';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche', 'Tous les jours'];

/**
 * Heures déjà prises dans la semaine : cours, TP encadrés, travail salarié.
 * L'orchestrateur les retire des disponibilités avant de planifier quoi que ce soit.
 */
export default function EngagementsHebdo({ engagements, matieres, onModifier, onAjouter, onSupprimer }) {
  return (
    <Carte>
      <TitreCarte>Engagements de la semaine</TitreCarte>
      <Texte doux petit>
        Tes heures déjà prises : cours, TP encadrés, travail. Elles sont retirées de tes
        disponibilités avant que le programme de révision ne soit construit.
      </Texte>

      <Pile espace="serre" style={{ marginTop: 'var(--esp-4)' }}>
        {engagements.length === 0 && (
          <Texte doux petit>
            Aucun engagement déclaré : toutes tes heures sont considérées comme libres.
          </Texte>
        )}

        {engagements.map((engagement, idx) => {
          const duree = dureeEngagementMin(engagement.start, engagement.end);
          const suspecte = dureeSuspecte(engagement.start, engagement.end);

          return (
            <div key={idx} className={`hebdo-engagement${suspecte ? ' est-suspecte' : ''}`}>
              <select
                className="el-champ"
                value={engagement.day}
                onChange={e => onModifier(idx, 'day', e.target.value)}
                aria-label={`Jour de l'engagement ${idx + 1}`}
              >
                {JOURS.map(j => <option key={j} value={j}>{j}</option>)}
              </select>

              <input
                type="time"
                className="el-champ"
                value={engagement.start || ''}
                onChange={e => onModifier(idx, 'start', e.target.value)}
                aria-label={`Heure de début de l'engagement ${idx + 1}`}
              />
              <span className="el-texte--mention">à</span>
              <input
                type="time"
                className="el-champ"
                value={engagement.end || ''}
                onChange={e => onModifier(idx, 'end', e.target.value)}
                aria-label={`Heure de fin de l'engagement ${idx + 1}`}
              />

              {/* Durée telle que l'orchestrateur la comprend : une fin antérieure
                  au début est lue comme un passage à minuit, ce qui transformait
                  une inversion accidentelle en engagement de 22 h, sans un mot. */}
              <span
                className={`hebdo-engagement__duree${suspecte ? ' est-suspecte' : ''}`}
                title={suspecte ? 'Durée inhabituelle — as-tu inversé le début et la fin ?' : 'Temps retiré de tes disponibilités'}
              >
                {suspecte && '⚠️ '}{formaterDuree(duree)}
              </span>

              <select
                className="el-champ hebdo-engagement__matiere"
                value={engagement.matiereLinked || ''}
                onChange={e => onModifier(idx, 'matiereLinked', e.target.value)}
                aria-label={`Matière liée à l'engagement ${idx + 1}`}
              >
                <option value="">Aucune matière en particulier</option>
                {matieres.map(m => <option key={m} value={m}>{m}</option>)}
              </select>

              <BoutonIcone
                danger
                libelle={`Supprimer l'engagement du ${engagement.day}`}
                onClick={() => onSupprimer(idx)}
              >
                ×
              </BoutonIcone>
            </div>
          );
        })}

        <div>
          <Bouton onClick={onAjouter}>+ Ajouter un Engagement</Bouton>
        </div>
      </Pile>
    </Carte>
  );
}
