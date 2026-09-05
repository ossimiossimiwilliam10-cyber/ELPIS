import { urlDocument, getApiUrl } from './apiConfig';

/**
 * Copie locale des documents de cours, pour les lire sans le PC.
 *
 * Les PDF vivent sur le PC, dans `<projet>/documents/`, servis par le bridge.
 * La synchronisation ne transporte que du JSON : le téléphone n'en recevait
 * aucun. Tant que le PC est joignable, il suffit de les demander par le réseau
 * — mais dans le train, PC éteint, le cours est inaccessible.
 *
 * Les fichiers sont donc recopiés dans le cache du navigateur (API Cache,
 * disponible aussi bien dans le navigateur du PC que dans la WebView Android).
 * Deux propriétés rendent la chose simple :
 *
 * - le serveur nomme chaque envoi `doc-<horodatage>-<aléa>.<ext>`, donc un
 *   document remplacé reçoit une adresse neuve : un cache indexé par adresse
 *   n'a jamais besoin d'être invalidé, seulement purgé de ce qui n'est plus
 *   référencé ;
 * - un document absent du cache reste lisible par le réseau, tant que le PC
 *   répond. Le cache accélère et permet le hors-ligne, il ne conditionne rien.
 */

export const NOM_CACHE = 'elpis-documents-v1';

/** Vrai si le navigateur expose l'API Cache (absente de jsdom, par exemple). */
export const cacheDisponible = () => {
  try {
    return typeof globalThis.caches?.open === 'function';
  } catch {
    return false;
  }
};

const ouvrir = () => globalThis.caches.open(NOM_CACHE);

/** Tous les documents rattachés à un élément, l'ancien champ unique inclus. */
const documentsDe = (element) => {
  const liste = Array.isArray(element?.pdfPaths) ? [...element.pdfPaths] : [];
  if (element?.pdfPath && !liste.includes(element.pdfPath)) liste.unshift(element.pdfPath);
  return liste.filter(c => typeof c === 'string' && c.trim() !== '');
};

/**
 * Chemins de tous les documents du cursus, sans doublon et dans un ordre stable.
 *
 * Une matière porte ses propres documents, et chacun de ses cours, TD, TP et
 * annales peut porter les siens.
 */
export function cheminsDocuments(coursConfig) {
  const vus = new Set();
  const ajouter = (element) => {
    for (const chemin of documentsDe(element)) vus.add(chemin);
  };

  for (const licence of (coursConfig?.licences || [])) {
    for (const semestre of (licence?.semestres || [])) {
      for (const ue of (semestre?.ues || [])) {
        for (const matiere of (ue?.matieres || [])) {
          ajouter(matiere);
          for (const cle of ['listeCM', 'listeTD', 'listeTP', 'listeAnnales']) {
            for (const item of (matiere?.[cle] || [])) ajouter(item);
          }
        }
      }
    }
  }

  return [...vus];
}

/** Chemins déjà présents dans le cache local. */
export async function cheminsEnCache() {
  if (!cacheDisponible()) return [];
  const cache = await ouvrir();
  const requetes = await cache.keys();
  return requetes.map(r => r.url);
}

/**
 * État de la copie locale : combien de documents, et quelle place ils occupent.
 * La taille est lue dans les réponses stockées ; celles qui ne l'annoncent pas
 * sont mesurées, ce qui reste peu coûteux sur quelques dizaines de fichiers.
 */
export async function etatDocuments() {
  if (!cacheDisponible()) return { nombre: 0, octets: 0, disponible: false };

  const cache = await ouvrir();
  const requetes = await cache.keys();
  let octets = 0;

  for (const requete of requetes) {
    const reponse = await cache.match(requete);
    if (!reponse) continue;
    const annonce = Number(reponse.headers.get('content-length'));
    if (Number.isFinite(annonce) && annonce > 0) {
      octets += annonce;
    } else {
      try {
        octets += (await reponse.clone().blob()).size;
      } catch {
        /* Une réponse illisible ne doit pas faire échouer le décompte. */
      }
    }
  }

  return { nombre: requetes.length, octets, disponible: true };
}

/**
 * Met la copie locale à jour : télécharge ce qui manque, retire ce qui n'est
 * plus référencé par le cursus.
 *
 * Un document qui refuse de se télécharger n'interrompt pas les autres — mieux
 * vaut neuf cours sur dix hors ligne qu'un échec global. Le compte rendu dit
 * lesquels ont échoué.
 */
