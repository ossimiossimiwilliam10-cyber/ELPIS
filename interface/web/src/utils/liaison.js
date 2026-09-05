import { useState, useEffect, useCallback, useRef } from 'react';
import { getApiUrl, estApplicationNative, serveurNonConfigure } from './apiConfig';

/**
 * État de la liaison avec le PC.
 *
 * Le téléphone ne peut pas voir le câble USB : une page web n'a aucun accès au
 * bus. Mais elle n'en a pas besoin, car la question qui compte n'est pas
 * « le câble est-il branché ? » — c'est « le moteur du PC répond-il ? ».
 *
 * Les deux coïncident exactement dans le montage retenu. Le lanceur du PC
 * maintient une redirection `adb reverse tcp:3001 tcp:3001` tant qu'un appareil
 * est branché ; elle disparaît au débranchement. Interroger `/api/health`
 * répond donc à la vraie question, et à elle seule : câble en place *et* serveur
 * en marche *et* base ouverte. Un voyant qui dirait « câble détecté » alors que
 * le serveur est éteint ne servirait à rien.
 *
 * On sonde, on ne devine pas.
 */

/** Le serveur a ce délai pour répondre avant qu'on le considère absent. */
const DELAI_MS = 2500;

/** Rythme de vérification tant que l'écran concerné est affiché. */
const CADENCE_MS = 6000;

export const ETATS = {
  INCONNU: 'inconnu',
  JOIGNABLE: 'joignable',
  ABSENT: 'absent',
  NON_CONFIGURE: 'non-configure',
};

/**
 * Interroge le moteur une fois.
 * @returns {Promise<{etat: string, raison: string, versionMoteur: string|null}>}
 */
export async function sonderLiaison(signal) {
  if (serveurNonConfigure()) {
    return {
      etat: ETATS.NON_CONFIGURE,
      raison: "Aucune adresse de PC n’est renseignée.",
      versionMoteur: null,
    };
  }

  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_MS);
  // Un signal extérieur (démontage du composant) doit aussi interrompre.
  if (signal) signal.addEventListener('abort', () => controleur.abort(), { once: true });

  try {
    const reponse = await fetch(`${getApiUrl()}/health`, {
      signal: controleur.signal,
      cache: 'no-store',
    });
    if (!reponse.ok) {
      return { etat: ETATS.ABSENT, raison: `Le moteur a répondu ${reponse.status}.`, versionMoteur: null };
    }
    const corps = await reponse.json().catch(() => ({}));
    if (corps.db && corps.db !== 'connected') {
      return { etat: ETATS.ABSENT, raison: "Le moteur répond, mais sa base n’est pas ouverte.", versionMoteur: corps.version || null };
    }
    return { etat: ETATS.JOIGNABLE, raison: '', versionMoteur: corps.version || null };
  } catch {
    return {
      etat: ETATS.ABSENT,
      raison: estApplicationNative()
        ? "Le PC ne répond pas. Branche le câble USB et vérifie qu’ELPIS tourne sur le PC."
        : "Le moteur ne répond pas. Est-il lancé ?",
      versionMoteur: null,
    };
  } finally {
    clearTimeout(minuteur);
  }
}

/**
 * Suit l'état de la liaison tant que le composant est monté.
 *
 * La sonde repart aussi au retour au premier plan : c'est le moment où l'on
 * vient de brancher le câble, et attendre le prochain battement donnerait
 * l'impression que le bouton reste bloqué.
 */
export function useLiaison({ actif = true } = {}) {
  const [etat, setEtat] = useState({ etat: ETATS.INCONNU, raison: '', versionMoteur: null });
  const [verification, setVerification] = useState(false);
  const enCours = useRef(false);

  const verifier = useCallback(async () => {
    if (enCours.current) return;
    enCours.current = true;
    setVerification(true);
    try {
      setEtat(await sonderLiaison());
    } finally {
      enCours.current = false;
      setVerification(false);
    }
  }, []);

  useEffect(() => {
    if (!actif) return undefined;
    let vivant = true;

    const battre = () => { if (vivant) verifier(); };
    battre();

    const minuteur = setInterval(battre, CADENCE_MS);
    const auRetour = () => { if (document.visibilityState === 'visible') battre(); };
    document.addEventListener('visibilitychange', auRetour);
    window.addEventListener('focus', battre);
    window.addEventListener('online', battre);

    return () => {
      vivant = false;
      clearInterval(minuteur);
      document.removeEventListener('visibilitychange', auRetour);
      window.removeEventListener('focus', battre);
      window.removeEventListener('online', battre);
    };
  }, [actif, verifier]);

  return {
    ...etat,
    joignable: etat.etat === ETATS.JOIGNABLE,
    verification,
    verifier,
  };
}
