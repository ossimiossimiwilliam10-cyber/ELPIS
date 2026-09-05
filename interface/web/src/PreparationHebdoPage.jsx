import { useState, useEffect, useMemo } from 'react';
import { produce } from 'immer';
import { motion } from 'framer-motion';
import useStore from './store';
import MarkdownModal from './MarkdownModal';
import ConfirmModal from './components/ConfirmModal';
import SectionReserve from './components/hebdo/SectionReserve';
import EngagementsHebdo from './components/hebdo/EngagementsHebdo';
import { getApiUrl } from './utils/apiConfig';
import { useToast } from './ToastProvider';
import logger from './utils/logger';
import { Bouton, Carte, EtatVide, TitrePage, Texte } from './components/ui';

/** Réserve visée par matière et par semaine. */
const CIBLES = { TD: 7, TP: 1, Annale: 1 };

/** Les trois réserves suivies, dans l'ordre où elles s'affichent. */
const RESERVES = [
  { type: 'TD', intitule: 'TD en réserve', ajout: '+ 1 TD', liste: 'listeTD', cible: CIBLES.TD },
  { type: 'TP', intitule: 'TP en réserve', ajout: '+ 1 TP', liste: 'listeTP', cible: CIBLES.TP },
  { type: 'Annale', intitule: 'Annales en réserve', ajout: '+ 1 Annale', liste: 'listeAnnales', cible: CIBLES.Annale },
];

const CLE_LISTE = { TD: 'listeTD', TP: 'listeTP', Annale: 'listeAnnales' };

