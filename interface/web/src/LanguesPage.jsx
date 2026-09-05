import { useState, useEffect, useCallback, useMemo, useId } from 'react';
import useStore from './store';
import { useToast } from './ToastProvider';
import ConfirmModal from './components/ConfirmModal';
import { estUrlSure } from './utils/videoUrl';
import { getApiUrl } from './utils/apiConfig';
import { getTodayStr } from './utils/dateUtils';
import logger from './utils/logger';
import {
  Bouton, BoutonIcone, Carte, Champ, EtatVide, Espace, Jauge, Modale,
  Pastille, Rang, Selection, Texte, TitreCarte, TitrePage,
} from './components/ui';
import SelecteurDrapeau from './components/SelecteurDrapeau';

/**
 * Langues — pratique régulière hors cursus.
 *
 * La page ne calcule ni dette ni niveau : elle interroge `/api/langues/etat`,
 * où vivent les seules implémentations de ces deux modèles (`moteur/langues.js`
 * et `moteur/niveauLangue.js`). Recopier une formule ici la ferait diverger
 * sans bruit dès la première retouche, et l'écart ne se verrait qu'au moment où
 * la page annoncerait « à jour » pour une séance que l'orchestrateur planifie
 * quand même.
 *
 * Les liens de conversation sont ouverts par le navigateur, tels quels : ce
 * sont des adresses vers des fils de discussion existants, pas des appels
 * d'API. Seul le vocabulaire justifie une intégration — recopier vingt mots
 * d'un onglet vers Anki est exactement ce qu'on cesse de faire au bout de deux
 * semaines.
 */

const CLES_VOLETS = ['vocabulaire', 'conversation', 'grammaire'];

const LIBELLES_VOLETS = {
  vocabulaire: 'Vocabulaire',
  conversation: 'Conversation',
  grammaire: 'Grammaire',
};

/** Ce que chaque volet travaille, dans le vocabulaire d'`objectifs.js`. */
const REGIMES = {
  vocabulaire: 'Entretien',
  conversation: 'Entraînement',
  grammaire: 'Découverte',
};

