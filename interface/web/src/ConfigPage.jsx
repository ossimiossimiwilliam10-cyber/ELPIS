import { useMemo, useState, useEffect, useCallback } from 'react';
import { useToast } from './ToastProvider';
import useStore from './store';
import { getRawIp, setApiUrl } from './utils/apiConfig';
import { useLiaison, ETATS } from './utils/liaison';
import {
  cheminsDocuments, synchroniserDocuments, etatDocuments, viderDocuments,
  formaterOctets, cacheDisponible, poidsAnnonce, placeDisponible,
} from './utils/documentsHorsLigne';
import { getDb, syncFromBackend } from './database';
import ConfirmModal from './components/ConfirmModal';
import { ETAT_VIERGE } from './constants/defaultConfig';
import { Bouton, Carte, TitreCarte, TitrePage, Texte } from './components/ui';
import { capaciteQuotidienne, CAPACITE_DEFAUT, CAPACITE_MIN, CAPACITE_MAX } from './useWorkloadEngine';

/** Chiffres du cursus, dans l'ordre où ils se lisent. */
const MESURES = [
  { cle: 'semestres', libelle: 'Semestres', ton: 'accent' },
  { cle: 'ues', libelle: 'UE', ton: 'accent' },
  { cle: 'matieres', libelle: 'Matières', ton: 'accent' },
  { cle: 'cm', libelle: 'Cours', ton: 'cm' },
  { cle: 'td', libelle: 'TD', ton: 'td' },
  { cle: 'tp', libelle: 'TP', ton: 'tp' },
];

/** Durées par défaut, appliquées tant qu'aucune moyenne personnelle n'existe. */
const DUREES = [
  { key: 'defaultDurationNewCM', label: 'Nouveau cours', ton: 'cm', defaut: 120 },
  { key: 'defaultDurationRevCM', label: 'Révision d\'un cours', ton: 'cm', defaut: 30 },
  { key: 'defaultDurationTD', label: 'Travaux dirigés', ton: 'td', defaut: 20 },
  { key: 'defaultDurationAnki', label: 'Flashcards (Anki)', ton: 'anki', defaut: 30 },
  { key: 'defaultDurationTP_Etape1', label: 'TP — étape 1', ton: 'tp', defaut: 45 },
  { key: 'defaultDurationTP_Etape2', label: 'TP — étape 2', ton: 'tp', defaut: 180 },
  { key: 'defaultDurationTP_Etape3', label: 'TP — étape 3', ton: 'tp', defaut: 90 },
  { key: 'defaultDurationTP_Etape4', label: 'TP — étape 4', ton: 'tp', defaut: 30 },
  { key: 'defaultDurationAnnales', label: 'Annale', ton: 'annale', defaut: 60 },
];

