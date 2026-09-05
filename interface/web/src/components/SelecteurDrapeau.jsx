import { useMemo } from 'react';

/**
 * Choisir le drapeau d'une langue, sans avoir à taper un émoji.
 *
 * Le champ était une case de texte de quatre caractères : sur un téléphone le
 * clavier propose les émoji, mais sur un ordinateur il faut connaître un
 * raccourci système pour produire 🇯🇵. Le symbole restait donc au globe par
 * défaut, faute de moyen commode d'en mettre un autre.
 *
 * La liste ci-dessous n'a pas vocation à couvrir le monde : elle couvre les
 * langues qu'on étudie. Un symbole déjà enregistré qui n'y figure pas est
 * ajouté en tête, pour qu'aucune saisie existante ne devienne inatteignable.
 */

const DRAPEAUX = [
  { symbole: '🇬🇧', nom: 'Anglais' },
  { symbole: '🇺🇸', nom: 'Anglais (États-Unis)' },
  { symbole: '🇪🇸', nom: 'Espagnol' },
  { symbole: '🇩🇪', nom: 'Allemand' },
  { symbole: '🇮🇹', nom: 'Italien' },
  { symbole: '🇵🇹', nom: 'Portugais' },
  { symbole: '🇧🇷', nom: 'Portugais (Brésil)' },
  { symbole: '🇳🇱', nom: 'Néerlandais' },
  { symbole: '🇷🇺', nom: 'Russe' },
  { symbole: '🇺🇦', nom: 'Ukrainien' },
  { symbole: '🇵🇱', nom: 'Polonais' },
  { symbole: '🇨🇿', nom: 'Tchèque' },
  { symbole: '🇭🇺', nom: 'Hongrois' },
  { symbole: '🇷🇴', nom: 'Roumain' },
  { symbole: '🇸🇪', nom: 'Suédois' },
  { symbole: '🇳🇴', nom: 'Norvégien' },
  { symbole: '🇩🇰', nom: 'Danois' },
  { symbole: '🇫🇮', nom: 'Finnois' },
  { symbole: '🇬🇷', nom: 'Grec' },
  { symbole: '🇹🇷', nom: 'Turc' },
  { symbole: '🇸🇦', nom: 'Arabe' },
  { symbole: '🇮🇱', nom: 'Hébreu' },
  { symbole: '🇮🇷', nom: 'Persan' },
  { symbole: '🇯🇵', nom: 'Japonais' },
  { symbole: '🇨🇳', nom: 'Chinois' },
  { symbole: '🇰🇷', nom: 'Coréen' },
  { symbole: '🇮🇳', nom: 'Hindi' },
  { symbole: '🇻🇳', nom: 'Vietnamien' },
  { symbole: '🇹🇭', nom: 'Thaï' },
  { symbole: '🇮🇩', nom: 'Indonésien' },
  { symbole: '🇫🇷', nom: 'Français' },
  { symbole: '🇪🇺', nom: 'Europe' },
  { symbole: '🌍', nom: 'Autre' },
];

export default function SelecteurDrapeau({ id, label = 'Symbole', valeur, onChoisir }) {
  const choix = useMemo(() => {
    const courant = String(valeur || '').trim();
    if (!courant || DRAPEAUX.some(d => d.symbole === courant)) return DRAPEAUX;
    // Un symbole saisi autrefois, ou venu d'un autre appareil : il reste
    // sélectionnable plutôt que d'être silencieusement perdu au premier clic.
    return [{ symbole: courant, nom: 'Symbole enregistré' }, ...DRAPEAUX];
  }, [valeur]);

  return (
    <div className="selecteur-drapeau">
      <span className="el-etiquette" id={`${id}-label`}>{label}</span>
      <div
        className="selecteur-drapeau__grille"
        role="radiogroup"
        aria-labelledby={`${id}-label`}
      >
        {choix.map(({ symbole, nom }) => {
          const actif = symbole === valeur;
          return (
            <button
              key={symbole}
              type="button"
              role="radio"
              aria-checked={actif}
              aria-label={nom}
              title={nom}
              className={`selecteur-drapeau__choix${actif ? ' selecteur-drapeau__choix--actif' : ''}`}
              onClick={() => onChoisir(symbole)}
            >
              <span aria-hidden="true">{symbole}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