const nouvelId = () =>
  (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.round(Math.random() * 1e6)}`);

/** Langue vierge, prête à être complétée dans la fenêtre de réglages. */
const langueVierge = () => ({
  id: nouvelId(),
  nom: '',
  drapeau: '🌍',
  actif: true,
  cadence: 3,
  categorie: '',
  heuresAcquises: 0,
  niveauImpose: '',
  dernieresPratiques: { vocabulaire: '', conversation: '', grammaire: '' },
  vocabulaire: { deckAnki: '', liens: [], dureeMinutes: 20 },
  conversation: { liens: [], dureeMinutes: 20 },
  grammaire: { liens: [], livre: '', dureeMinutes: 30 },
});

/**
 * Les liens d'un volet, quelle que soit la forme enregistrée.
 *
 * `moteur/langues.js` fait autorité sur cette reprise et l'applique déjà pour
 * décider si un volet est exploitable. La page ne peut pas s'y adosser sans
 * attendre la réponse du serveur : elle appliquerait la même règle avec un
 * temps de retard, et les boutons apparaîtraient après coup. On répète donc
 * ici la seule chose qui doit l'être — et rien de plus.
 */
function liensDe(reglage) {
  const liens = Array.isArray(reglage?.liens) ? reglage.liens.filter(l => estUrlSure(l?.url)) : [];
  if (liens.length > 0) return liens;

  const herite = reglage?.lienIA || reglage?.lienGeneration;
  return estUrlSure(herite)
    ? [{ id: 'lien-1', libelle: 'Ma conversation', url: String(herite).trim() }]
    : [];
}

/** Ouvre une adresse dans un onglet, en refusant les schémas exécutables. */
function ouvrirLien(url, toast) {
  if (!estUrlSure(url)) {
    toast.error("Ce lien n'est pas une adresse http(s) valide.");
    return false;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

/* ------------------------------------------------------------------ Volet */

function Volet({ langue, cle, etat, propose, onPratique, onGenerer, onReviser, onLivre, toast }) {
  const reglage = langue[cle] || {};
  const liens = liensDe(reglage);
  const meta = etat?.volets?.find(v => v.cle === cle);
  const exploitable = meta ? meta.exploitable : false;

  const derniere = meta?.derniere
    ? `Dernière séance il y a ${meta.joursDepuis} j`
    : 'Jamais pratiqué';

  const actions = [];

  if (cle === 'vocabulaire' && reglage.deckAnki) {
    actions.push(
      <Bouton key="generer" variante="primaire" pleineLargeur onClick={() => onGenerer(langue)}>
        <span aria-hidden="true">✨</span> Ajouter des mots
      </Bouton>,
      <Bouton key="reviser" pleineLargeur onClick={() => onReviser(langue)}>
        <span aria-hidden="true">🗂️</span> Réviser dans Anki
      </Bouton>
    );
  }

  // Livre et conversation d'un même geste : c'est la façon dont on travaille
  // réellement une règle — on la lit, puis on la fait expliquer.
  if (cle === 'grammaire' && reglage.livre && liens.length > 0) {
    actions.push(
      <Bouton
        key="deux"
        variante="primaire"
        pleineLargeur
        onClick={() => { onLivre(reglage.livre); ouvrirLien(liens[0].url, toast); }}
      >
        <span aria-hidden="true">📖</span> Livre + {liens[0].libelle}
      </Bouton>
    );
  }

  for (const lien of liens) {
    const premierEtSeul = liens.length === 1 && !(cle === 'grammaire' && reglage.livre);
    actions.push(
      <Bouton
        key={lien.id}
        variante={premierEtSeul && cle !== 'vocabulaire' ? 'primaire' : 'fantome'}
        pleineLargeur
        onClick={() => ouvrirLien(lien.url, toast)}
      >
        <span aria-hidden="true">{cle === 'conversation' ? '🎙️' : '💬'}</span> {lien.libelle}
      </Bouton>
    );
  }

  if (cle === 'grammaire' && reglage.livre) {
    actions.push(
      <Bouton key="livre" variante="fantome" pleineLargeur onClick={() => onLivre(reglage.livre)}>
        <span aria-hidden="true">📖</span> Ouvrir le livre
      </Bouton>
    );
  }

  const classes = [
    'langue-volet',
    propose && 'langue-volet--propose',
    !exploitable && 'langue-volet--vide',
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className="langue-volet__entete">
        <h4 className="langue-volet__titre">{LIBELLES_VOLETS[cle]}</h4>
        {propose && <Pastille ton="langue">Aujourd&apos;hui</Pastille>}
      </div>

      <div className="langue-volet__meta">
        {REGIMES[cle]} · tous les {meta?.intervalleJours ?? '—'} j
        <br />
        {derniere}
      </div>

      {meta && (
        <Jauge
          valeur={Math.min(1, meta.dette) * 100}
          ton={meta.du ? 'langue' : undefined}
          libelle={`Échéance ${LIBELLES_VOLETS[cle]} : ${Math.round(Math.min(1, meta.dette) * 100)} %`}
        />
      )}

      <div className="langue-volet__actions">
        {exploitable ? actions : (
          <Texte petit doux>Rien à ouvrir : complète les réglages.</Texte>
        )}
        {exploitable && (
          <Bouton
            variante={meta?.faitAujourdhui ? 'fantome' : 'secondaire'}
            pleineLargeur
            disabled={meta?.faitAujourdhui}
            onClick={() => onPratique(langue, cle)}
          >
            {meta?.faitAujourdhui ? '✓ Fait aujourd’hui' : 'J’ai pratiqué'}
          </Bouton>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------- Éditeur de liens */

/**
 * Liste d'adresses nommées.
 *
 * Un fil de discussion tire sa valeur de son historique : celui où l'on a
 * travaillé les temps du passé n'est pas celui où l'on bavarde. D'où plusieurs
 * adresses par volet, nommées par leur propriétaire — ELPIS n'a aucun moyen de
 * deviner ce que contient une conversation.
 */
function EditeurLiens({ idBase, liens, onChanger }) {
  const [libelle, setLibelle] = useState('');
  const [url, setUrl] = useState('');
  const [erreur, setErreur] = useState('');

  const ajouter = () => {
    if (!estUrlSure(url)) {
      setErreur('Adresse invalide : elle doit commencer par http:// ou https://');
      return;
    }
    if (liens.some(l => l.url === url.trim())) {
      setErreur('Cette adresse figure déjà dans la liste.');
      return;
    }
    onChanger([...liens, {
      id: nouvelId(),
      libelle: libelle.trim() || `Conversation ${liens.length + 1}`,
      url: url.trim(),
    }]);
    setLibelle('');
    setUrl('');
    setErreur('');
  };

  return (
    <div className="langue-liens">
      {liens.length > 0 && (
        <ul className="langue-liens__liste">
          {liens.map(lien => (
            <li key={lien.id} className="langue-liens__entree">
              <span className="langue-liens__nom">{lien.libelle}</span>
              <span className="langue-liens__url">{lien.url}</span>
              <BoutonIcone
                libelle={`Retirer ${lien.libelle}`}
                danger
                onClick={() => onChanger(liens.filter(l => l.id !== lien.id))}
              >
                ✕
              </BoutonIcone>
            </li>
          ))}
        </ul>
      )}

      <div className="langue-liens__ajout">
        <Champ
          id={`${idBase}-libelle`}
          label="Nom"
          placeholder="Temps du passé"
          value={libelle}
          onChange={e => setLibelle(e.target.value)}
        />
        <Champ
          id={`${idBase}-url`}
          label="Adresse de la conversation"
          type="url"
          placeholder="https://gemini.google.com/app/…"
          value={url}
          erreur={erreur}
          onChange={e => { setUrl(e.target.value); setErreur(''); }}
        />
        <Bouton onClick={ajouter} disabled={!url.trim()}>Ajouter</Bouton>
      </div>
    </div>
  );
}

/* -------------------------------------------------------- Fenêtre réglages */

function ReglagesLangue({ langue, livres, referentiel, onEnregistrer, onFermer }) {
  const champId = useId();
  const [brouillon, setBrouillon] = useState(langue);

  const majRacine = (champ, valeur) => setBrouillon(l => ({ ...l, [champ]: valeur }));
  const majVolet = (volet, champ, valeur) =>
    setBrouillon(l => ({ ...l, [volet]: { ...l[volet], [champ]: valeur } }));

  const valider = () => {
    if (!brouillon.nom.trim()) return;
    onEnregistrer({ ...brouillon, nom: brouillon.nom.trim() });
  };

  return (
    <div className="langue-reglages">
      <Champ
        id={`${champId}-nom`}
        label="Langue"
        placeholder="Anglais, Espagnol, Japonais…"
        value={brouillon.nom}
        onChange={e => majRacine('nom', e.target.value)}
      />

      {/*
        * Le symbole se choisissait dans une case de texte de quatre caractères.
        * Sur téléphone le clavier propose les émoji ; sur ordinateur il faut
        * connaître un raccourci système pour produire un drapeau, et le champ
        * restait donc au globe par défaut.
        */}
      <SelecteurDrapeau
        id={`${champId}-drapeau`}
        valeur={brouillon.drapeau}
        onChoisir={v => majRacine('drapeau', v)}
      />

      <Selection
        id={`${champId}-cadence`}
        label="Cadence"
        aide="Tu déclares ce que tu peux tenir ; ELPIS choisit lequel des trois volets travailler."
        value={brouillon.cadence}
        onChange={e => majRacine('cadence', Number(e.target.value))}
      >
        {[1, 2, 3, 4, 5, 6, 7].map(n => (
          <option key={n} value={n}>{n} séance{n > 1 ? 's' : ''} par semaine</option>
        ))}
      </Selection>

      <div className="langue-reglages__groupe">
        <div className="langue-reglages__legende">Repère de niveau</div>
        <Texte petit doux>
          Ce n’est pas une évaluation : c’est le repère que reçoit l’IA pour ne générer
          ni des mots triviaux ni des mots hors de portée. Il se déduit des heures de
          pratique, comptées automatiquement à partir de tes séances.
        </Texte>

        <Champ
          id={`${champId}-heures`}
          label="Heures déjà faites avant ELPIS"
          aide="Le réglage le plus important, et le seul indevinable : sans lui, dix ans d’anglais scolaire comptent pour zéro."
          type="number"
          min={0}
          max={20000}
          value={brouillon.heuresAcquises ?? 0}
          onChange={e => majRacine('heuresAcquises', Math.max(0, Number(e.target.value) || 0))}
        />

        <div className="langue-reglages__paire">
          <Selection
            id={`${champId}-categorie`}
            label="Distance à la langue"
            aide="Étire l’échelle : une langue lointaine demande plus d’heures pour le même palier."
            value={brouillon.categorie || ''}
            onChange={e => majRacine('categorie', e.target.value)}
          >
            <option value="">Déduite du nom</option>
            {(referentiel?.categories || []).map(c => (
              <option key={c.code} value={c.code}>
                {c.libelle} — {c.exemples.split(',')[0].trim()}…
              </option>
            ))}
          </Selection>

          <Selection
            id={`${champId}-niveau`}
            label="Niveau"
            aide="À imposer si tu le connais — une certification vaut mieux qu’une extrapolation."
            value={brouillon.niveauImpose || ''}
            onChange={e => majRacine('niveauImpose', e.target.value)}
          >
            <option value="">Estimé d’après les heures</option>
            {(referentiel?.paliers || []).map(p => (
              <option key={p.code} value={p.code}>{p.code} — {p.libelle}</option>
            ))}
          </Selection>
        </div>
      </div>

      <div className="langue-reglages__groupe">
        <div className="langue-reglages__legende">Vocabulaire — entretien</div>
        <Champ
          id={`${champId}-deck`}
          label="Deck Anki"
          aide="Le deck qui reçoit les mots générés, et celui qu'ouvre la révision."
          placeholder="Anglais::Vocabulaire"
          value={brouillon.vocabulaire.deckAnki}
          onChange={e => majVolet('vocabulaire', 'deckAnki', e.target.value)}
        />
        <EditeurLiens
          idBase={`${champId}-voc`}
          liens={liensDe(brouillon.vocabulaire)}
          onChanger={liens => majVolet('vocabulaire', 'liens', liens)}
        />
      </div>

      <div className="langue-reglages__groupe">
        <div className="langue-reglages__legende">Conversation — entraînement</div>
        <EditeurLiens
          idBase={`${champId}-conv`}
          liens={liensDe(brouillon.conversation)}
          onChanger={liens => majVolet('conversation', 'liens', liens)}
        />
      </div>

      <div className="langue-reglages__groupe">
        <div className="langue-reglages__legende">Grammaire — découverte</div>
        <EditeurLiens
          idBase={`${champId}-gram`}
          liens={liensDe(brouillon.grammaire)}
          onChanger={liens => majVolet('grammaire', 'liens', liens)}
        />
        <Selection
          id={`${champId}-livre`}
          label="Livre numérique"
          aide={livres.length ? "Les fichiers du dossier documents/." : "Aucun fichier dans documents/ : dépose-y ton livre."}
          value={brouillon.grammaire.livre}
          onChange={e => majVolet('grammaire', 'livre', e.target.value)}
        >
          <option value="">Aucun</option>
          {livres.map(f => <option key={f} value={f}>{f}</option>)}
        </Selection>
      </div>

      <div className="langue-reglages__groupe">
        <div className="langue-reglages__legende">Durées d’une séance</div>
        <div className="langue-reglages__paire">
          {CLES_VOLETS.map(cle => (
            <Champ
              key={cle}
              id={`${champId}-duree-${cle}`}
              label={`${LIBELLES_VOLETS[cle]} (min)`}
              type="number"
              min={5}
              max={180}
              value={brouillon[cle].dureeMinutes}
              onChange={e => majVolet(cle, 'dureeMinutes', Math.max(5, Number(e.target.value) || 5))}
            />
          ))}
        </div>
      </div>

      <Rang>
        <Bouton
          variante={brouillon.actif ? 'fantome' : 'secondaire'}
          onClick={() => majRacine('actif', !brouillon.actif)}
        >
          {brouillon.actif ? '⏸️ Mettre en pause' : '▶️ Réactiver'}
        </Bouton>
        <Espace />
        <Bouton variante="fantome" onClick={onFermer}>Annuler</Bouton>
        <Bouton variante="primaire" disabled={!brouillon.nom.trim()} onClick={valider}>
          Enregistrer
        </Bouton>
      </Rang>
    </div>
  );
}

/* ------------------------------------------------- Fenêtre de génération */

/**
 * Préparation de cartes de vocabulaire.
 *
 * ELPIS n'appelle plus de modèle lui-même. Ce n'est pas une régression : la clé
 * n'a jamais été renseignée, et le bouton « Générer et envoyer » échouait donc
 * systématiquement. Surtout, dépendre d'un service extérieur pour une fonction
 * accessoire condamnait l'application à s'arrêter le jour où ce service change
 * d'avis, de tarif ou de nom.
 *
 * Ce qui a de la valeur ici n'a jamais été l'appel réseau : c'est la consigne,
 * calée sur le niveau CECR estimé et sur les mots déjà présents dans le paquet,
 * puis le filtrage des doublons et l'insertion dans Anki. Tout cela est local et
 * demeure. Seul le trajet du texte change : il passe par la fenêtre de
 * conversation de son choix, où le modèle est meilleur, gratuit, et remplaçable.
 */
function GenerationVocabulaire({ langue, onFermer, toast }) {
  const champId = useId();
  const [nombre, setNombre] = useState(10);
  const [theme, setTheme] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState(null);
  const [consigne, setConsigne] = useState(null);
  const [colle, setColle] = useState('');

  const corps = () => ({ langueId: langue.id, nombre, theme });

  const appeler = async (chemin, charge) => {
    const reponse = await fetch(`${getApiUrl()}/langues/${chemin}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(charge),
    });
    return { reponse, data: await reponse.json() };
  };

  /** Annonce le bilan d'un ajout, en distinguant les doublons des échecs. */
  const annoncer = (data) => {
    const morceaux = [];
    if (data.ajoutees > 0) morceaux.push(`${data.ajoutees} carte${data.ajoutees > 1 ? 's' : ''} ajoutée${data.ajoutees > 1 ? 's' : ''}`);
    if (data.deja > 0) morceaux.push(`${data.deja} déjà connu${data.deja > 1 ? 's' : ''}`);
    if (data.refusees > 0) morceaux.push(`${data.refusees} refusée${data.refusees > 1 ? 's' : ''} par Anki`);

    if (data.ajoutees > 0) toast.success(`${morceaux.join(', ')} — « ${data.deck} ».`);
    else toast.info(data.message || morceaux.join(', ') || 'Rien à ajouter.');
  };

  const recupererConsigne = useCallback(async () => {
    try {
      const { reponse, data } = await appeler('vocabulaire/prompt', corps());
      if (!reponse.ok) return toast.error(data.error || "Consigne indisponible.");
      setConsigne(data);
    } catch (e) {
      logger.error('Consigne de vocabulaire', e);
      toast.error("Serveur injoignable.");
    }
    // `corps` dépend de l'état local du formulaire, relu à chaque appel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langue.id, nombre, theme]);

  // La consigne est le point de départ, plus une porte de secours : elle est
  // prête dès l'ouverture, et se recale quand le nombre ou le thème changent.
  useEffect(() => { recupererConsigne(); }, [recupererConsigne]);

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(consigne.texte);
      toast.success('Consigne copiée.');
    } catch {
      toast.info('Sélectionne le texte ci-dessous pour le copier.');
    }
  };

  const importer = async () => {
    setEnCours(true);
    try {
      const { reponse, data } = await appeler('anki/ajouter', {
        deck: langue.vocabulaire.deckAnki,
        texte: colle,
      });
      if (!reponse.ok) {
        toast.error(data.error || "L'import a échoué.");
        return;
      }
      setResultat(data);
      setColle('');
      annoncer(data);
    } catch (e) {
      logger.error('Import de vocabulaire', e);
      toast.error("Serveur injoignable.");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="langue-reglages">
      <Texte doux petit>
        ELPIS prépare la consigne — calée sur ton niveau et sur les mots que tu connais déjà — puis
        range la réponse dans « {langue.vocabulaire.deckAnki} ». Le modèle, tu le choisis ; Anki doit
        être ouvert.
      </Texte>

      <div className="langue-reglages__paire">
        <Champ
          id={`${champId}-nombre`}
          label="Combien de mots"
          type="number"
          min={1}
          max={40}
          value={nombre}
          onChange={e => setNombre(Math.min(40, Math.max(1, Number(e.target.value) || 1)))}
        />
        <Champ
          id={`${champId}-theme`}
          label="Thème (facultatif)"
          placeholder="entretien d'embauche, cuisine…"
          value={theme}
          onChange={e => setTheme(e.target.value)}
        />
      </div>

      {resultat?.niveau && (
        <Texte petit doux>
          Consigne calée sur {resultat.niveau.code} ({resultat.niveau.heures} h cumulées)
          {resultat.motsConnus > 0 && ` · ${resultat.motsConnus} entrées déjà dans le paquet`}.
        </Texte>
      )}

      {resultat?.cartes?.length > 0 && (
        <div className="langue-apercu">
          {resultat.cartes.map((c, i) => (
            <div className="langue-apercu__carte" key={`${c.recto}-${i}`}>
              <span className="langue-apercu__recto">{c.recto}</span>
              <span className="langue-apercu__verso">{c.verso}</span>
            </div>
          ))}
        </div>
      )}

      {consigne && (
        <div className="langue-reglages__groupe">
          <div className="langue-reglages__legende">1 · Consigne à coller dans ta conversation</div>
          <Texte petit doux>
            Calée sur {consigne.niveau.code}
            {consigne.exclusions.transmises > 0 && `, ${consigne.exclusions.transmises} mots déjà connus exclus`}
            {consigne.ankiFerme && ' — Anki étant fermé, la liste des mots connus est absente'}.
          </Texte>
          <textarea
            className="el-champ langue-consigne"
            readOnly
            rows={8}
            value={consigne.texte}
            aria-label="Consigne de génération"
          />
          <Rang>
            <Bouton onClick={copier}>Copier la consigne</Bouton>
          </Rang>

          <div className="langue-reglages__legende">2 · Réponse à recoller ici</div>
          <Texte petit doux>
            Les doublons seront écartés avant l’envoi dans « {langue.vocabulaire.deckAnki} ».
          </Texte>
          <label className="el-etiquette" htmlFor={`${champId}-colle`}>
            Réponse de ta conversation
          </label>
          <textarea
            id={`${champId}-colle`}
            className="el-champ langue-consigne"
            rows={5}
            placeholder='[{"recto": "…", "verso": "…"}, …]'
            value={colle}
            onChange={e => setColle(e.target.value)}
          />
          <Rang>
            <Bouton variante="fantome" onClick={onFermer}>Fermer</Bouton>
            <Espace />
            <Bouton variante="primaire" disabled={enCours || !colle.trim()} onClick={importer}>
              {enCours ? 'Envoi…' : 'Envoyer dans Anki'}
            </Bouton>
          </Rang>
        </div>
      )}

      {!consigne && (
        <Rang>
          <Espace />
          <Bouton variante="fantome" onClick={onFermer}>Fermer</Bouton>
          <Bouton variante="primaire" onClick={recupererConsigne}>Préparer la consigne</Bouton>
        </Rang>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Page */

export default function LanguesPage() {
  const { config, setConfig, addHistoriqueEntry, fetchOrchestrator } = useStore();
  const { toast } = useToast();

  const [etats, setEtats] = useState([]);
  const [livres, setLivres] = useState([]);
  const [referentiel, setReferentiel] = useState(null);
  const [enEdition, setEnEdition] = useState(null);
  const [enGeneration, setEnGeneration] = useState(null);
  const [aSupprimer, setASupprimer] = useState(null);

  const langues = useMemo(() => (Array.isArray(config.langues) ? config.langues : []), [config.langues]);

  // La signature suffit à déclencher un rafraîchissement : comparer les objets
  // relancerait la requête à chaque rendu, Zustand renvoyant un tableau neuf.
  const signature = useMemo(() => JSON.stringify(langues), [langues]);

  const rafraichirEtat = useCallback(async () => {
    try {
      const reponse = await fetch(`${getApiUrl()}/langues/etat`);
      if (!reponse.ok) return;
      const data = await reponse.json();
      setEtats(data.langues || []);
    } catch (e) {
      logger.error('État des langues', e);
    }
  }, []);

  useEffect(() => {
    // L'enregistrement de la configuration est différé de 500 ms côté store :
    // sans ce délai, on interrogerait le serveur avant qu'il ait reçu la
    // modification et l'affichage reculerait d'un cran à chaque réglage.
    const minuteur = setTimeout(rafraichirEtat, 700);
    return () => clearTimeout(minuteur);
  }, [signature, rafraichirEtat]);

  useEffect(() => {
    fetch(`${getApiUrl()}/langues/livres`)
      .then(r => (r.ok ? r.json() : { livres: [] }))
      .then(d => setLivres(d.livres || []))
      .catch(e => logger.error('Livres disponibles', e));

    fetch(`${getApiUrl()}/langues/referentiel`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => d && setReferentiel(d))
      .catch(e => logger.error('Référentiel de niveau', e));
  }, []);

  const enregistrerLangues = useCallback((liste) => {
    setConfig({ ...config, langues: liste });
  }, [config, setConfig]);

  /* ---------------------------------------------------------- Actions */

  const enregistrerLangue = (langue) => {
    const existe = langues.some(l => l.id === langue.id);
    enregistrerLangues(existe ? langues.map(l => (l.id === langue.id ? langue : l)) : [...langues, langue]);
    setEnEdition(null);
    toast.success(existe ? `${langue.nom} mis à jour.` : `${langue.nom} ajouté.`);
  };

  const supprimerLangue = (langue) => {
    enregistrerLangues(langues.filter(l => l.id !== langue.id));
    setASupprimer(null);
    toast.success(`${langue.nom} retiré.`);
  };

  /**
   * Enregistre une séance.
   *
   * L'état local est marqué aussitôt — le serveur ne verra la pratique qu'une
   * fois la configuration enregistrée — puis le rapport de l'orchestrateur est
   * redemandé pour que la tâche disparaisse de la Session du Jour.
   */
  const marquerPratique = (langue, cle) => {
    const aujourdhui = getTodayStr();
    const misAJour = {
      ...langue,
      dernieresPratiques: { ...langue.dernieresPratiques, [cle]: aujourdhui },
    };
    enregistrerLangues(langues.map(l => (l.id === langue.id ? misAJour : l)));

    setEtats(prev => prev.map(e => (e.id !== langue.id ? e : {
      ...e,
      propose: null,
      pratiqueAujourdhui: true,
      volets: e.volets.map(v => (v.cle === cle
        ? { ...v, faitAujourdhui: true, derniere: aujourdhui, joursDepuis: 0, dette: 0, du: false }
        : v)),
    })));

    addHistoriqueEntry({
      type: 'LANGUE',
      titre: LIBELLES_VOLETS[cle],
      matiere: langue.nom,
      action: 'Terminé',
      dureeMinutes: langue[cle]?.dureeMinutes || 20,
    });

    toast.success(`${LIBELLES_VOLETS[cle]} — ${langue.nom} : séance enregistrée.`);
    setTimeout(() => { fetchOrchestrator?.(); rafraichirEtat(); }, 900);
  };

  const reviserAnki = async (langue) => {
    try {
      const reponse = await fetch(`${getApiUrl()}/langues/anki/reviser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deck: langue.vocabulaire.deckAnki }),
      });
      const data = await reponse.json();
      if (reponse.ok) return toast.success(data.message);

      if (data.ankiFerme) {
        await fetch(`${getApiUrl()}/open/anki`, { method: 'POST' });
        toast.info("Anki n'était pas lancé — il s'ouvre, réessaie dans un instant.");
        return;
      }
      toast.error(data.error || "Anki n'a pas répondu.");
    } catch (e) {
      logger.error('Révision Anki', e);
      toast.error("Serveur injoignable.");
    }
  };

  const ouvrirLivre = async (fichier) => {
    try {
      const reponse = await fetch(`${getApiUrl()}/langues/livre/ouvrir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fichier }),
      });
      const data = await reponse.json();
      if (!reponse.ok) return toast.error(data.error || "Le livre n'a pas pu être ouvert.");
      toast.success(data.message);
    } catch (e) {
      logger.error('Ouverture du livre', e);
      toast.error("Serveur injoignable.");
    }
  };

  /* ------------------------------------------------------------ Rendu */

  return (
    <div className="langues-page">
      <Rang entre>
        <div>
          <TitrePage>Langues</TitrePage>
          <Texte doux>
            Sans examen pour les réclamer, les langues ne se planifient pas à l’urgence mais à la
            régularité : tu fixes une cadence, ELPIS choisit le volet à travailler et le glisse
            dans la Session du Jour quand il reste du temps.
          </Texte>
        </div>
        <Bouton variante="primaire" onClick={() => setEnEdition(langueVierge())}>
          + Ajouter une langue
        </Bouton>
      </Rang>

      {langues.length === 0 ? (
        <EtatVide
          icone="🗣️"
          titre="Aucune langue déclarée"
          texte="Déclare la première : son nom, la cadence que tu peux tenir, et les liens ou le deck qui servent à la travailler."
          actions={<Bouton variante="primaire" onClick={() => setEnEdition(langueVierge())}>Ajouter une langue</Bouton>}
        />
      ) : (
        langues.map(langue => {
          const etat = etats.find(e => e.id === langue.id);
          const regularite = etat?.regularite;
          const niveau = etat?.niveau;

          return (
            <Carte
              key={langue.id}
              className={`langue-carte${langue.actif === false ? ' langue-carte--inactive' : ''}`}
              liseré="var(--type-langue)"
            >
              <div className="langue-entete">
                <span className="langue-entete__drapeau" aria-hidden="true">{langue.drapeau || '🌍'}</span>
                <div>
                  <TitreCarte className="langue-entete__nom">{langue.nom}</TitreCarte>
                  <div className="langue-entete__cadence">
                    {langue.cadence} séance{langue.cadence > 1 ? 's' : ''} par semaine
                    {langue.actif === false && ' · en pause'}
                  </div>
                </div>

                {etat?.propose && <Pastille ton="langue">À faire : {LIBELLES_VOLETS[etat.propose]}</Pastille>}
                {etat?.pratiqueAujourdhui && <Pastille ton="succes">Séance faite</Pastille>}
                {etat && !etat.propose && !etat.pratiqueAujourdhui && etat.configuree && (
                  <Pastille ton="succes">À jour</Pastille>
                )}
                {etat && !etat.configuree && <Pastille ton="attention">À configurer</Pastille>}

                <Espace />

                {niveau && (
                  <div className="langue-niveau" title={`Catégorie ${niveau.categorie} — échelle étirée ×${niveau.facteur}`}>
                    <div className="langue-niveau__code">
                      {niveau.code}
                      {niveau.impose && <span className="langue-niveau__marque" title="Niveau imposé">·</span>}
                    </div>
                    <div className="langue-niveau__detail">
                      {niveau.heures} h
                      {niveau.codeSuivant && ` · ${niveau.heuresRestantes} h avant ${niveau.codeSuivant}`}
                    </div>
                    {niveau.codeSuivant && (
                      <Jauge
                        valeur={niveau.progression * 100}
                        ton="langue"
                        libelle={`Progression de ${langue.nom} vers ${niveau.codeSuivant} : ${Math.round(niveau.progression * 100)} %`}
                      />
                    )}
                  </div>
                )}

                {regularite && (
                  <div className="langue-regularite">
                    <div className="langue-regularite__ligne">
                      <span>Régularité sur {regularite.fenetre} j</span>
                      <span>{regularite.tenu} / {regularite.vise}</span>
                    </div>
                    <Jauge
                      valeur={regularite.tenu}
                      max={Math.max(1, regularite.vise)}
                      ton={regularite.tenu >= regularite.vise ? 'succes' : undefined}
                      libelle={`Régularité de ${langue.nom} : ${regularite.tenu} jours sur ${regularite.vise} visés`}
                    />
                  </div>
                )}

                <BoutonIcone libelle={`Réglages de ${langue.nom}`} onClick={() => setEnEdition(langue)}>⚙️</BoutonIcone>
                <BoutonIcone libelle={`Retirer ${langue.nom}`} danger onClick={() => setASupprimer(langue)}>🗑️</BoutonIcone>
              </div>

              <div className="langue-volets">
                {CLES_VOLETS.map(cle => (
                  <Volet
                    key={cle}
                    langue={langue}
                    cle={cle}
                    etat={etat}
                    propose={etat?.propose === cle}
                    onPratique={marquerPratique}
                    onGenerer={setEnGeneration}
                    onReviser={reviserAnki}
                    onLivre={ouvrirLivre}
                    toast={toast}
                  />
                ))}
              </div>
            </Carte>
          );
        })
      )}

      <Modale
        ouverte={Boolean(enEdition)}
        onFermer={() => setEnEdition(null)}
        titre={enEdition && langues.some(l => l.id === enEdition.id) ? `Réglages — ${enEdition.nom}` : 'Nouvelle langue'}
        largeur={640}
      >
        {enEdition && (
          <ReglagesLangue
            langue={enEdition}
            livres={livres}
            referentiel={referentiel}
            onEnregistrer={enregistrerLangue}
            onFermer={() => setEnEdition(null)}
          />
        )}
      </Modale>

      <Modale
        ouverte={Boolean(enGeneration)}
        onFermer={() => setEnGeneration(null)}
        titre={enGeneration ? `Vocabulaire — ${enGeneration.nom}` : ''}
        largeur={640}
      >
        {enGeneration && (
          <GenerationVocabulaire
            langue={enGeneration}
            onFermer={() => setEnGeneration(null)}
            toast={toast}
          />
        )}
      </Modale>

      <ConfirmModal
        isOpen={Boolean(aSupprimer)}
        title="Retirer cette langue"
        message={aSupprimer
          ? `Retirer ${aSupprimer.nom} ? Les séances déjà enregistrées restent dans l'historique.`
          : ''}
        confirmLabel="Retirer"
        danger
        onConfirm={() => supprimerLangue(aSupprimer)}
        onCancel={() => setASupprimer(null)}
      />
    </div>
  );
}