export async function synchroniserDocuments(chemins, { onProgress, signal } = {}) {
  if (!cacheDisponible()) {
    return { telecharges: 0, purges: 0, echecs: [], disponible: false };
  }

  const cache = await ouvrir();
  const voulus = new Map(chemins.map(c => [new Request(urlDocument(c)).url, c]));

  // Purge d'abord : la place libérée profite aux téléchargements qui suivent.
  let purges = 0;
  for (const requete of await cache.keys()) {
    if (!voulus.has(requete.url)) {
      if (await cache.delete(requete)) purges++;
    }
  }

  const dejaLa = new Set((await cache.keys()).map(r => r.url));
  const aFaire = [...voulus.entries()].filter(([url]) => !dejaLa.has(url));

  let telecharges = 0;
  const echecs = [];

  for (const [, chemin] of aFaire) {
    if (signal?.aborted) break;
    try {
      const reponse = await fetch(urlDocument(chemin), { signal });
      if (!reponse.ok) throw new Error(`réponse ${reponse.status}`);
      await cache.put(urlDocument(chemin), reponse);
      telecharges++;
    } catch (erreur) {
      if (signal?.aborted) break;
      /*
       * Le quota du navigateur est atteint : inutile de tenter les suivants,
       * ils échoueront tous. Mieux vaut s'arrêter et le dire.
       */
      if (erreur?.name === 'QuotaExceededError') {
        echecs.push({ chemin, raison: 'quota' });
        return { telecharges, purges, echecs, quotaAtteint: true, disponible: true };
      }
      echecs.push({ chemin, raison: erreur?.message || 'inconnue' });
    }
    onProgress?.({ faits: telecharges + echecs.length, total: aFaire.length, chemin });
  }

  return { telecharges, purges, echecs, disponible: true };
}

/**
 * Contenu d'un document, pris dans le cache local puis, à défaut, sur le PC.
 *
 * Renvoie `null` quand ni l'un ni l'autre ne répond — au lecteur d'expliquer
 * qu'il faut soit rallumer le PC, soit avoir téléchargé le document.
 */
export async function blobDocument(chemin) {
  if (!chemin) return null;
  const adresse = urlDocument(chemin);

  if (cacheDisponible()) {
    try {
      const cache = await ouvrir();
      const reponse = await cache.match(adresse);
      if (reponse) return await reponse.blob();
    } catch {
      /* Cache illisible : on tentera le réseau. */
    }
  }

  try {
    const reponse = await fetch(adresse);
    if (!reponse.ok) return null;
    return await reponse.blob();
  } catch {
    return null;
  }
}

/** Vrai si ce document est lisible sans le PC. */
export async function estHorsLigne(chemin) {
  if (!chemin || !cacheDisponible()) return false;
  try {
    const cache = await ouvrir();
    return Boolean(await cache.match(urlDocument(chemin)));
  } catch {
    return false;
  }
}

/** Efface toute la copie locale. */
export async function viderDocuments() {
  if (!cacheDisponible()) return false;
  return globalThis.caches.delete(NOM_CACHE);
}

/**
 * Poids annoncé par le PC pour une liste de documents, et place disponible sur
 * l'appareil.
 *
 * Un cursus fourni pèse plusieurs centaines de mégaoctets : proposer « copier
 * tes documents » sans ce chiffre revient à faire signer un chèque en blanc, et
 * le quota du navigateur peut refuser en cours de route.
 *
 * Renvoie `null` quand le PC ne répond pas — on ne bloque pas la copie pour
 * autant, on renonce seulement à annoncer son poids.
 */
export async function poidsAnnonce(chemins) {
  try {
    const reponse = await fetch(`${getApiUrl()}/documents-tailles`);
    if (!reponse.ok) return null;
    const { tailles } = await reponse.json();
    if (!tailles) return null;

    let octets = 0;
    let inconnus = 0;
    for (const chemin of chemins) {
      const nom = String(chemin).split('/').pop();
      if (Number.isFinite(tailles[nom])) octets += tailles[nom];
      else inconnus++;
    }
    return { octets, inconnus };
  } catch {
    return null;
  }
}

/** Place disponible pour les données du site, si le navigateur la connaît. */
export async function placeDisponible() {
  try {
    if (typeof navigator?.storage?.estimate !== 'function') return null;
    const { quota, usage } = await navigator.storage.estimate();
    if (!Number.isFinite(quota)) return null;
    return { quota, usage: usage || 0, libre: Math.max(0, quota - (usage || 0)) };
  } catch {
    return null;
  }
}

/** `1536000` → `1,5 Mo`. */
export function formaterOctets(octets) {
  const n = Number(octets) || 0;
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}
