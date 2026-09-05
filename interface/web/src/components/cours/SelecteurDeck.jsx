import { useEffect, useId, useMemo, useState } from 'react';
import { getApiUrl } from '../../utils/apiConfig';

/**
 * Rattachement d'un cours à un deck Anki.
 *
 * La déduction automatique par le nom ne peut pas fonctionner sur une
 * arborescence descendant jusqu'à la sous-section : rien ne permet de deviner
 * qu'un cours intitulé « Cours 1 » couvre « Chapitre 1 - Fondamentaux::I -
 * Dérivées ». Le rattachement se déclare donc explicitement, et la déduction
 * ne sert plus que de repli.
 *
 * Les decks sont chargés une seule fois puis partagés : cinquante-cinq entrées
 * rechargées à chaque cours afficherait autant d'appels à Anki.
 */

let cacheDecks = null;
let chargementEnCours = null;

/** Charge les decks Anki, une fois pour toute la session. */
function chargerDecks() {
  if (cacheDecks) return Promise.resolve(cacheDecks);
  if (chargementEnCours) return chargementEnCours;

  chargementEnCours = fetch(`${getApiUrl()}/anki/decks`)
    .then(r => r.json())
    .then(donnees => {
      if (!donnees.success) throw new Error(donnees.error || 'Anki injoignable.');
      cacheDecks = donnees.decks || [];
      return cacheDecks;
    })
    .finally(() => { chargementEnCours = null; });

  return chargementEnCours;
}

/** Vide le cache : utile après avoir réorganisé ses decks dans Anki. */
export function oublierDecks() {
  cacheDecks = null;
}

/** Profondeur d'un deck dans l'arborescence, pour l'indentation. */
const profondeur = (deck) => deck.split('::').length - 1;

/** Dernier segment d'un chemin de deck. */
const feuille = (deck) => deck.split('::').pop();

export default function SelecteurDeck({ valeur, onChanger, portee }) {
  // Un identifiant propre à chaque instance : plusieurs cours affichent leur
  // sélecteur côte à côte, et des identifiants partagés feraient pointer tous
  // les libellés vers le premier champ.
  const champId = useId();
  const [decks, setDecks] = useState(cacheDecks);
  const [erreur, setErreur] = useState(null);
  const [filtre, setFiltre] = useState('');

  useEffect(() => {
    if (decks) return;
    let vivant = true;
    chargerDecks()
      .then(liste => { if (vivant) setDecks(liste); })
      .catch(err => { if (vivant) setErreur(err.message); });
    return () => { vivant = false; };
  }, [decks]);

  /**
   * Decks proposés. Restreindre à la branche de la matière évite de faire
   * défiler tout le cursus pour rattacher un chapitre.
   */
  const proposes = useMemo(() => {
    let liste = decks || [];
    if (portee) {
      const prefixe = portee.toLowerCase();
      const dansLaBranche = liste.filter(d => d.toLowerCase().startsWith(prefixe));
      // Si la branche est vide, mieux vaut tout proposer que rien.
      if (dansLaBranche.length > 0) liste = dansLaBranche;
    }
    const terme = filtre.trim().toLowerCase();
    if (terme) liste = liste.filter(d => d.toLowerCase().includes(terme));
    return liste;
  }, [decks, portee, filtre]);

  if (erreur) {
    return <span className="deck-lien deck-lien--absent" title={erreur}>Anki injoignable</span>;
  }

  if (!decks) {
    return <span className="deck-lien deck-lien--absent">Chargement des decks…</span>;
  }

  return (
    <div className="deck-lien">
      <label className="deck-lien__etiquette" htmlFor={champId}>
        Chapitre Anki
      </label>

      {proposes.length > 12 && (
        <input
          type="search"
          className="el-champ deck-lien__filtre"
          placeholder="Filtrer…"
          aria-label="Filtrer les chapitres"
          value={filtre}
          onChange={e => setFiltre(e.target.value)}
        />
      )}

      <select
        id={champId}
        className="el-champ deck-lien__choix"
        value={valeur || ''}
        onChange={e => onChanger(e.target.value || null)}
      >
        <option value="">Aucun — déduction automatique</option>
        {proposes.map(deck => (
          <option key={deck} value={deck}>
            {'  '.repeat(profondeur(deck))}{feuille(deck)}
          </option>
        ))}
      </select>

      {valeur && !decks.includes(valeur) && (
        <span className="deck-lien__alerte" title={valeur}>
          Ce deck n'existe plus dans Anki.
        </span>
      )}
    </div>
  );
}