export default function PreparationHebdoPage() {
  const { config, setConfig, coursConfig, setCoursConfig, setActiveTab } = useStore();
  const { toast } = useToast();
  const [configLocal, setConfigLocal] = useState(coursConfig || { licences: [] });
  const [isSunday, setIsSunday] = useState(new Date().getDay() === 0);
  const [voirCompletes, setVoirCompletes] = useState(false);

  const allMatieres = useMemo(() => {
    const noms = new Set();
    configLocal.licences?.forEach(l => {
      l.semestres?.forEach(s => {
        s.ues?.forEach(ue => {
          ue.matieres?.forEach(m => {
            if (m.nom) noms.add(m.nom);
          });
        });
      });
    });
    return Array.from(noms).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [configLocal]);

  // MarkdownModal state
  const [mdModal, setMdModal] = useState({ isOpen: false, title: '', initialValue: '', onSave: null });
  const [deleteExPending, setDeleteExPending] = useState(null);

  // Mettre à jour isSunday dynamiquement (au cas où la page reste ouverte)
  useEffect(() => {
    const check = () => setIsSunday(new Date().getDay() === 0);
    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Resynchroniser le state local quand le store change
  const [prevCoursConfig, setPrevCoursConfig] = useState(null);
  if (coursConfig !== prevCoursConfig) {
    setPrevCoursConfig(coursConfig);
    if (coursConfig) setConfigLocal(coursConfig);
  }

  /**
   * Applique une mutation Immer puis sauvegarde.
   * Le calcul reste hors de l'updater d'état, qui doit être pur : React le rejoue
   * en mode strict, ce qui déclenchait deux écritures en base par modification.
   */
  const mutateAndSave = (recipe) => {
    const newConf = produce(configLocal, recipe);
    setConfigLocal(newConf);
    setCoursConfig(newConf);
    return newConf;
  };

  // ─── Engagements fixes ───

  /**
   * Remplace un champ d'un engagement.
   *
   * Les objets du store sont gelés par Immer : les modifier en place
   * (`copie[idx].day = …`) levait une TypeError et bloquait la saisie. Seule la
   * copie superficielle du tableau était faite, pas celle de l'élément.
   */
  const majEngagement = (idx, champ, valeur) => {
    const engagements = (config?.fixedCommitments || []).map((c, i) =>
      (i === idx ? { ...c, [champ]: valeur } : c)
    );
    setConfig({ ...config, fixedCommitments: engagements });
  };

  const ajouterEngagement = () => {
    setConfig({
      ...config,
      fixedCommitments: [...(config?.fixedCommitments || []), { day: 'Lundi', start: '08:00', end: '10:00', matiereLinked: '' }]
    });
  };

  const supprimerEngagement = (idx) => {
    setConfig({ ...config, fixedCommitments: (config?.fixedCommitments || []).filter((_, i) => i !== idx) });
  };

  // ─── Exercices ───

  const addEx = (l, s, u, m, type) => {
    mutateAndSave(draft => {
      const mat = draft.licences[l].semestres[s].ues[u].matieres[m];
      const template = {
        titre: type === 'Annale' ? 'Nouvelle Annale' : `Nouvel Exercice de ${type}`,
        dernierePratique: '',
        nombrePratiques: 0,
        notes: '',
        pdfPath: '',
        difficulteInitiale: type === 'Annale' ? 3 : 1,
      };
      if (type === 'TP') template.dateTP = '';

      const cle = CLE_LISTE[type];
      if (!mat[cle]) mat[cle] = [];
      mat[cle].push(template);
    });
  };

  const deleteEx = (l, s, u, m, type, exIndex, titre) => {
    setDeleteExPending({ l, s, u, m, type, exIndex, titre });
  };

  const handleConfirmDeleteEx = () => {
    if (!deleteExPending) return;
    const { l, s, u, m, type, exIndex } = deleteExPending;
    mutateAndSave(draft => {
      const mat = draft.licences[l].semestres[s].ues[u].matieres[m];
      mat[CLE_LISTE[type]]?.splice(exIndex, 1);
    });
    setDeleteExPending(null);
  };

  const handleUploadPdf = (l, s, u, m, type, exIndex) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 25 * 1024 * 1024) {
        toast.error("Ce fichier dépasse 25 Mo.");
        return;
      }
      const formData = new FormData();
      formData.append('pdf', file);
      try {
        const res = await fetch(`${getApiUrl()}/upload/pdf`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
          mutateAndSave(draft => {
            const mat = draft.licences[l].semestres[s].ues[u].matieres[m];
            const liste = mat[CLE_LISTE[type]];
            if (liste && liste[exIndex]) liste[exIndex].pdfPath = data.url;
          });
          toast.success('Document lié.');
        } else {
          // Les alert() bloquaient l'interface, à rebours du reste de l'app.
          toast.error("Envoi refusé : " + (data.error || 'raison inconnue'));
        }
      } catch (err) {
        logger.error("Erreur réseau lors de l'envoi :", err);
        toast.error("Serveur injoignable.");
      }
    };
    input.click();
  };

  const openMarkdownModal = (l, s, u, m, type, exIndex, exercice) => {
    setMdModal({
      isOpen: true,
      title: `Notes ${type} : ${exercice.titre}`,
      initialValue: exercice.notes || '',
      onSave: (val) => mutateAndSave(draft => {
        const liste = draft.licences[l].semestres[s].ues[u].matieres[m][CLE_LISTE[type]];
        if (liste && liste[exIndex]) liste[exIndex].notes = val;
      }),
    });
  };

  const updateExField = (l, s, u, m, type, exIndex, field, value) => {
    mutateAndSave(draft => {
      const liste = draft.licences[l].semestres[s].ues[u].matieres[m][CLE_LISTE[type]];
      if (liste && liste[exIndex]) liste[exIndex][field] = value;
    });
  };

  // ─── État de la réserve, matière par matière ───
  const toutesLesMatieres = useMemo(() => {
    const liste = [];
    configLocal.licences?.forEach((licence, l) => {
      licence.semestres?.forEach((semestre, s) => {
        semestre.ues?.forEach((ue, u) => {
          ue.matieres?.forEach((matiere, m) => {
            const reserves = RESERVES.map(reserve => {
              const exercices = matiere[reserve.liste] || [];
              const enReserve = exercices.filter(item => (item.nombrePratiques || 0) === 0).length;
              return {
                ...reserve,
                exercices,
                enReserve,
                manquants: Math.max(0, reserve.cible - enReserve),
              };
            });

            liste.push({
              l, s, u, m,
              nom: matiere.nom,
              pathName: `${licence.nom} › ${semestre.nom} › ${ue.nom}`,
              reserves,
              complete: reserves.every(r => r.manquants === 0),
            });
          });
        });
      });
    });
    return liste;
  }, [configLocal]);

  // L'ancienne condition retenait aussi les matières complètes dès qu'un exercice
  // restait en réserve — autrement dit toujours. L'écran « Tout est prêt » était
  // donc inatteignable, sauf quand il n'y avait aucune matière du tout.
  const matieresADeficit = toutesLesMatieres.filter(mat => !mat.complete);
  const matieresCompletes = toutesLesMatieres.filter(mat => mat.complete);
  const cursusVide = toutesLesMatieres.length === 0;
  const affichees = voirCompletes ? [...matieresADeficit, ...matieresCompletes] : matieresADeficit;

  return (
    <div className="hebdo-page">
      <div>
        <TitrePage>Préparation hebdomadaire</TitrePage>
        <Texte doux petit>
          L'état de ta réserve d'exercices, matière par matière. Cible par semaine :
          {' '}{CIBLES.TD} TD, {CIBLES.TP} TP et {CIBLES.Annale} annale encore jamais travaillés.
        </Texte>
      </div>

      {!isSunday && (
        <div className="hebdo-avis">
          <span aria-hidden="true">📅</span>
          <div>
            <strong>Ce rituel est prévu pour le dimanche soir.</strong> Rien n'empêche de
            compléter ta réserve maintenant si tu en as besoin.
          </div>
        </div>
      )}

      <EngagementsHebdo
        engagements={config?.fixedCommitments || []}
        matieres={allMatieres}
        onModifier={majEngagement}
        onAjouter={ajouterEngagement}
        onSupprimer={supprimerEngagement}
      />

      {/* Premier lancement : « Toutes vos matières ont atteint leur réserve »
          n'a aucun sens quand aucune matière n'existe. */}
      {cursusVide ? (
        <Carte>
          <EtatVide
            icone="📚"
            titre="Aucune matière à préparer"
            texte="Cette page veille sur ta réserve d'exercices, matière par matière. Crée d'abord ton cursus dans la Bibliothèque."
            actions={
              <Bouton variante="primaire" grand onClick={() => setActiveTab('cours')}>
                Ouvrir la Bibliothèque
              </Bouton>
            }
          />
        </Carte>
      ) : matieresADeficit.length === 0 ? (
        <Carte>
          <EtatVide
            icone="🎉"
            titre="Tout est prêt pour la semaine !"
            texte={`Tes ${matieresCompletes.length} matières ont atteint leur réserve cible (${CIBLES.TD} TD, ${CIBLES.TP} TP, ${CIBLES.Annale} annale).`}
          />
        </Carte>
      ) : (
        <div>
          <Texte doux petit>
            {matieresADeficit.length} matière{matieresADeficit.length > 1 ? 's' : ''} à compléter
            {matieresCompletes.length > 0 && (
              <>
                {' · '}{matieresCompletes.length} déjà prête{matieresCompletes.length > 1 ? 's' : ''}{' '}
                <button type="button" className="el-lien" onClick={() => setVoirCompletes(v => !v)}>
                  {voirCompletes ? 'masquer' : 'afficher'}
                </button>
              </>
            )}
          </Texte>

          <div className="hebdo-matieres" style={{ marginTop: 'var(--esp-4)' }}>
            {affichees.map((mat) => (
              <motion.div
                key={`${mat.l}-${mat.s}-${mat.u}-${mat.m}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Carte>
                  <div className="hebdo-matiere__chemin" title={mat.pathName}>{mat.pathName}</div>
                  <h3 className="hebdo-matiere__nom">{mat.nom}</h3>

                  {mat.reserves.map(reserve => (
                    <SectionReserve
                      key={reserve.type}
                      type={reserve.type}
                      intitule={reserve.intitule}
                      libelleAjout={reserve.ajout}
                      exercices={reserve.exercices}
                      enReserve={reserve.enReserve}
                      cible={reserve.cible}
                      manquants={reserve.manquants}
                      onAjouter={() => addEx(mat.l, mat.s, mat.u, mat.m, reserve.type)}
                      onModifier={(i, champ, valeur) => updateExField(mat.l, mat.s, mat.u, mat.m, reserve.type, i, champ, valeur)}
                      onSupprimer={(i, titre) => deleteEx(mat.l, mat.s, mat.u, mat.m, reserve.type, i, titre)}
                      onEnvoyerPdf={(i) => handleUploadPdf(mat.l, mat.s, mat.u, mat.m, reserve.type, i)}
                      onEditerNotes={(i, ex) => openMarkdownModal(mat.l, mat.s, mat.u, mat.m, reserve.type, i, ex)}
                    />
                  ))}
                </Carte>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <MarkdownModal
        isOpen={mdModal.isOpen}
        title={mdModal.title}
        initialValue={mdModal.initialValue}
        onClose={() => setMdModal(prev => ({ ...prev, isOpen: false }))}
        onSave={(val) => {
          if (mdModal.onSave) mdModal.onSave(val);
        }}
      />

      <ConfirmModal
        isOpen={deleteExPending !== null}
        title="Supprimer l'exercice"
        message={deleteExPending ? `Supprimer le ${deleteExPending.type} « ${deleteExPending.titre || 'sans titre'} » ?` : ''}
        confirmLabel="Supprimer"
        danger
        onConfirm={handleConfirmDeleteEx}
        onCancel={() => setDeleteExPending(null)}
      />
    </div>
  );
}
