/**
 * Vrai si l'application tourne dans l'enveloppe Android plutôt que dans un
 * navigateur pointé sur le serveur.
 *
 * La distinction est décisive : servie par le bridge, l'application atteint
 * l'API par une adresse relative. Empaquetée dans l'application Android, elle
 * est servie depuis `http://localhost` par la WebView, où `/api` ne mène nulle
 * part. Sans adresse renseignée, elle est donc muette — et il vaut mieux le
 * dire que laisser l'utilisateur devant des écrans de chargement perpétuels.
 */
export const estApplicationNative = () => {
  try {
    return Boolean(globalThis.Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
};

/** Vrai quand l'application native n'a pas encore d'adresse de serveur. */
export const serveurNonConfigure = () =>
  estApplicationNative() && !(localStorage.getItem('serverIp') || '').trim();

export const getApiUrl = () => {
  const customIp = localStorage.getItem('serverIp');
  if (customIp && customIp.trim() !== '') {
    return `http://${customIp.trim()}:3001/api`;
  }
  return '/api';
};

export const getServerUrl = () => {
  const customIp = localStorage.getItem('serverIp');
  if (customIp && customIp.trim() !== '') {
    return `http://${customIp.trim()}:3001`;
  }
  return '';
};

/**
 * Adresse complète d'un document rattaché à un cours.
 *
 * L'envoi d'un PDF renvoie un chemin relatif (`/api/documents/…`). Servi par le
 * bridge, ce chemin suffit. Dans l'application Android, la WebView est servie
 * depuis `http://localhost` : le même chemin y désigne le téléphone lui-même,
 * où rien n'est stocké, et le bouton « Ouvrir le document » n'ouvrait qu'une
 * page vide.
 *
 * Rien n'a besoin d'être recopié sur le téléphone : le PC sert déjà ces
 * fichiers. Il lui manquait seulement de savoir à quelle adresse les demander —
 * celle-là même qui sert pour l’API.
 *
 * Corollaire à connaître : le PC doit être allumé et joignable. Hors de portée,
 * le document ne peut pas être ouvert.
 */
export const urlDocument = (chemin) => {
  if (!chemin) return '';
  // Une adresse déjà complète (ancien enregistrement, lien externe) est gardée telle quelle.
  if (/^[a-z][a-z0-9+.-]*:/i.test(chemin)) return chemin;
  return `${getServerUrl()}${chemin.startsWith('/') ? '' : '/'}${chemin}`;
};

export const setApiUrl = (ip) => {
  localStorage.setItem('serverIp', ip);
};

export const getRawIp = () => {
  return localStorage.getItem('serverIp') || '';
};
