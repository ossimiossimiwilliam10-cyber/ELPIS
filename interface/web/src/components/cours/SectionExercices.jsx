import EditableLabel from './EditableLabel';
import EditableNote from './EditableNote';
import { Bouton, BoutonIcone, couleurType } from '../ui';

/**
 * Une section de la fiche matière : cours, TD, TP ou annales.
 *
 * Ces quatre blocs étaient recopiés à l'identique dans la carte de matière,
 * à quelques champs près — 104 déclarations de style pour un seul fichier, et
 * autant d'occasions de les voir diverger. Le rendu propre à chaque type passe
 * désormais par `rendreDetails`.
 */
export default function SectionExercices({
  type,
  libelle,
  items,
  onAjouter,
  onScanner,
  onSupprimer,
  onRenommer,
  onEditerNotes,
  onAjouterDocument,
  documentsDe,
  onSupprimerDocument,
  rendreDetails,
  libelleAjout = '+ Ajouter',
}) {
  const couleur = couleurType(type);

  return (
    <section className="section-exercices" style={{ '--liseré': couleur }}>
      <header className="section-exercices__entete">
        <h4 className="section-exercices__titre">
          <span className="el-mono section-exercices__compte">{items.length}</span> {libelle}
        </h4>
        <div className="el-rang el-rang--serre">
          <Bouton onClick={onAjouter}>{libelleAjout}</Bouton>
          {onScanner && <Bouton onClick={onScanner} title="Extraire les exercices d'un PDF">📄 Scanner</Bouton>}
        </div>
      </header>

      {items.length === 0 ? (
        <p className="section-exercices__vide">Aucun élément pour l'instant.</p>
      ) : (
        <ul className="section-exercices__liste">
          {items.map((item, index) => {
            const documents = documentsDe ? documentsDe(item) : [];
            return (
              <li key={`${type}-${index}`} className="ligne-exercice">
                <div className="ligne-exercice__principal">
                  <BoutonIcone
                    libelle={`Supprimer ${item.titre || 'cet élément'}`}
                    danger
                    onClick={() => onSupprimer(index)}
                  >
                    ✕
                  </BoutonIcone>

                  <div className="ligne-exercice__contenu">
                    <EditableLabel
                      value={item.titre}
                      onRename={(valeur) => onRenommer(index, valeur)}
                      placeholder={`Titre ${libelle.toLowerCase()}`}
                      style={{ fontSize: 'var(--texte-sm)', fontWeight: 'var(--graisse-moyenne)' }}
                    />

                    {rendreDetails && rendreDetails(item, index)}

                    <EditableNote
                      value={item.notes}
                      onClick={() => onEditerNotes(index, item)}
                      placeholder="+ Ajouter une note"
                    />
                  </div>

                  <BoutonIcone
                    libelle={`Joindre un document à ${item.titre || 'cet élément'}`}
                    onClick={() => onAjouterDocument(index, documents)}
                  >
                    ➕
                  </BoutonIcone>
                </div>

                {documents.length > 0 && (
                  <div className="ligne-exercice__documents">
                    {documents.map((url, di) => (
                      <span key={di} className="document">
                        <a href={url} target="_blank" rel="noopener noreferrer" className="document__lien">
                          Document {di + 1}
                        </a>
                        <button
                          type="button"
                          className="document__retirer"
                          onClick={() => onSupprimerDocument(index, di, url, documents)}
                          aria-label={`Retirer le document ${di + 1}`}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
