import { useState } from 'react';
import EpreuveAnki from './EpreuveAnki';
import { motion } from 'framer-motion';
import { useChronoStore } from '../../store';
import { useToast } from '../../ToastProvider';
import InfoTooltip from '../InfoTooltip';
import { DIFFICULTY_LEVELS, RETENTION } from '../../constants';
import { parseTimeInput } from '../../utils/timeParser';
import useInputModal from '../../hooks/useInputModal';
import InputModal from '../InputModal';
import { getApiUrl } from '../../utils/apiConfig';
import VisionneuseDocument from '../VisionneuseDocument';
import { Pastille, Bouton, couleurType, tonType } from '../ui';


/** Étapes d'un TP, chacune avec son intitulé et son action de validation. */
/**
 * Les cinq temps d'un TP.
 *
 * Le cycle suit un rétro-planning calé sur la date de séance : découverte et
 * planification le week-end qui précède, vérification le lendemain à tête
 * reposée, révision la veille, séance et rendu le jour même.
 */
const ETAPES_TP = {
  1: { nom: 'Découverte', action: 'Valider la découverte' },
  2: { nom: 'Planification', action: 'Valider la planification' },
  3: { nom: 'Vérification', action: 'Valider la vérification' },
  4: { nom: 'Révision finale', action: 'Valider la révision' },
  5: { nom: 'Séance et rendu', action: 'TP rendu' },
};

/** Motifs de planification hérités, conservés pour les anciens rapports. */
const MOTIFS_HERITES = {
  REPRISE_EN_MAIN: 'Reprise en main',
  URGENCE_NOTE: 'Note critique',
  EXAMEN_PROCHE: 'Examen proche',
  COEF_ELEVE: 'Coefficient élevé',
  EXAMEN_IMMINENT: 'Examen imminent',
  DEFI_PRECOCE: 'Défi précoce',
  MAITRISE_ATTEINTE: 'Maîtrise atteinte',
  PREPA_TD: 'Prépare le TD',
  ESPACEE_GLOBALE: 'Répétition espacée',
  ESPACEE_GLOBALE_BONUS: 'Répétition espacée (bonus)',
  INTERRUPTION_STAGE: 'Stage interrompu',
  OBLIGATOIRE: 'Obligatoire',
};

