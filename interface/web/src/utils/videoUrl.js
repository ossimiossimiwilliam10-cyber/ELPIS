/**
 * Analyse des liens vidéo saisis par l'utilisateur.
 */

/**
 * Vrai si l'adresse peut être ouverte sans danger.
 *
 * Un champ `type="url"` accepte n'importe quel schéma, `javascript:` compris :
 * ouvrir une telle adresse exécuterait le script dans le contexte de l'app.
 */
export function estUrlSure(url) {
  try {
    const protocole = new URL(String(url).trim()).protocol;
    return protocole === 'http:' || protocole === 'https:';
  } catch {
    return false;
  }
}

/**
 * Identifiant d'une vidéo YouTube, quelle que soit la forme du lien
 * (watch, youtu.be, embed, shorts, live), ou null si ce n'en est pas une.
 */
export function extraireIdYoutube(url) {
  if (!estUrlSure(url)) return null;

  let adresse;
  try {
    adresse = new URL(String(url).trim());
  } catch {
    return null;
  }

  const hote = adresse.hostname.replace(/^www\./, '').toLowerCase();
  const valide = (id) => (/^[\w-]{11}$/.test(id || '') ? id : null);

  if (hote === 'youtu.be') {
    return valide(adresse.pathname.slice(1).split('/')[0]);
  }

  if (hote === 'youtube.com' || hote === 'm.youtube.com' || hote === 'music.youtube.com') {
    if (adresse.pathname === '/watch') return valide(adresse.searchParams.get('v'));

    const segments = adresse.pathname.split('/').filter(Boolean);
    if (['embed', 'shorts', 'live', 'v'].includes(segments[0])) {
      return valide(segments[1]);
    }
  }

  return null;
}

/** Miniature d'une vidéo YouTube, ou null si le lien n'en est pas une. */
export function miniatureYoutube(url) {
  const id = extraireIdYoutube(url);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
}

/** Nom d'hôte lisible, pour situer un lien qui n'est pas une vidéo YouTube. */
export function hoteLisible(url) {
  try {
    return new URL(String(url).trim()).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
