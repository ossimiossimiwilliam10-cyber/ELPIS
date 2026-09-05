import { useState, useMemo, useId } from 'react';
import { motion } from 'framer-motion';
import useStore from './store';
import { useToast } from './ToastProvider';
import { getApiUrl } from './utils/apiConfig';
import {
  Bouton, Carte, Champ, EtatVide, Pile, Selection, TitreCarte, TitrePage, Texte,
} from './components/ui';

const DUREE_MIN = 5;
const DUREE_MAX = 480;

export default function RevisionsAvanceesPage() {
  const { coursConfig, pendingTasksCount, setForcedTask, setActiveTab } = useStore();
  const { toast } = useToast();
  const champId = useId();

  const [customMatiere, setCustomMatiere] = useState('all');
  const [customType, setCustomType] = useState('all');
  const [customDuration, setCustomDuration] = useState(30);
  const [isGeneratingCustom, setIsGeneratingCustom] = useState(false);

  // Matières proposées dans la liste déroulante. Le dédoublonnage est indispensable :
  // une matière suivie sur plusieurs semestres apparaissait plusieurs fois, avec la
  // même clé React à chaque occurrence.
  const allMatieres = useMemo(() => {
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

  // Les attributs min/max d'un champ nombre ne contraignent que la saisie assistée :
  // rien n'empêchait une durée aberrante de partir au serveur.
  const dureeBornee = () => {
    const valeur = parseInt(customDuration, 10);
    if (!Number.isFinite(valeur)) return 30;
    return Math.min(DUREE_MAX, Math.max(DUREE_MIN, valeur));
  };

  const handleCustomTargetRequest = async () => {
    setIsGeneratingCustom(true);
    try {
      // Une révision Anki n'appartient à aucune matière : demander « Anki en Algèbre »
      // ne pouvait donner aucun résultat.
      const cibleAnki = customMatiere === 'ANKI' || customType === 'ANKI';

      const res = await fetch(`${getApiUrl()}/orchestrateur/force-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matiere: cibleAnki ? 'Routine' : customMatiere,
          type: cibleAnki ? 'ANKI' : customType,
          dureeMin: dureeBornee()
        })
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 404) {
        toast.info("Aucun exercice ne correspond à ces critères. Essaie une autre matière ou « Peu importe ».");
        return;
      }
      if (!res.ok) {
        toast.error(data.error || "Erreur de génération");
        return;
      }
      if (!data.task) {
        // Réponse 200 sans tâche : auparavant, le clic ne produisait rien du tout.
        toast.info("Aucune cible n'a pu être déterminée. Élargis tes critères.");
        return;
      }

      setForcedTask(data.task);
      setActiveTab('entrainement');
      toast.success("Cible acquise ! L'entraînement est configuré.");
    } catch {
      toast.error("Impossible de joindre l'orchestrateur.");
    } finally {
      setIsGeneratingCustom(false);
    }
  };

  if (pendingTasksCount > 0) {
    return (
      <Carte>
        <EtatVide
          icone="🔒"
          titre="Section verrouillée"
          texte={`Il te reste ${pendingTasksCount} tâche${pendingTasksCount > 1 ? 's' : ''} dans ta session du jour. Le travail d'avance s'ouvre une fois la cible quotidienne atteinte.`}
          actions={
            // Sans issue, cet écran était un cul-de-sac : il fallait passer par le menu.
            <Bouton variante="primaire" grand onClick={() => setActiveTab('entrainement')}>
              Aller à ma Session du Jour
            </Bouton>
          }
        />
      </Carte>
    );
  }

  // Premier lancement : sans matière enregistrée, le ciblage ne peut rien trouver.
  if (allMatieres.length === 0) {
    return (
      <Carte>
        <EtatVide
          icone="📚"
          titre="Rien à cibler pour l'instant"
          texte="Le ciblage manuel puise dans tes matières. Ajoute-les dans la Bibliothèque et cette page saura te trouver un exercice à travailler."
          actions={
            <Bouton variante="primaire" grand onClick={() => setActiveTab('cours')}>
              Ouvrir la Bibliothèque
            </Bouton>
          }
        />
      </Carte>
    );
  }

  const ankiCible = customMatiere === 'ANKI';

  return (
    <div className="avance-page">
      <div>
        <TitrePage>Avance & bonus</TitrePage>
        <Texte doux petit>
          Tes tâches du jour sont faites. Choisis ce que tu veux travailler en plus.
        </Texte>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Carte>
          <TitreCarte>Ciblage manuel</TitreCarte>
          <Texte doux petit>
            Indique une matière, un type et une durée : le planificateur retient
            l'exercice le plus utile parmi ceux qui correspondent.
          </Texte>

          <Pile style={{ marginTop: 'var(--esp-5)' }}>
            <Selection
              id={`${champId}-matiere`}
              label="Matière"
              value={customMatiere}
              onChange={e => setCustomMatiere(e.target.value)}
            >
              <option value="all">Toutes les matières</option>
              <option value="ANKI">Routine Anki (flashcards)</option>
              {allMatieres.map(m => <option key={m} value={m}>{m}</option>)}
            </Selection>

            <Selection
              id={`${champId}-type`}
              label="Type d'exercice"
              value={customType}
              onChange={e => setCustomType(e.target.value)}
              disabled={ankiCible}
              aide={ankiCible ? "Une révision Anki n'appartient à aucune matière." : undefined}
            >
              <option value="all">Peu importe</option>
              <option value="ANKI">Anki (flashcards)</option>
              <option value="CM">Cours magistral</option>
              <option value="TD">Travaux dirigés</option>
              <option value="TP">Travaux pratiques</option>
              <option value="ANNALE">Annale</option>
            </Selection>

            <Champ
              id={`${champId}-duree`}
              label="Durée souhaitée (minutes)"
              type="number"
              min={DUREE_MIN}
              max={DUREE_MAX}
              step="5"
              value={customDuration}
              // La saisie reste libre pendant la frappe — borner ici empêcherait de
              // taper « 45 », le premier caractère étant aussitôt corrigé. La valeur
              // envoyée passe par `dureeBornee()`.
              onChange={e => setCustomDuration(e.target.value)}
              onBlur={() => setCustomDuration(dureeBornee())}
              aide={`Entre ${DUREE_MIN} et ${DUREE_MAX} minutes.`}
            />

            <Bouton
              variante="primaire"
              grand
              pleineLargeur
              onClick={handleCustomTargetRequest}
              disabled={isGeneratingCustom}
              aria-busy={isGeneratingCustom}
            >
              {isGeneratingCustom ? 'Recherche en cours…' : 'Trouver un exercice et commencer'}
            </Bouton>
          </Pile>
        </Carte>
      </motion.div>
    </div>
  );
}