const formatTemps = (secondes) => {
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export default function ExerciceCard({ exo, onEvaluateCM, onMarkAsDone, onSuspendCM, ankiDeckName }) {
  const { globalChrono, startGlobalChrono, toggleGlobalChrono, resetGlobalChrono } = useChronoStore();
  const { toast } = useToast();
  const { prompt, isOpen, config, handleConfirm, handleCancel } = useInputModal();
  const [note, setNote] = useState('');
  const [manualTime, setManualTime] = useState(null);
  const [documentOuvert, setDocumentOuvert] = useState(null);
  // Un cours rattaché à un chapitre Anki ne se valide que par l'épreuve.
  // Sans rattachement, aucune carte n'existe : la validation reste manuelle,
  // faute de quoi le cours serait impossible à terminer.
  const rattache = exo.type === 'CM' && Boolean(ankiDeckName || exo.ankiDeck);

  const exoId = exo.id || exo.titre;
  const estActif = globalChrono.exoId === exoId;
  const enMarche = estActif && globalChrono.isRunning;
  const secondes = estActif ? globalChrono.elapsedSeconds : 0;

  // Tous les documents liés, l'ancien champ unique inclus.
  const documents = [...(exo.pdfPaths || [])];
  if (exo.pdfPath && !documents.includes(exo.pdfPath)) documents.unshift(exo.pdfPath);

  const motifs = exo.explication?.raisons?.length
    ? exo.explication.raisons
    : (exo.raisons || []).map(r => MOTIFS_HERITES[r] || r);

  const basculerChrono = async () => {
    if (estActif) {
      toggleGlobalChrono();
      return;
    }
    setManualTime(null);
    if (exo.type === 'ANKI') {
      try {
        const res = await fetch(`${getApiUrl()}/open/anki`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok || !data.success) toast.error(data.error || "Échec du lancement d'Anki.");
        else toast.success('Anki lancé.');
      } catch {
        toast.error('Impossible de lancer Anki (serveur injoignable).');
      }
    }
    startGlobalChrono(exo);
  };

  /** Minutes retenues : saisie manuelle si présente, sinon temps chronométré. */
  const minutesRetenues = () => (
    manualTime !== null ? manualTime : (secondes > 0 ? Math.max(1, Math.ceil(secondes / 60)) : 0)
  );

  const valider = async (callback, ...args) => {
    if (estActif) resetGlobalChrono();

    let minutes = minutesRetenues();
    if (minutes === 0 && exo.type === 'ANKI') {
      const saisie = await prompt(
        `Temps passé sur Anki (en minutes) ? Laisse vide pour retenir la moyenne (${Math.round(exo.tempsMoyen || 30)} min).`,
        ''
      );
      if (saisie !== null && saisie.trim() !== '') {
        const analyse = parseTimeInput(saisie);
        if (analyse !== null) minutes = analyse;
      }
    }

    callback(exo, ...args, minutes);
    setManualTime(null);
  };

  const etapeTP = exo.type === 'TP' && exo.etape ? ETAPES_TP[exo.etape] : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98, x: -40, transition: { duration: 0.2 } }}
      className="exercice"
      style={{ '--liseré': couleurType(exo.type) }}
    >
      {/* ---------- En-tête ---------- */}
      <div className="exercice__entete">
        <div className="exercice__identite">
          <h3 className="exercice__titre" title={exo.titre}>{exo.titre}</h3>

          <div className="exercice__contexte">
            <Pastille ton={tonType(exo.type)}>{exo.type}</Pastille>
            <span className="exercice__matiere">{exo.matiereNom}</span>

            {motifs.map((motif, i) => (
              <Pastille key={`motif-${i}`} ton="accent" title={exo.priorite ? `Priorité ${exo.priorite} sur 100` : undefined}>
                {motif}
              </Pastille>
            ))}

            {exo.notebookLMLink && (
              <button
                type="button"
                className="el-bouton-icone"
                onClick={() => {
                  const lien = exo.notebookLMLink.startsWith('http') ? exo.notebookLMLink : `https://${exo.notebookLMLink}`;
                  window.open(lien, '_blank', 'noopener');
                }}
                aria-label="Ouvrir NotebookLM pour cette matière"
                title="Ouvrir NotebookLM pour cette matière"
              >
                📖
              </button>
            )}
          </div>
        </div>

        <div className="exercice__etat">
          {exo.type === 'CM' ? (
            <InfoTooltip content="L'algorithme FSRS calcule ce délai en fonction de ta note de rétention. Plus tu réussis, plus l'intervalle s'allonge.">
              Revu {exo.repetitions || 0} fois · J{exo.jActuel || 0} ℹ️
            </InfoTooltip>
          ) : etapeTP ? (
            <>
              Étape {exo.etape} sur 5 · {etapeTP.nom}
              {Number.isFinite(exo.joursAvantTP) && (
                <> · {exo.joursAvantTP === 0 ? "séance aujourd'hui"
                  : exo.joursAvantTP === 1 ? 'séance demain'
                    : `séance dans ${exo.joursAvantTP} jours`}</>
              )}
            </>
          ) : (
            `Pratiqué ${exo.nombrePratiques || 0} fois`
          )}
        </div>
      </div>

      {/* Ce que l'étape demande : sans cela, « Planification » ne dit pas
          qu'il s'agit de simuler le TP en entier. */}
      {exo.etapeIntention && (
        <div className="exercice__consigne">{exo.etapeIntention}</div>
      )}

      {/* ---------- Chronomètre ---------- */}
      <div className="exercice__chrono">
        <button
          type="button"
          className={`exercice__bouton-chrono${enMarche ? ' est-actif' : ''}`}
          onClick={basculerChrono}
          aria-label={enMarche ? 'Mettre le chronomètre en pause' : 'Démarrer le chronomètre'}
          title={enMarche ? 'Mettre en pause' : 'Démarrer le chrono'}
        >
          <span aria-hidden="true">{enMarche ? '⏸' : '▶'}</span>
        </button>

        <span className={`exercice__temps${estActif ? ' est-actif' : ''}`}>{formatTemps(secondes)}</span>

        <div className="exercice__saisie">
          <label htmlFor={`temps-${exoId}`}>ou saisir</label>
          <input
            id={`temps-${exoId}`}
            type="number"
            min="0"
            max="999"
            className="el-champ"
            placeholder={exo.tempsMoyen ? String(Math.round(exo.tempsMoyen)) : '0'}
            value={manualTime !== null ? manualTime : ''}
            onChange={(e) => {
              const valeur = e.target.value;
              if (valeur === '') return setManualTime(null);
              const nombre = parseInt(valeur, 10);
              if (Number.isFinite(nombre) && nombre >= 0) setManualTime(nombre);
            }}
          />
          <label htmlFor={`temps-${exoId}`}>min</label>
        </div>
      </div>

      {/* ---------- Documents ---------- */}
      {documents.length > 0 && (
        <div className="exercice__documents">
          {documents.map((url, i) => (
            <Bouton key={i} onClick={() => setDocumentOuvert(url)}>
              📄 {documents.length === 1 ? 'Ouvrir le document' : `Document ${i + 1}`}
            </Bouton>
          ))}
        </div>
      )}

      {/* ---------- Validation ---------- */}
      {exo.type === 'CM' ? (
        <>
          {rattache ? (
            <EpreuveAnki
              deckMatiere={ankiDeckName}
              titreCours={exo.titre}
              deckExplicite={exo.ankiDeck}
              onValide={(noteMesuree) => valider(onEvaluateCM, noteMesuree)}
            />
          ) : (
            <>
              <div className="exercice__retention" role="group" aria-label="Niveau de rétention">
                {RETENTION.map(({ note: valeur, libelle, couleur, aide }) => (
                  <button
                    key={valeur}
                    type="button"
                    className="retention"
                    style={{ '--retention-couleur': couleur }}
                    onClick={() => valider(onEvaluateCM, valeur)}
                    title={aide}
                  >
                    <span className="retention__note">{valeur}</span>
                    <span className="retention__libelle">{libelle}</span>
                  </button>
                ))}
              </div>

              {/* Sans chapitre rattaché, la validation repose sur une
                  auto-évaluation — toujours plus indulgente qu'une mesure. */}
              <div className="exercice__proposition">
                Rattache ce cours à un chapitre Anki dans la Bibliothèque pour le
                valider sur une vraie épreuve.
              </div>
            </>
          )}

          {onSuspendCM && (
            <Bouton
              pleineLargeur
              onClick={() => {
                const minutes = minutesRetenues();
                if (estActif) resetGlobalChrono();
                onSuspendCM(exo, minutes);
                setManualTime(null);
              }}
              title="Clôturer la séance sans terminer le cours — il reviendra demain"
            >
              ⏸️ Suspendre la séance (à continuer demain)
            </Bouton>
          )}
        </>
      ) : exo.type === 'ANNALE' ? (
        <div className="exercice__note-annale">
          <input
            type="number"
            min="0" max="20" step="0.5"
            className="el-champ"
            placeholder="Note /20"
            aria-label="Note obtenue sur 20"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Bouton
            variante="primaire"
            disabled={note === ''}
            onClick={() => { if (note !== '') valider(onMarkAsDone, note); }}
          >
            Valider la note
          </Bouton>
        </div>
      ) : (
        <div className="exercice__actions">
          <Bouton variante="primaire" grand onClick={() => valider(onMarkAsDone, '')}>
            {etapeTP ? etapeTP.action : 'Fait'}
          </Bouton>

          {exo.type !== 'ANKI' && exo.type !== 'LANGUE' && (
            <div className="exercice__difficultes-bloc">
              {/* Rien n'indiquait ce que ce choix déclenche. C'est pourtant
                  l'interaction dont dépend tout le calendrier de révisions :
                  la réponse ne note pas le travail, elle fixe la date du
                  prochain passage. */}
              <div className="exercice__difficultes-titre">
                Difficulté ressentie
                <InfoTooltip
                  width={280}
                  content="Ta réponse ne note pas ton travail : elle fixe la date de la prochaine révision. « Difficile » la rapproche, « Facile » l'éloigne. Se surévaluer repousse la révision au-delà de l'oubli — et le cours est alors à réapprendre en entier."
                >
                  <span aria-hidden="true"> ℹ️</span>
                </InfoTooltip>
              </div>
              <div className="exercice__difficultes" role="group" aria-label="Difficulté ressentie">
                {DIFFICULTY_LEVELS?.map(niveau => (
                  <button
                    key={niveau.key}
                    type="button"
                    className="difficulte"
                    onClick={() => valider(onMarkAsDone, niveau.key)}
                    title={`Valider en signalant : ${niveau.title.toLowerCase()}`}
                  >
                    {niveau.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {documentOuvert && (
        <VisionneuseDocument
          chemin={documentOuvert}
          titre={exo.titre}
          onClose={() => setDocumentOuvert(null)}
        />
      )}

      <InputModal
        isOpen={isOpen}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        title={config.title}
        defaultValue={config.defaultValue}
        placeholder={config.placeholder}
      />
    </motion.div>
  );
}
