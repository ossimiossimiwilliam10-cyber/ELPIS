import { useState } from 'react';
import EditableLabel from './EditableLabel';
import ConfirmModal from '../ConfirmModal';
import StarRating from './StarRating';
import InfoTooltip from '../InfoTooltip';
import SectionExercices from './SectionExercices';
import SelecteurDeck from './SelecteurDeck';
import { getApiUrl } from '../../utils/apiConfig';
import { useToast } from '../../ToastProvider';
import logger from '../../utils/logger';
import { Carte, Pastille, Bouton, Champ, Selection, Texte } from '../ui';

/** Au-delà, l'envoi échoue côté serveur après une longue attente sans explication. */
const TAILLE_MAX_OCTETS = 50 * 1024 * 1024;

/** Extrait « AAAA-MM-JJ » d'une date, quel que soit son format d'origine. */
const versChampDate = (valeur) => {
  if (!valeur || typeof valeur !== 'string') return '';
  if (valeur.includes('/')) {
    const parts = valeur.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return valeur.substring(0, 10);
};

/** Tous les documents liés à un élément, l'ancien champ unique inclus. */
const documentsDe = (item) => {
  const liste = [...(item?.pdfPaths || [])];
  if (item?.pdfPath && !liste.includes(item.pdfPath)) liste.unshift(item.pdfPath);
  return liste;
};

export default function MatiereCard({ matiere, allMatiereNames, ankiDecks = [], lIndex, sIndex, uIndex, mIndex, actions }) {
  const {
    deleteMatiere, updateField,
    addCM, deleteCM, addTDManuel, deleteTD, addTPManuel, deleteTP,
    addAnnaleManuel, deleteAnnale,
    setModalConfig, getNextReviewDate, mutateAndSave,
  } = actions;

  const { toast } = useToast();
  const [confirmation, setConfirmation] = useState(null);

  /** Chemin d'un champ de la matière dans l'arborescence du cursus. */
  const chemin = (...suite) => ['licences', lIndex, 'semestres', sIndex, 'ues', uIndex, 'matieres', mIndex, ...suite];

  // ---------------------------------------------------------------- Fichiers

  const fichierAcceptable = (fichier) => {
    const estPdf = fichier.type === 'application/pdf' || fichier.name.toLowerCase().endsWith('.pdf');
    const estImage = fichier.type.startsWith('image/');
    if (!estPdf && !estImage) {
      toast.error(`« ${fichier.name} » n'est ni un PDF ni une image.`);
      return false;
    }
    if (fichier.size > TAILLE_MAX_OCTETS) {
      toast.error(`« ${fichier.name} » dépasse 50 Mo.`);
      return false;
    }
    return true;
  };

  const envoyerFichier = async (fichier) => {
    const donnees = new FormData();
    donnees.append('pdf', fichier);
    try {
      const res = await fetch(`${getApiUrl()}/upload/pdf`, { method: 'POST', body: donnees });
      const data = await res.json();
      if (data.success) return data;
      toast.error(`Envoi de « ${fichier.name} » refusé : ${data.error || 'raison inconnue'}`);
    } catch (err) {
      // Les alert() bloquaient l'interface et détonnaient avec le reste de l'app.
      logger.error("Erreur réseau lors de l'envoi :", err);
      toast.error(`Serveur injoignable pour « ${fichier.name} ».`);
    }
    return null;
  };

  /** Ouvre un sélecteur de fichiers et joint les documents retenus. */
  const joindreDocuments = (cheminPdfPaths, documentsActuels) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/*';
    input.multiple = true;

    input.onchange = async (e) => {
      const fichiers = Array.from(e.target.files || []).filter(fichierAcceptable);
      if (fichiers.length === 0) return;

      const resultats = await Promise.all(fichiers.map(envoyerFichier));
      const urls = resultats.filter(Boolean).map(d => d.url);
      if (urls.length === 0) return;

      updateField(cheminPdfPaths, [...(documentsActuels || []), ...urls]);
      toast.success(`${urls.length} document${urls.length > 1 ? 's' : ''} lié${urls.length > 1 ? 's' : ''}.`);
    };
    input.click();
  };

  /** Envoie un PDF et propose d'en extraire les exercices détectés. */
  const scannerDocument = (cleListe, cheminListe) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';

    input.onchange = async (e) => {
      const fichier = e.target.files?.[0];
      if (!fichier || !fichierAcceptable(fichier)) return;

      const data = await envoyerFichier(fichier);
      if (!data) return;

      const detectes = data.suggestedExercises || [];
      // Sans ce cas, le fichier partait bien mais rien ne le disait : le clic
      // paraissait sans effet.
      if (detectes.length === 0) {
        toast.info("Document envoyé, mais aucun exercice n'a pu en être extrait. Ajoute-les à la main puis lie ce document.");
        return;
      }

      const apercu = detectes.slice(0, 10).map(t => `- ${t}`).join('\n');
      const reste = detectes.length > 10 ? `\n… et ${detectes.length - 10} autres` : '';

      setConfirmation({
        type: 'scan',
        message: `${detectes.length} exercice${detectes.length > 1 ? 's ont' : ' a'} été détecté${detectes.length > 1 ? 's' : ''} :\n${apercu}${reste}\n\nLes ajouter à la liste ?`,
        onConfirm: () => {
          const existants = [...(matiere[cleListe] || [])];
          detectes.forEach(titre => existants.push({
            titre, dernierePratique: '', nombrePratiques: 0, notes: '',
            dateAjout: new Date().toISOString(), pdfPath: data.url,
          }));
          updateField(cheminListe, existants);
          toast.success(`${detectes.length} exercice${detectes.length > 1 ? 's ajoutés' : ' ajouté'}.`);
        },
      });
    };
    input.click();
  };

  /** Retire un document de la liste, et l'ancien champ unique le cas échéant. */
  const retirerDocument = (cleListe, index, indexDoc, url, documents) => {
    setConfirmation({
      type: 'document',
      message: 'Retirer ce document de la fiche ?',
      onConfirm: () => {
        updateField(chemin(cleListe, index, 'pdfPaths'), documents.filter((_, i) => i !== indexDoc));
        if (url === matiere[cleListe]?.[index]?.pdfPath) {
          updateField(chemin(cleListe, index, 'pdfPath'), '');
        }
      },
    });
  };

  /** Réglages communs d'une section, pour éviter de les répéter quatre fois. */
  const reglagesSection = (cleListe, typeLabel) => ({
    items: matiere[cleListe] || [],
    onSupprimer: (i) => ({
      listeCM: deleteCM, listeTD: deleteTD, listeTP: deleteTP, listeAnnales: deleteAnnale,
    }[cleListe])(lIndex, sIndex, uIndex, mIndex, i),
    onRenommer: (i, valeur) => updateField(chemin(cleListe, i, 'titre'), valeur),
    onEditerNotes: (i, item) => setModalConfig({
      isOpen: true,
      title: `Notes ${typeLabel} : ${item.titre}`,
      initialValue: item.notes,
      onSave: (v) => updateField(chemin(cleListe, i, 'notes'), v),
    }),
    onAjouterDocument: (i, documents) => joindreDocuments(chemin(cleListe, i, 'pdfPaths'), documents),
    documentsDe,
    onSupprimerDocument: (i, di, url, documents) => retirerDocument(cleListe, i, di, url, documents),
  });

  /** Champ de date d'un élément, avec son intitulé. */
  const champDate = (cleListe, index, champ, valeur) => (
    <label className="ligne-exercice__date">
      <span>Début</span>
      <input
        type="date"
        className="el-champ"
        value={versChampDate(valeur)}
        onChange={(e) => updateField(chemin(cleListe, index, champ), e.target.value)}
      />
    </label>
  );

  return (
    <Carte className="fiche-matiere">
      {/* ---------- En-tête ---------- */}
      <header className="fiche-matiere__entete">
        <EditableLabel
          value={matiere.nom}
          onRename={(v) => updateField(chemin('nom'), v)}
          placeholder="Nom de la matière"
          style={{ fontSize: 'var(--texte-xl)', fontWeight: 'var(--graisse-forte)', flex: 1 }}
        />

        <div className="el-rang el-rang--serre">
          <Bouton
            variante={matiere.dispense ? 'primaire' : 'secondaire'}
            onClick={() => updateField(chemin('dispense'), !matiere.dispense)}
            title="Validation d'acquis : la matière ne compte plus dans la moyenne"
          >
            {matiere.dispense ? '🎓 Dispensé' : 'Dispense'}
          </Bouton>

          {!matiere.dispense && (
            <Bouton
              variante={matiere.dette ? 'danger' : 'secondaire'}
              onClick={() => updateField(chemin('dette'), !matiere.dette)}
              title="Matière à repasser : priorité rehaussée dans le planning"
            >
              {matiere.dette ? '⚠️ En dette' : 'Dette'}
            </Bouton>
          )}

          <Bouton variante="fantome" onClick={() => deleteMatiere(lIndex, sIndex, uIndex, mIndex)} title="Supprimer la matière">
            🗑️
          </Bouton>
        </div>
      </header>

      {/* ---------- Ressources et liens ---------- */}
      <div className="fiche-matiere__reglages">
        <Champ
          id={`notebook-${mIndex}`}
          label="📖 Lien NotebookLM"
          type="url"
          placeholder="https://notebooklm.google.com/…"
          value={matiere.notebookLMLink || ''}
          onChange={(e) => updateField(chemin('notebookLMLink'), e.target.value)}
        />

        <Selection
          id={`anki-${mIndex}`}
          label="🃏 Deck Anki lié"
          value={matiere.ankiDeckName || ''}
          onChange={(e) => updateField(chemin('ankiDeckName'), e.target.value)}
        >
          <option value="">Aucun deck lié</option>
          {ankiDecks.map(d => <option key={d} value={d}>{d}</option>)}
        </Selection>
      </div>

      {/* ---------- Synergies ---------- */}
      <div className="fiche-matiere__synergies">
        <div className="el-etiquette">
          <InfoTooltip content="Lier deux matières crée des ponts cognitifs. Le planificateur tentera des séances mixtes pour stimuler la mémorisation transversale." width={260}>
            🔗 Matières liées ℹ️
          </InfoTooltip>
        </div>

        <div className="el-rang el-rang--serre">
          {(allMatiereNames || []).filter(nom => nom !== matiere.nom).map(nom => {
            const choisie = matiere.synergies?.includes(nom);
            return (
              <button
                key={nom}
                type="button"
                className={`synergie${choisie ? ' est-choisie' : ''}`}
                aria-pressed={choisie}
                onClick={() => {
                  const actuelles = matiere.synergies || [];
                  updateField(chemin('synergies'), choisie
                    ? actuelles.filter(n => n !== nom)
                    : [...actuelles, nom]);
                }}
              >
                {nom}
              </button>
            );
          })}
          {(!allMatiereNames || allMatiereNames.length <= 1) && (
            <Texte doux petit style={{ fontStyle: 'italic' }}>Ajoute d'autres matières pour créer des liens.</Texte>
          )}
        </div>
      </div>

      {/* ---------- Cours ---------- */}
      <SectionExercices
        type="CM"
        libelle="Cours"
        libelleAjout="+ Cours"
        onAjouter={() => addCM(lIndex, sIndex, uIndex, mIndex)}
        {...reglagesSection('listeCM', 'CM')}
        rendreDetails={(cm, index) => (
          <div className="ligne-exercice__details">
            {champDate('listeCM', index, 'dateCM', cm.dateCM)}

            {/* Rattachement explicite : c'est lui qui permet à l'épreuve de
                n'interroger que les cartes du chapitre effectivement traité. */}
            <SelecteurDeck
              valeur={cm.ankiDeck}
              portee={matiere.ankiDeckName}
              onChanger={(deck) => mutateAndSave(draft => {
                draft.licences[lIndex].semestres[sIndex].ues[uIndex]
                  .matieres[mIndex].listeCM[index].ankiDeck = deck;
              })}
            />

            <span className="el-texte--mention">
              Revu <b className="el-mono">{cm.repetitions || 0}</b> fois · prochain : <b>{getNextReviewDate(cm)}</b>
            </span>

            <label className="ligne-exercice__intervalle">
              <span>Intervalle</span>
              <input
                type="number"
                min="0"
                className="el-champ"
                defaultValue={cm.jActuel || 0}
                title="Nombre de jours avant la prochaine révision"
                // Enregistrement à la sortie du champ : saisir « 15 » à chaque
                // frappe déclenchait deux écritures en base.
                onBlur={(e) => {
                  const jours = Math.max(0, parseInt(e.target.value, 10) || 0);
                  if (jours === (cm.jActuel || 0)) return;
                  mutateAndSave(draft => {
                    const cible = draft.licences[lIndex].semestres[sIndex].ues[uIndex].matieres[mIndex].listeCM[index];
                    cible.jActuel = jours;
                    cible.prochaineRevisionDate = null;
                    if (jours > 0 && !cible.derniereRevision) {
                      const d = new Date();
                      d.setHours(d.getHours() - 4);
                      cible.derniereRevision = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    }
                  });
                }}
              />
            </label>

            <span className="el-texte--mention" title="Facteur de facilité calculé par FSRS">
              EF <b className="el-mono">{cm.easeFactor != null ? cm.easeFactor.toFixed(1) : '2.5'}</b>
            </span>
          </div>
        )}
      />

      {/* ---------- Travaux dirigés ---------- */}
      <SectionExercices
        type="TD"
        libelle="TD"
        libelleAjout="+ TD"
        onAjouter={() => addTDManuel(lIndex, sIndex, uIndex, mIndex)}
        onScanner={() => scannerDocument('listeTD', chemin('listeTD'))}
        {...reglagesSection('listeTD', 'TD')}
        rendreDetails={(td, index) => (
          <div className="ligne-exercice__details">
            {champDate('listeTD', index, 'datePrevue', td.datePrevue)}
            <StarRating
              value={td.difficulteInitiale || 1}
              onChange={(v) => updateField(chemin('listeTD', index, 'difficulteInitiale'), v)}
              tooltip="Difficulté : plus d'étoiles, plus le planificateur le proposera souvent"
            />
          </div>
        )}
      />

      {/* ---------- Travaux pratiques ---------- */}
      <SectionExercices
        type="TP"
        libelle="TP"
        libelleAjout="+ TP"
        onAjouter={() => addTPManuel(lIndex, sIndex, uIndex, mIndex)}
        {...reglagesSection('listeTP', 'TP')}
        rendreDetails={(tp, index) => (
          <div className="ligne-exercice__details">
            {champDate('listeTP', index, 'dateTP', tp.dateTP)}
            <StarRating
              value={tp.difficulteInitiale || 1}
              onChange={(v) => updateField(chemin('listeTP', index, 'difficulteInitiale'), v)}
              tooltip="Difficulté du TP"
            />
          </div>
        )}
      />

      {/* ---------- Annales ---------- */}
      <SectionExercices
        type="ANNALE"
        libelle="Annales"
        libelleAjout="+ Annale"
        onAjouter={() => addAnnaleManuel(lIndex, sIndex, uIndex, mIndex)}
        onScanner={() => scannerDocument('listeAnnales', chemin('listeAnnales'))}
        {...reglagesSection('listeAnnales', 'Annale')}
        rendreDetails={(annale, index) => (
          <div className="ligne-exercice__details">
            {champDate('listeAnnales', index, 'datePrevue', annale.datePrevue)}
            {annale.derniereNote != null && (
              <Pastille ton={annale.derniereNote >= 10 ? 'succes' : 'danger'}>
                {annale.derniereNote}/20
              </Pastille>
            )}
            <StarRating
              value={annale.difficulteInitiale || 3}
              onChange={(v) => updateField(chemin('listeAnnales', index, 'difficulteInitiale'), v)}
              tooltip="Difficulté de l'annale"
            />
          </div>
        )}
      />

      <ConfirmModal
        isOpen={confirmation !== null}
        title={confirmation?.type === 'scan' ? 'Exercices détectés' : 'Retirer le document'}
        message={confirmation?.message || ''}
        confirmLabel={confirmation?.type === 'scan' ? 'Ajouter' : 'Retirer'}
        cancelLabel="Annuler"
        danger={confirmation?.type === 'document'}
        onConfirm={() => { confirmation?.onConfirm?.(); setConfirmation(null); }}
        onCancel={() => setConfirmation(null)}
      />
    </Carte>
  );
}