function ConfigPage() {
  const { config, coursConfig, setConfig } = useStore();
  const { addToast } = useToast();
  const [resetConfirmStep, setResetConfirmStep] = useState(0);

  const capacite = capaciteQuotidienne(config);

  const bilan = useMemo(() => {
    const total = { semestres: 0, ues: 0, matieres: 0, cm: 0, td: 0, tp: 0 };
    coursConfig?.licences?.forEach(l => {
      l.semestres?.forEach(s => {
        total.semestres++;
        s.ues?.forEach(u => {
          total.ues++;
          u.matieres?.forEach(m => {
            total.matieres++;
            total.cm += m.listeCM?.length || 0;
            total.td += m.listeTD?.length || 0;
            total.tp += m.listeTP?.length || 0;
          });
        });
      });
    });
    return total;
  }, [coursConfig]);

  const downloadBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(coursConfig, null, 4));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "espoir_cours_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    addToast("Sauvegarde exportée.", 'success');
  };

  const handleImportBackup = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        if (json.licences || json.semestres) {
          useStore.getState().setCoursConfig(json);
          addToast("Cursus importé. L'enregistrement se fait automatiquement.", 'success');
        } else {
          addToast("Fichier invalide : pas de données de cours détectées.", 'error');
        }
      } catch {
        addToast("Impossible de lire le fichier (JSON invalide).", 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = null;
  };

  /*
   * État de la liaison, sondé en continu tant que cet écran est affiché.
   *
   * C'est lui qui commande le bouton : synchroniser sans moteur en face ne
   * produirait qu'un échec au bout de trois tentatives et quarante-cinq
   * secondes d'attente. Mieux vaut un bouton éteint qui dit pourquoi.
   */
  const liaison = useLiaison();

  /**
   * Réconcilie avec le serveur et dit ce qui s'est passé.
   *
   * L'ancienne version rechargeait la page sans un mot : impossible de savoir
   * si quelque chose avait été arbitré, ni si le serveur avait seulement
   * répondu. Un arbitrage n'est pas une erreur, mais il mérite d'être annoncé.
   */
  const handleManualSync = async () => {
    if (!liaison.joignable) {
      addToast(liaison.raison || "Le PC n’est pas joignable.", 'error');
      return;
    }
    addToast("Réconciliation en cours…", 'info');
    const bilan = await useStore.getState().resynchroniser();

    if (bilan.erreurs.length > 0) {
      addToast(`Réconciliation impossible : ${bilan.erreurs[0].message}. Le serveur est-il allumé ?`, 'error');
      return;
    }

    const pousses = bilan.collections.filter(c => c.pousse).length;
    if (bilan.conflits.length > 0) {
      addToast(`Réconcilié — ${bilan.conflits.length} arbitrage(s), rien n'a été perdu.`, 'warning');
    } else if (pousses > 0) {
      addToast("Réconcilié — tes modifications locales sont parties.", 'success');
    } else {
      addToast("Déjà à jour.", 'success');
    }

    /*
     * Les documents suivent la réconciliation, mais seulement quand elle est
     * demandée à la main : la synchronisation automatique ne doit pas déclencher
     * le téléchargement de dizaines de PDF sur une connexion mobile sans que tu
     * l’aies voulu.
     */
    await copierDocuments({ silencieuxSiRienAFaire: true });
  };

  const handleFactoryReset = () => {
    setResetConfirmStep(1);
  };

  const handleConfirmReset = () => {
    if (resetConfirmStep === 1) {
      setResetConfirmStep(2);
    } else if (resetConfirmStep === 2) {
      (async () => {
        try {
          const store = useStore.getState();
          // La configuration par défaut était recopiée ici, avec des valeurs qui
          // avaient divergé de celles du serveur.
          store.setConfig({ ...ETAT_VIERGE.config });
          store.setCoursConfig({ licences: [] });
          // L'historique et les projets survivaient à la « suppression totale » :
          // la remise à zéro laissait toutes les séances passées en place.
          store.setHistorique?.([]);
          store.setProjets?.([]);
          addToast("Réinitialisation terminée. Rechargement…", 'info');
          setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
          addToast("Erreur lors de la réinitialisation : " + err.message, 'error');
        }
      })();
      setResetConfirmStep(0);
    }
  };


  // ---- Copie hors ligne des documents ----
  const [etatDocs, setEtatDocs] = useState({ nombre: 0, octets: 0, disponible: cacheDisponible() });
  const [progression, setProgression] = useState(null);
  const [poids, setPoids] = useState(null);
  const [place, setPlace] = useState(null);

  const chemins = useMemo(() => cheminsDocuments(coursConfig), [coursConfig]);

  const rafraichirDocs = useCallback(async () => {
    setEtatDocs(await etatDocuments());
  }, []);

  useEffect(() => { rafraichirDocs(); }, [rafraichirDocs]);

  useEffect(() => {
    let annule = false;
    (async () => {
      const [p, q] = await Promise.all([poidsAnnonce(chemins), placeDisponible()]);
      if (!annule) { setPoids(p); setPlace(q); }
    })();
    return () => { annule = true; };
  }, [chemins]);

  const copierDocuments = async ({ silencieuxSiRienAFaire = false } = {}) => {
    setProgression({ faits: 0, total: chemins.length });
    const bilan = await synchroniserDocuments(chemins, { onProgress: setProgression });
    setProgression(null);
    await rafraichirDocs();

    if (!bilan.disponible) {
      addToast("Ce navigateur ne sait pas garder de copie hors ligne.", 'error');
    } else if (bilan.quotaAtteint) {
      addToast(
        `Place insuffisante sur cet appareil : ${bilan.telecharges} document(s) copié(s) avant l’arrêt.`,
        'error'
      );
    } else if (bilan.echecs.length > 0) {
      addToast(
        `${bilan.telecharges} document(s) copié(s), ${bilan.echecs.length} en échec — le PC répond-il ?`,
        'warning'
      );
    } else if (bilan.telecharges === 0 && bilan.purges === 0) {
      if (!silencieuxSiRienAFaire) addToast("Tes documents étaient déjà à jour.", 'info');
    } else {
      addToast(`${bilan.telecharges} document(s) copié(s) sur cet appareil.`, 'success');
    }
  };

  const effacerDocuments = async () => {
    await viderDocuments();
    await rafraichirDocs();
    addToast("Copie hors ligne effacée.", 'info');
  };
  return (
    <div className="cfg-page">
      <ConfirmModal
        isOpen={resetConfirmStep > 0}
        title={resetConfirmStep === 1 ? "Tout effacer" : "Confirmation définitive"}
        message={resetConfirmStep === 1
          ? "Cette action effacera ton cursus complet, tout ton historique de séances et tes projets personnels. Elle est irréversible : pense à exporter une sauvegarde avant."
          : "Confirmes-tu la suppression de toutes tes données ? Rien ne pourra être récupéré."}
        confirmLabel={resetConfirmStep === 1 ? "Continuer" : "Tout supprimer"}
        cancelLabel="Annuler"
        danger={true}
        onConfirm={handleConfirmReset}
        onCancel={() => setResetConfirmStep(0)}
      />

      <div>
        <TitrePage>Réglages</TitrePage>
        <Texte doux petit>Tes objectifs, les limites du planificateur et la gestion de tes données.</Texte>
      </div>

      <div className="cfg-mesures">
        {MESURES.map(m => (
          <div key={m.cle} className="cfg-mesure" style={{ '--teinte': `var(--${m.ton === 'accent' ? 'accent' : `type-${m.ton}`})` }}>
            <div className="cfg-mesure__valeur">{bilan[m.cle]}</div>
            <div className="cfg-mesure__libelle">{m.libelle}</div>
          </div>
        ))}
      </div>

      <div className="config-panels-grid">
        {/* ---------- Engagement ---------- */}
        <Carte className="config-panel">
          <TitreCarte>Ton engagement</TitreCarte>
          <Texte doux petit>
            Ces deux réglages remplacent la note et le rang visés. Une note cible
            ne dit rien de ce qu'il faut faire aujourd'hui, et exiger davantage
            d'heures parce qu'on vise plus haut ne fait qu'épuiser.
          </Texte>

          <div className="config-field">
            <label className="config-label-between" htmlFor="cfg-capacite">
              Temps que tu peux réellement donner
              <span className="cfg-valeur cfg-valeur--succes">{capacite} h / jour</span>
            </label>
            <input
              id="cfg-capacite"
              type="range"
              value={capacite}
              onChange={e => setConfig({ ...config, capaciteQuotidienneH: parseFloat(e.target.value) || CAPACITE_DEFAUT })}
              min={CAPACITE_MIN} max={CAPACITE_MAX} step="0.5"
              className="config-range"
            />
            <p className="config-field-hint">
              C'est la seule chose qui fixe ta charge quotidienne. Sois honnête :
              une capacité surestimée produit un programme que tu ne tiendras pas.
            </p>
          </div>

          <div className="config-field">
            <label className="config-label" htmlFor="cfg-cap">Ce que tu cherches à faire</label>
            <select
              id="cfg-cap"
              value={config.cap || 'progresser'}
              onChange={e => setConfig({ ...config, cap: e.target.value })}
              className="config-select"
            >
              <option value="consolider">Consolider — sécuriser la moyenne</option>
              <option value="progresser">Progresser — gagner des points régulièrement</option>
              <option value="viser-haut">Viser haut — jouer les premières places</option>
            </select>
            <p className="config-field-hint">
              L'ambition ne change pas le nombre d'heures, elle change leur emploi :
              plus tu vises haut, plus la part consacrée aux exercices et aux annales
              augmente — c'est là que se gagnent les points au-delà de 14.
            </p>
          </div>

          <div className="cfg-duo">
            <div className="config-field">
              <label className="config-label" htmlFor="cfg-coucher">
                Heure de coucher
                <span className="config-label-hint">Format 24 h. L'affichage AM/PM dépend du navigateur.</span>
              </label>
              <input
                id="cfg-coucher"
                type="time"
                value={config?.bedtime || "23:00"}
                onChange={e => setConfig({ ...config, bedtime: e.target.value })}
                className="config-input"
              />
            </div>
            <div className="config-field">
              <label className="config-label" htmlFor="cfg-reveil">Heure de réveil</label>
              <input
                id="cfg-reveil"
                type="time"
                value={config?.wakeUpTime || "07:00"}
                onChange={e => setConfig({ ...config, wakeUpTime: e.target.value })}
                className="config-input"
              />
            </div>
          </div>
        </Carte>

        {/* ---------- Planificateur ---------- */}
        <Carte className="config-panel">
          <TitreCarte>Ce que le planificateur a le droit de proposer</TitreCarte>
          <Texte doux petit>
            Ces limites protègent contre la surcharge : elles bornent ce qui peut
            arriver dans une même journée.
          </Texte>

          <div className="config-fields-stack">
            <div className="config-field-bordered" style={{ '--teinte': 'var(--type-td)' }}>
              <label className="config-checkbox-label">
                <input
                  type="checkbox"
                  checked={!!config.enableTD}
                  onChange={e => setConfig({ ...config, enableTD: e.target.checked })}
                />
                Proposer des travaux dirigés
              </label>
              <label className="config-checkbox-label">
                <input
                  type="checkbox"
                  checked={!!config.enableAnnales}
                  onChange={e => setConfig({ ...config, enableAnnales: e.target.checked })}
                />
                Proposer des annales
              </label>
              <p className="config-field-hint">
                Décoche-les pour te concentrer d'abord sur la théorie.
              </p>
            </div>

            <div className="config-field-bordered" style={{ '--teinte': 'var(--type-anki)' }}>
              <label className="config-label-between" htmlFor="cfg-anti-ennui">
                Espacement après un exercice trouvé facile
                <span className="cfg-valeur">× {config.antiEnnuiMultiplier || 2.0}</span>
              </label>
              <input
                id="cfg-anti-ennui"
                type="range"
                min="1.0" max="4.0" step="0.1"
                value={config.antiEnnuiMultiplier || 2.0}
                onChange={e => setConfig({ ...config, antiEnnuiMultiplier: parseFloat(e.target.value) || 2.0 })}
                className="config-range"
              />
              <p className="config-field-hint">
                Plus la valeur est haute, plus vite un exercice maîtrisé disparaît du planning.
              </p>
            </div>

            {/*
              * Le nombre de matières par jour décide de ce que l'écran d'accueil
              * montre chaque matin, et il n'était réglable nulle part : figé à
              * trois, il faisait revenir chacune des dix-neuf matières tous les
              * six jours environ. C'est un arbitrage personnel — se concentrer
              * ou balayer — et il revient à l'étudiant, pas à une constante.
              */}
            <div className="config-field-bordered" style={{ '--teinte': 'var(--accent)' }}>
              <label className="config-label" htmlFor="cfg-matieres-jour">
                Matières différentes par jour
              </label>
              <input
                id="cfg-matieres-jour"
                type="number"
                min="1" max="10"
                value={config.maxSubjectsPerDay || 3}
                onChange={e => setConfig({ ...config, maxSubjectsPerDay: Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 3)) })}
                className="config-input"
              />
              <p className="config-field-hint">
                Peu de matières : des séances longues, mais chacune revient plus rarement.
                Beaucoup : tu balayes le cursus, au prix de journées morcelées.
              </p>
            </div>

            <div className="config-field-bordered" style={{ '--teinte': 'var(--danger)' }}>
              <label className="config-label" htmlFor="cfg-max-matiere">
                Nouveaux cours par matière et par jour
              </label>
              <input
                id="cfg-max-matiere"
                type="number"
                min="1" max="10"
                value={config.maxNewCMPerSubjectPerDay || 1}
                onChange={e => setConfig({ ...config, maxNewCMPerSubjectPerDay: parseInt(e.target.value, 10) || 1 })}
                className="config-input"
              />
            </div>

            <div className="config-field-bordered" style={{ '--teinte': 'var(--attention)' }}>
              <label className="config-label" htmlFor="cfg-max-semestre">
                Nouveaux cours par semestre et par jour
              </label>
              <input
                id="cfg-max-semestre"
                type="number"
                min="1" max="20"
                value={config.maxNewCMPerSemesterPerDay || 3}
                onChange={e => setConfig({ ...config, maxNewCMPerSemesterPerDay: parseInt(e.target.value, 10) || 3 })}
                className="config-input"
              />
            </div>
          </div>

          <div className="config-warning-box">
            <strong>Garde ces limites basses.</strong> Ne les augmente qu'en dernier
            recours, pour rattraper un retard important.
          </div>
        </Carte>

        {/* ---------- Durées ---------- */}
        <Carte className="config-panel">
          <TitreCarte>Durées par défaut</TitreCarte>
          <Texte doux petit>
            Appliquées tant que le planificateur n'a pas mesuré ton propre rythme
            sur ce type d'exercice.
          </Texte>
          <div className="duration-grid">
            {DUREES.map(item => (
              <div key={item.key} className="duration-item" style={{ '--teinte': `var(--type-${item.ton})` }}>
                <label className="duration-label" htmlFor={`cfg-${item.key}`}>{item.label}</label>
                <div className="duration-input-row">
                  <input
                    id={`cfg-${item.key}`}
                    type="number"
                    min="5"
                    value={config[item.key] || item.defaut}
                    onChange={e => setConfig({ ...config, [item.key]: parseInt(e.target.value, 10) || item.defaut })}
                    className="duration-input"
                  />
                  <span className="duration-unit">min</span>
                </div>
              </div>
            ))}
          </div>
        </Carte>
      </div>

      {/* ---------- Données ---------- */}
      <div className="config-actions-row">
        <Carte className="config-action-card cfg-action--succes">
          <TitreCarte>Sauvegarde</TitreCarte>
          <Texte doux petit>
            Tout est enregistré automatiquement sur cet appareil. Un export manuel
            reste utile avant une manipulation risquée.
          </Texte>
          <div className="config-action-buttons">
            <Bouton variante="primaire" onClick={downloadBackup}>Exporter</Bouton>
            <input
              type="file"
              accept=".json"
              id="import-backup"
              style={{ display: 'none' }}
              onChange={handleImportBackup}
            />
            <label htmlFor="import-backup" className="el-bouton el-bouton--secondaire">
              Importer
            </label>
          </div>
        </Carte>

        <Carte className="config-action-card cfg-action--danger">
          <TitreCarte>Zone de danger</TitreCarte>
          <Texte doux petit>
            La remise à zéro efface ton cursus, ton historique et tes projets.
            L'action est irréversible.
          </Texte>
          <div className="config-action-buttons">
            <Bouton variante="danger" onClick={handleFactoryReset}>
              Tout remettre à zéro
            </Bouton>
          </div>
        </Carte>

        <Carte className="config-action-card cfg-action--accent">
          <TitreCarte>Liaison avec le PC</TitreCarte>
          <Texte doux petit>
            Le téléphone lit les données servies par le PC. Deux chemins existent, selon
            qui fournit la connexion.
          </Texte>
          <div className="config-field">
            <label className="config-label" htmlFor="cfg-ip">Adresse IP du PC</label>
            <input
              id="cfg-ip"
              type="text"
              placeholder="192.168.1.15"
              defaultValue={getRawIp()}
              onBlur={(e) => setApiUrl(e.target.value)}
              className="config-input"
            />
          </div>
          {/*
            Le cas du partage de connexion mérite d'être écrit : quand c'est le
            téléphone qui donne son réseau au PC, les deux ne sont pas sur un
            réseau local commun. Le PC atteint le téléphone, l'inverse n'a
            aucune route — et l'application reste muette sans qu'on comprenne
            pourquoi. Le câble règle exactement ce cas.
          */}
          <Texte doux petit>
            <strong>Par le câble USB</strong> — le plus sûr, et le seul chemin quand c’est ce
            téléphone qui fournit la connexion au PC. Écris <code>localhost</code> ci-dessus et
            branche le câble : le lanceur du PC ouvre la liaison tout seul dès qu’il voit
            l’appareil. Rien d’autre à faire.
            <br />
            <strong>Par le Wi-Fi</strong> — si les deux sont sur le même réseau, entre plutôt
            l’adresse locale du PC, elle commence souvent par 192.168.
          </Texte>
          {/*
            Un seul bouton, et il dit son état.
            Une page web ne voit pas le câble USB — aucun accès au bus. Mais la
            question utile n'est pas « le câble est-il branché ? », c'est « le
            moteur répond-il ? ». Les deux coïncident : la redirection USB
            n'existe que câble en place, et le moteur ne répond que serveur
            allumé et base ouverte. On sonde donc, on ne devine pas.
          */}
          <div className={`cfg-liaison cfg-liaison--${liaison.etat}`}>
            <span className="cfg-liaison__voyant" aria-hidden="true" />
            <span className="cfg-liaison__texte">
              {liaison.etat === ETATS.JOIGNABLE && (
                <>Liaison établie — le moteur du PC répond{liaison.versionMoteur ? ` (v${liaison.versionMoteur})` : ''}.</>
              )}
              {liaison.etat === ETATS.ABSENT && liaison.raison}
              {liaison.etat === ETATS.NON_CONFIGURE && liaison.raison}
              {liaison.etat === ETATS.INCONNU && 'Vérification de la liaison…'}
            </span>
          </div>

          <div className="config-action-buttons">
            <Bouton
              variante="primaire"
              pleineLargeur
              onClick={handleManualSync}
              disabled={!liaison.joignable}
              title={liaison.joignable ? 'Réconcilier les données des deux appareils' : liaison.raison}
            >
              {liaison.joignable ? 'Synchroniser' : 'Synchroniser — PC non joignable'}
            </Bouton>
            {!liaison.joignable && (
              <Bouton onClick={liaison.verifier} disabled={liaison.verification}>
                {liaison.verification ? 'Vérification…' : 'Revérifier'}
              </Bouton>
            )}
          </div>
        </Carte>

        <Carte className="config-action-card cfg-action--accent">
          <TitreCarte>Documents hors ligne</TitreCarte>
          <Texte doux petit>
            Tes PDF vivent sur le PC, et la synchronisation ne transporte que tes données.
            Copie-les ici pendant que le PC est allumé : ils resteront lisibles sans lui,
            dans le train comme en amphi.
          </Texte>

          {!etatDocs.disponible ? (
            <Texte doux petit>Ce navigateur ne permet pas de copie hors ligne.</Texte>
          ) : (
            <>
              <div className="config-field">
                <Texte doux petit>
                  {etatDocs.nombre} document{etatDocs.nombre > 1 ? 's' : ''} sur cet appareil
                  {etatDocs.octets > 0 && ` · ${formaterOctets(etatDocs.octets)}`}
                  {chemins.length > 0 && ` · ${chemins.length} référencé${chemins.length > 1 ? 's' : ''} par ton cursus`}
                </Texte>
                {poids && poids.octets > 0 && (
                  <Texte doux petit>
                    Poids total à copier : <strong>{formaterOctets(poids.octets)}</strong>
                    {place && ` · ${formaterOctets(place.libre)} disponibles ici`}
                    {'. '}À faire en Wi-Fi.
                  </Texte>
                )}
              </div>

              {progression && (
                <Texte doux petit>
                  Copie en cours… {progression.faits} sur {progression.total}
                </Texte>
              )}

              <div className="config-action-buttons">
                <Bouton
                  variante="primaire"
                  pleineLargeur
                  onClick={() => copierDocuments()}
                  disabled={Boolean(progression) || chemins.length === 0}
                >
                  {chemins.length === 0 ? 'Aucun document à copier' : 'Copier mes documents ici'}
                </Bouton>
                {etatDocs.nombre > 0 && (
                  <Bouton pleineLargeur onClick={effacerDocuments} disabled={Boolean(progression)}>
                    Effacer la copie
                  </Bouton>
                )}
              </div>
            </>
          )}
        </Carte>
      </div>
    </div>
  );
}

export default ConfigPage;
