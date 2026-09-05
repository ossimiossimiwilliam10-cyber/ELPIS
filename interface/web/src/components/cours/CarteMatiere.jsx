import { resumerMatiere } from '../../utils/cursus';
import { Pastille, Jauge } from '../ui';

/** Format court d'une date de révision : « 20 sept. », « Aujourd'hui », « Demain ». */
function dateCourte(valeur) {
  if (!valeur) return null;
  const [a, m, j] = String(valeur).split('-').map(Number);
  if (!Number.isFinite(a)) return null;

  const cible = new Date(a, m - 1, j);
  const aujourdHui = new Date();
  aujourdHui.setHours(0, 0, 0, 0);

  const jours = Math.round((cible - aujourdHui) / 86400000);
  if (jours <= 0) return "Aujourd'hui";
  if (jours === 1) return 'Demain';
  return cible.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/**
 * Vignette d'une matière dans la grille d'une UE.
 *
 * Elle répond aux trois questions qu'on se pose en ouvrant la Bibliothèque :
 * qu'y a-t-il dedans, où j'en suis, et quand faut-il y revenir. Le détail
 * complet — cours, exercices, synergies, liens — s'ouvre à la demande.
 */
export default function CarteMatiere({ matiere, onOuvrir }) {
  const bilan = resumerMatiere(matiere);
  const revision = dateCourte(bilan.prochaineRevision);
  const urgente = revision === "Aujourd'hui" || revision === 'Demain';

  return (
    <button
      type="button"
      className="carte-matiere"
      onClick={onOuvrir}
      aria-label={`Ouvrir ${matiere.nom || 'la matière'}`}
    >
      <div className="carte-matiere__entete">
        <span className="carte-matiere__nom">{matiere.nom || 'Matière sans nom'}</span>
        {bilan.dispensee && <Pastille ton="succes">Dispensé</Pastille>}
        {bilan.dette && <Pastille ton="danger">Dette</Pastille>}
      </div>

      {/* Effectifs par type : chaque nombre garde la couleur de son activité. */}
      <div className="carte-matiere__effectifs">
        {[
          ['CM', bilan.parType.CM, 'cm'],
          ['TD', bilan.parType.TD, 'td'],
          ['TP', bilan.parType.TP, 'tp'],
          ['Annales', bilan.parType.ANNALE, 'annale'],
        ]
          .filter(([, n]) => n > 0)
          .map(([libelle, n, ton]) => (
            <span key={libelle} className={`carte-matiere__effectif est-${ton}`}>
              <b className="el-mono">{n}</b> {libelle}
            </span>
          ))}
        {bilan.total === 0 && <span className="el-texte--mention">Aucun contenu</span>}
      </div>

      {bilan.total > 0 && (
        <div className="carte-matiere__progression">
          <Jauge
            valeur={bilan.travailles}
            max={bilan.total}
            ton={bilan.avancement === 100 ? 'succes' : undefined}
            libelle={`Avancement de ${matiere.nom}`}
          />
          <span className="el-mono carte-matiere__pourcent">{bilan.avancement}%</span>
        </div>
      )}

      <div className="carte-matiere__pied">
        {bilan.moyenne !== null && (
          <span className="el-mono carte-matiere__moyenne">
            {bilan.moyenne.toFixed(1)}<span className="carte-matiere__sur">/20</span>
          </span>
        )}
        {bilan.defaillante && <Pastille ton="danger">Défaillant</Pastille>}
        {revision && (
          <span className={`carte-matiere__revision ${urgente ? 'est-urgente' : ''}`}>
            {urgente ? '⏰' : '📅'} {revision}
          </span>
        )}
      </div>
    </button>
  );
}
