import { resumerUE } from '../../utils/cursus';
import { BoutonIcone } from '../ui';
import useInputModal from '../../hooks/useInputModal';
import InputModal from '../InputModal';

/**
 * Navigation du cursus : licence → semestre → UE.
 *
 * Remplace trois rangées d'onglets empilées. Le contexte complet reste visible
 * en permanence : on voyait auparavant l'UE courante sans savoir de quel
 * semestre elle relevait sans remonter des yeux jusqu'à la ligne du dessus.
 *
 * Chaque nœud porte désormais ses actions. L'arbre n'offrait que « + Licence »,
 * « + Semestre » et « + UE » : une licence ajoutée par mégarde y restait pour
 * toujours, sans moyen de la renommer ni de l'effacer — les fonctions
 * existaient pourtant dans la page, simplement jamais reliées à un bouton.
 * Une interface qui sait créer et pas défaire fait payer très cher la moindre
 * fausse manœuvre.
 */
export default function ArbreCursus({
  licences,
  lIndex, sIndex, uIndex,
  onSelection,
  onAjouterLicence, onAjouterSemestre, onAjouterUE,
  onRenommerLicence, onRenommerSemestre, onRenommerUE,
  onSupprimerLicence, onSupprimerSemestre, onSupprimerUE,
}) {
  const licence = licences[lIndex];
  const semestres = licence?.semestres || [];

  // Une seule fenêtre de saisie pour tout l'arbre : trois niveaux de nœuds en
  // ouvriraient sinon une chacun, toutes montées en permanence.
  const { prompt, isOpen, config, handleConfirm, handleCancel } = useInputModal();

  const renommer = async (libelle, valeur, appliquer) => {
    if (!appliquer) return;
    const saisi = await prompt(libelle, valeur || '');
    if (saisi === null) return;
    const propre = saisi.trim();
    if (propre) appliquer(propre);
  };

  return (
    <nav className="arbre" aria-label="Navigation du cursus">
      {/* --- Licences --- */}
      <div className="arbre__section">
        <div className="el-surtitre arbre__entete">Licences</div>
        {licences.map((l, i) => {
          const nom = l.nom || 'Licence sans nom';
          return (
            <div className="arbre__rang" key={`lic-${i}`}>
              <button
                type="button"
                className={`arbre__noeud arbre__noeud--licence ${i === lIndex ? 'est-actif' : ''}`}
                aria-current={i === lIndex ? 'true' : undefined}
                onClick={() => onSelection(i, 0, 0)}
              >
                <span className="arbre__libelle">{nom}</span>
                <span className="arbre__compte el-mono">{compterMatieres(l)}</span>
              </button>
              <div className="arbre__actions">
                <BoutonIcone
                  libelle={`Renommer ${nom}`}
                  onClick={() => renommer('Nom de la licence :', l.nom, (v) => onRenommerLicence(i, v))}
                >✏️</BoutonIcone>
                <BoutonIcone
                  libelle={`Supprimer ${nom}`}
                  danger
                  onClick={() => onSupprimerLicence?.(i)}
                >🗑️</BoutonIcone>
              </div>
            </div>
          );
        })}
        <button type="button" className="arbre__ajout" onClick={onAjouterLicence}>+ Licence</button>
      </div>

      {/* --- Semestres et UE de la licence sélectionnée --- */}
      {licence && (
        <div className="arbre__section">
          <div className="el-surtitre arbre__entete">Semestres</div>

          {semestres.length === 0 && (
            <p className="arbre__vide">Aucun semestre</p>
          )}

          {semestres.map((sem, si) => {
            const ouvert = si === sIndex;
            const ues = sem.ues || [];
            const nomSem = sem.nom || `Semestre ${si + 1}`;
            return (
              <div key={`sem-${si}`}>
                <div className="arbre__rang">
                  <button
                    type="button"
                    className={`arbre__noeud arbre__noeud--semestre ${ouvert ? 'est-actif' : ''}`}
                    aria-current={ouvert ? 'true' : undefined}
                    aria-expanded={ouvert}
                    onClick={() => onSelection(lIndex, si, 0)}
                  >
                    <span className="arbre__chevron" aria-hidden="true">{ouvert ? '▾' : '▸'}</span>
                    <span className="arbre__libelle">
                      {nomSem}
                      {sem.archived && <span className="arbre__mention"> archivé</span>}
                    </span>
                  </button>
                  <div className="arbre__actions">
                    <BoutonIcone
                      libelle={`Renommer ${nomSem}`}
                      onClick={() => renommer('Nom du semestre :', sem.nom, (v) => onRenommerSemestre(lIndex, si, v))}
                    >✏️</BoutonIcone>
                    <BoutonIcone
                      libelle={`Supprimer ${nomSem}`}
                      danger
                      onClick={() => onSupprimerSemestre?.(lIndex, si)}
                    >🗑️</BoutonIcone>
                  </div>
                </div>

                {ouvert && (
                  <div className="arbre__enfants">
                    {ues.map((ue, ui) => {
                      const bilan = resumerUE(ue);
                      const nomUE = ue.nom || 'UE sans nom';
                      return (
                        <div className="arbre__rang" key={`ue-${ui}`}>
                          <button
                            type="button"
                            className={`arbre__noeud arbre__noeud--ue ${ui === uIndex ? 'est-actif' : ''}`}
                            aria-current={ui === uIndex ? 'true' : undefined}
                            onClick={() => onSelection(lIndex, si, ui)}
                          >
                            <span className="arbre__libelle">{nomUE}</span>
                            {/* L'avancement se lit sans ouvrir l'UE. */}
                            {bilan.avancement !== null && (
                              <span className="arbre__compte el-mono">{bilan.avancement}%</span>
                            )}
                          </button>
                          <div className="arbre__actions">
                            <BoutonIcone
                              libelle={`Renommer ${nomUE}`}
                              onClick={() => renommer("Nom de l'UE :", ue.nom, (v) => onRenommerUE(lIndex, si, ui, v))}
                            >✏️</BoutonIcone>
                            <BoutonIcone
                              libelle={`Supprimer ${nomUE}`}
                              danger
                              onClick={() => onSupprimerUE?.(lIndex, si, ui)}
                            >🗑️</BoutonIcone>
                          </div>
                        </div>
                      );
                    })}
                    {ues.length === 0 && <p className="arbre__vide">Aucune UE</p>}
                    <button type="button" className="arbre__ajout" onClick={() => onAjouterUE(lIndex, si)}>+ UE</button>
                  </div>
                )}
              </div>
            );
          })}

          <button type="button" className="arbre__ajout" onClick={() => onAjouterSemestre(lIndex)}>+ Semestre</button>
        </div>
      )}

      <InputModal
        isOpen={isOpen}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        title={config.title}
        defaultValue={config.defaultValue}
        placeholder={config.placeholder}
      />
    </nav>
  );
}

/** Nombre de matières d'une licence, affiché à côté de son nom. */
function compterMatieres(licence) {
  let n = 0;
  (licence?.semestres || []).forEach(s => (s.ues || []).forEach(u => { n += (u.matieres || []).length; }));
  return n;
}
