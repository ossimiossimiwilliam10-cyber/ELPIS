import { useState, useMemo, useId } from 'react';
import { motion } from 'framer-motion';
import useStore from './store';
import { useToast } from './ToastProvider';
import ConfirmModal from './components/ConfirmModal';
import {
  joursRestantsPourJustifier, estHorsDelai, exigeJustificatif, synthetiser, trierParDate,
} from './utils/absences';
import {
  Bouton, Carte, Champ, EtatVide, Espace, Modale, Pastille, Rang, Selection, TitrePage, Texte,
} from './components/ui';

/** Identifiant robuste, y compris pour deux déclarations dans la même milliseconde. */
const nouvelId = () =>
  (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.round(Math.random() * 1e6)}`);

const TYPES = [
  { valeur: 'TP', libelle: 'Travaux pratiques (TP)' },
  { valeur: 'TD', libelle: 'Travaux dirigés (TD)' },
  { valeur: 'CM', libelle: 'Cours magistral (CM)' },
  { valeur: 'Langue', libelle: 'Cours de langue (CRL)' },
];

/** Conséquence propre à chaque type d'enseignement. */
const CONSEQUENCES = {
  TP: { texte: 'Justificatif obligatoire pour les TP — sanction possible au titre des MECC.', ton: 'danger', forte: true },
  CM: { texte: 'Justificatif attendu pour les CM soumis au contrôle d\'assiduité.', ton: 'attention', forte: true },
  Langue: { texte: 'Présence stricte au CRL : une absence injustifiée vaut zéro.', ton: 'danger', forte: true },
  TD: { texte: 'Justificatif non requis par la scolarité, sauf modalités particulières.', ton: 'succes', forte: false },
};

const STATUTS = ['Non Justifié', 'En Attente', 'Justifié', 'Dispensé'];
const LIBELLE_STATUT = {
  'Non Justifié': 'Non justifié',
  'En Attente': 'En attente de validation',
  'Justifié': 'Justifié',
  'Dispensé': 'Dispensé',
};

/** Une case de la synthèse d'assiduité. */
const Compteur = ({ valeur, libelle, ton }) => (
  <div className="abs-compteur">
    <div className={`abs-compteur__valeur${ton ? ` est-${ton}` : ''}`}>{valeur}</div>
    <div className="abs-compteur__libelle">{libelle}</div>
  </div>
);

export default function AbsencesPage() {
  const { config, setConfig, coursConfig } = useStore();
  const { addToast } = useToast();
  const champId = useId();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ date: '', matiere: '', type: 'TP', statut: 'Non Justifié', notes: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  /**
   * Identifiant de l'absence en cours de modification, ou null pour une
   * déclaration neuve.
   *
   * Seul le statut pouvait être changé après coup : une date ou une matière
   * saisie de travers obligeait à supprimer puis tout ressaisir — et l'erreur
   * comptait entre-temps dans le bilan d'assiduité, qui conditionne l'accès aux
   * examens. Le formulaire de déclaration sert donc aussi à corriger.
   */
  const [enEdition, setEnEdition] = useState(null);

  const absences = useMemo(() => config?.absences || [], [config]);
  const absencesTriees = useMemo(() => trierParDate(absences), [absences]);
  const bilan = useMemo(() => synthetiser(absences), [absences]);

  /** Matières du cursus, proposées en autocomplétion. */
  const matieres = useMemo(() => {
    const noms = new Set();
    coursConfig?.licences?.forEach(l => {
      l.semestres?.forEach(s => {
        s.ues?.forEach(u => {
          u.matieres?.forEach(m => {
            if (m.nom) noms.add(m.nom);
          });
        });
      });
    });
    return Array.from(noms).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [coursConfig]);

  const FORMULAIRE_VIDE = { date: '', matiere: '', type: 'TP', statut: 'Non Justifié', notes: '' };

  const fermerFormulaire = () => {
    setShowModal(false);
    setEnEdition(null);
    setFormData(FORMULAIRE_VIDE);
  };

  /** Ouvre le formulaire sur une absence existante, pour la corriger. */
  const modifierAbsence = (absence) => {
    setFormData({
      date: absence.date || '', matiere: absence.matiere || '',
      type: absence.type || 'TP', statut: absence.statut || 'Non Justifié',
      notes: absence.notes || '',
    });
    setEnEdition(absence.id);
    setShowModal(true);
  };

  const handleAddAbsence = (e) => {
    e.preventDefault();
    const matiere = formData.matiere.trim();
    if (!formData.date || !matiere) {
      addToast('Renseigne la date et la matière.', 'error');
      return;
    }

    const absencesMaj = enEdition
      ? absences.map(a => (a.id === enEdition ? { ...a, ...formData, matiere } : a))
      : [...absences, { ...formData, matiere, id: nouvelId() }];

    setConfig({ ...config, absences: absencesMaj }, {
      libelle: enEdition ? "Modification d'une absence" : "Déclaration d'une absence",
    });
    addToast(enEdition ? 'Absence corrigée' : 'Absence enregistrée', 'success');
    fermerFormulaire();
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirm) return;
    setConfig({ ...config, absences: absences.filter(a => a.id !== deleteConfirm.id) });
    addToast('Absence supprimée', 'info');
    setDeleteConfirm(null);
  };

  const updateStatus = (id, newStatus) => {
    setConfig({ ...config, absences: absences.map(a => (a.id === id ? { ...a, statut: newStatus } : a)) });
  };

  const formaterDate = (dateStr) => {
    const [a, m, j] = String(dateStr || '').split('-').map(Number);
    if (!Number.isFinite(a)) return dateStr || '—';
    return new Date(a, m - 1, j).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const consequenceSaisie = CONSEQUENCES[formData.type];

  return (
    <div className="abs-page">
      <Rang entre>
        <div>
          <TitrePage>Mes absences</TitrePage>
          <Texte doux petit>Justificatifs à fournir, délais restants et règles d'assiduité.</Texte>
        </div>
        <Espace />
        <Bouton variante="primaire" onClick={() => setShowModal(true)}>
          Déclarer une absence
        </Bouton>
      </Rang>

      {/* Règle propre à la licence de physique, absente du régime général et
          facile à ignorer : elle rend une absence au rattrapage irrattrapable. */}
      <div className="abs-derogation">
        <strong>Attention, règle propre à la licence de physique.</strong> Une absence
        à une épreuve de substitution ou de rattrapage n'ouvre droit à aucune nouvelle
        épreuve : justifiée, elle vaut <strong>0/20</strong> ; injustifiée sur une épreuve
        avec convocation, elle entraîne la <strong>défaillance</strong>.
      </div>

      {/* Synthèse : l'information la plus utile de la page était absente — il
          fallait parcourir toutes les cartes pour savoir ce qui restait à faire. */}
      {bilan.total > 0 && (
        <div className="abs-bilan">
          <Compteur valeur={bilan.total} libelle="Absences" />
          <Compteur valeur={bilan.aJustifier} libelle="À justifier" ton="attention" />
          <Compteur valeur={bilan.horsDelai} libelle="Hors délai" ton="danger" />
          <Compteur valeur={bilan.enAttente} libelle="En attente" ton="info" />
          <Compteur valeur={bilan.justifiees} libelle="Régularisées" ton="succes" />
        </div>
      )}

      <div className="abs-liste">
        {absencesTriees.length === 0 ? (
          <Carte>
            <EtatVide
              icone="✅"
              titre="Aucune absence déclarée"
              texte="Ton assiduité est parfaite. Déclare une absence dès qu'elle survient : le compte à rebours du justificatif démarre ce jour-là."
            />
          </Carte>
        ) : (
          absencesTriees.map(absence => {
            const joursRestants = joursRestantsPourJustifier(absence.date);
            const horsDelai = estHorsDelai(absence);
            const justificatifRequis = exigeJustificatif(absence.type);
            const regularisee = absence.statut === 'Justifié' || absence.statut === 'Dispensé';
            const consequence = CONSEQUENCES[absence.type];

            return (
              <motion.div key={absence.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Carte
                  className={`abs-carte${regularisee ? ' est-regularisee' : horsDelai ? ' est-hors-delai' : ''}`}
                >
                  <div className="abs-carte__identite">
                    <div className="abs-carte__matiere">
                      {absence.matiere}
                      <Pastille>{absence.type}</Pastille>
                    </div>
                    <div className="abs-carte__date">{formaterDate(absence.date)}</div>

                    {consequence && (
                      <div
                        className={`abs-carte__regle${consequence.forte ? ' est-forte' : ''}`}
                        style={{ '--ton': `var(--${consequence.ton})` }}
                      >
                        {consequence.texte}
                      </div>
                    )}

                    {/* Le motif était saisi puis jamais affiché nulle part. */}
                    {absence.notes && <div className="abs-carte__motif">{absence.notes}</div>}
                  </div>

                  <div className="abs-carte__suivi">
                    <select
                      className={`el-champ${regularisee ? ' est-regularisee' : ''}`}
                      value={absence.statut}
                      onChange={(e) => updateStatus(absence.id, e.target.value)}
                      aria-label={`Statut de l'absence en ${absence.matiere}`}
                    >
                      {STATUTS.map(s => <option key={s} value={s}>{LIBELLE_STATUT[s]}</option>)}
                    </select>

                    {absence.statut === 'Non Justifié' && justificatifRequis && joursRestants !== null && (
                      <div className={`abs-carte__delai${horsDelai ? ' est-depasse' : ''}`}>
                        {horsDelai
                          ? `Délai dépassé de ${Math.abs(joursRestants)} jour${Math.abs(joursRestants) > 1 ? 's' : ''}`
                          : joursRestants === 0
                            ? 'Dernier jour pour justifier'
                            : `Encore ${joursRestants} jour${joursRestants > 1 ? 's' : ''} pour justifier`}
                      </div>
                    )}

                    <button
                      type="button"
                      className="el-lien"
                      onClick={() => modifierAbsence(absence)}
                      aria-label={`Modifier l'absence en ${absence.matiere} du ${formaterDate(absence.date)}`}
                    >
                      Modifier
                    </button>

                    <button
                      type="button"
                      className="el-lien"
                      onClick={() => setDeleteConfirm({ id: absence.id, matiere: absence.matiere, date: absence.date })}
                      aria-label={`Supprimer l'absence en ${absence.matiere}`}
                    >
                      Supprimer
                    </button>
                  </div>
                </Carte>
              </motion.div>
            );
          })
        )}
      </div>

      <Modale ouverte={showModal} onFermer={fermerFormulaire} titre={enEdition ? "Corriger une absence" : "Déclarer une absence"}>
        <form onSubmit={handleAddAbsence} className="abs-formulaire">
          <Champ
            id={`${champId}-date`}
            label="Date de l'absence"
            type="date"
            required
            value={formData.date}
            onChange={e => setFormData({ ...formData, date: e.target.value })}
          />

          <div>
            <Champ
              id={`${champId}-matiere`}
              label="Matière concernée"
              type="text"
              required
              // Saisie libre, mais adossée au cursus : une matière écrite
              // différemment à chaque fois rend le suivi inexploitable.
              list={`${champId}-matieres`}
              placeholder="Programmation C, Mécanique…"
              value={formData.matiere}
              onChange={e => setFormData({ ...formData, matiere: e.target.value })}
            />
            <datalist id={`${champId}-matieres`}>
              {matieres.map(m => <option key={m} value={m} />)}
            </datalist>
          </div>

          <div>
            <Selection
              id={`${champId}-type`}
              label="Type d'enseignement"
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value })}
            >
              {TYPES.map(t => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
            </Selection>
            {consequenceSaisie && (
              <div className="abs-formulaire__consequence" style={{ '--ton': `var(--${consequenceSaisie.ton})` }}>
                {consequenceSaisie.texte}
              </div>
            )}
          </div>

          <div>
            <label className="el-etiquette" htmlFor={`${champId}-notes`}>Motif (facultatif)</label>
            <textarea
              id={`${champId}-notes`}
              className="el-champ"
              placeholder="Maladie, transport, convocation…"
              rows={3}
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div className="abs-formulaire__actions">
            <Bouton onClick={fermerFormulaire}>Annuler</Bouton>
            <Bouton variante="primaire" type="submit">Enregistrer</Bouton>
          </div>
        </form>
      </Modale>

      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm(null)}
        title="Supprimer l'absence"
        message={deleteConfirm ? `Supprimer l'absence en ${deleteConfirm.matiere} du ${formaterDate(deleteConfirm.date)} ?` : ''}
        confirmLabel="Supprimer"
        danger
      />
    </div>
  );
}
