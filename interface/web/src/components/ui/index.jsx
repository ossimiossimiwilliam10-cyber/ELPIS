/**
 * ELPIS — Briques d'interface
 *
 * Ces composants remplacent les styles écrits à la main dans les pages.
 * L'audit de départ comptait 1133 attributs `style` inline, 12 rayons de bordure
 * différents et 250 couleurs codées en dur qui ne suivaient aucun thème.
 *
 * Chaque brique s'appuie sur les classes de `styles/primitives.css`, donc
 * uniquement sur des jetons : changer un thème traverse toute l'application.
 */

export { default as Modale } from './Modale';

/** Assemble des classes en ignorant les valeurs vides. */
const cx = (...classes) => classes.filter(Boolean).join(' ');

/* ---------------------------------------------------------------- Surfaces */

/**
 * Carte — conteneur de contenu.
 * @param {'defaut'|'compacte'|'plate'} variante
 * @param {boolean} interactive  ajoute le retour visuel au survol
 * @param {string}  liseré       couleur du liseré latéral (jeton CSS)
 */
export function Carte({ variante = 'defaut', interactive, liseré, className, style, children, ...props }) {
  return (
    <div
      className={cx(
        'el-carte',
        variante === 'compacte' && 'el-carte--compacte',
        variante === 'plate' && 'el-carte--plate',
        interactive && 'el-carte--interactive',
        liseré && 'el-carte--liseree',
        className
      )}
      style={liseré ? { '--liseré': liseré, ...style } : style}
      {...props}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------ Dispositions */

/** Empilement vertical régulier. */
export function Pile({ espace = 'normal', className, children, ...props }) {
  return (
    <div className={cx('el-pile', espace === 'serre' && 'el-pile--serree', espace === 'large' && 'el-pile--large', className)} {...props}>
      {children}
    </div>
  );
}

/** Alignement horizontal, passe à la ligne sur petit écran. */
export function Rang({ entre, haut, serre, className, children, ...props }) {
  return (
    <div className={cx('el-rang', entre && 'el-rang--entre', haut && 'el-rang--haut', serre && 'el-rang--serre', className)} {...props}>
      {children}
    </div>
  );
}

/** Grille fluide : le nombre de colonnes s'adapte à la largeur disponible. */
export function Grille({ taille = 'normale', className, children, ...props }) {
  return (
    <div className={cx('el-grille', taille === 'etroite' && 'el-grille--etroite', taille === 'large' && 'el-grille--large', className)} {...props}>
      {children}
    </div>
  );
}

/** Pousse les éléments suivants vers la fin de la ligne. */
export const Espace = () => <div className="el-espace" />;

/* ------------------------------------------------------------ Typographie */

export const TitrePage = ({ className, children, ...p }) => <h1 className={cx('el-titre-page', className)} {...p}>{children}</h1>;
export const TitreSection = ({ className, children, ...p }) => <h2 className={cx('el-titre-section', className)} {...p}>{children}</h2>;
export const TitreCarte = ({ className, children, ...p }) => <h3 className={cx('el-titre-carte', className)} {...p}>{children}</h3>;
export const Surtitre = ({ className, children, ...p }) => <div className={cx('el-surtitre', className)} {...p}>{children}</div>;
export const Chiffre = ({ className, children, ...p }) => <div className={cx('el-chiffre', className)} {...p}>{children}</div>;

export function Texte({ doux, petit, mention, className, children, ...props }) {
  return (
    <p className={cx('el-texte', doux && 'el-texte--doux', petit && 'el-texte--petit', mention && 'el-texte--mention', className)} {...props}>
      {children}
    </p>
  );
}

/* ---------------------------------------------------------------- Boutons */

/**
 * Bouton d'action.
 * @param {'primaire'|'secondaire'|'fantome'|'danger'} variante
 */
export function Bouton({ variante = 'secondaire', grand, pleineLargeur, className, children, ...props }) {
  return (
    <button
      type="button"
      className={cx('el-bouton', `el-bouton--${variante}`, grand && 'el-bouton--grand', pleineLargeur && 'el-bouton--pleine-largeur', className)}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Bouton réduit à une icône.
 * `libelle` est obligatoire : sans lui, un lecteur d'écran annonce l'emoji seul.
 */
export function BoutonIcone({ libelle, danger, className, children, ...props }) {
  return (
    <button
      type="button"
      className={cx('el-bouton-icone', danger && 'el-bouton-icone--danger', className)}
      aria-label={libelle}
      title={libelle}
      {...props}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}

/* -------------------------------------------------------------- Pastilles */

/** Étiquette courte. `ton` accepte un état ou un type d'activité (cm, td, tp…). */
export function Pastille({ ton, className, children, ...props }) {
  return (
    <span className={cx('el-pastille', ton && `el-pastille--${ton}`, className)} {...props}>
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- Champs */

/** Champ de formulaire avec son étiquette liée et son texte d'aide. */
export function Champ({ id, label, aide, erreur, className, ...props }) {
  return (
    <div>
      {label && <label className="el-etiquette" htmlFor={id}>{label}</label>}
      <input
        id={id}
        className={cx('el-champ', className)}
        aria-describedby={aide || erreur ? `${id}-aide` : undefined}
        aria-invalid={erreur ? 'true' : undefined}
        {...props}
      />
      {(aide || erreur) && (
        <div id={`${id}-aide`} className="el-aide" style={erreur ? { color: 'var(--danger)' } : undefined}>
          {erreur || aide}
        </div>
      )}
    </div>
  );
}

/** Liste déroulante avec étiquette liée. */
export function Selection({ id, label, aide, className, children, ...props }) {
  return (
    <div>
      {label && <label className="el-etiquette" htmlFor={id}>{label}</label>}
      <select id={id} className={cx('el-champ', className)} {...props}>{children}</select>
      {aide && <div className="el-aide">{aide}</div>}
    </div>
  );
}

/* ------------------------------------------------------------ Progression */

/**
 * Barre de progression annoncée aux lecteurs d'écran.
 * @param {number} valeur  entre 0 et `max`
 */
export function Jauge({ valeur, max = 100, ton, libelle, className }) {
  const pourcent = max > 0 ? Math.min(100, Math.max(0, (valeur / max) * 100)) : 0;
  return (
    <div
      className={cx('el-jauge', className)}
      role="progressbar"
      aria-valuenow={Math.round(valeur)}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-label={libelle}
    >
      <div
        className={cx('el-jauge__remplissage', ton && `el-jauge__remplissage--${ton}`)}
        style={{ width: `${pourcent}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------- État vide */

/**
 * Écran affiché quand il n'y a rien à montrer.
 * Dit toujours ce qui manque *et* propose l'action qui y remédie : un écran
 * vide sans issue laisse l'utilisateur sans indice sur la marche à suivre.
 */
export function EtatVide({ icone, titre, texte, actions, className }) {
  return (
    <div className={cx('el-vide', className)}>
      {icone && <div className="el-vide__icone" aria-hidden="true">{icone}</div>}
      <h3 className="el-vide__titre">{titre}</h3>
      {texte && <p className="el-vide__texte">{texte}</p>}
      {actions && <div className="el-vide__actions">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------- Indicateur */

/** Tuile de chiffre clé : valeur mise en avant, libellé en dessous. */
export function Tuile({ valeur, libelle, ton, indice, className }) {
  return (
    <Carte variante="compacte" className={cx(className)} style={{ textAlign: 'center' }}>
      <Chiffre style={ton ? { color: `var(--${ton})` } : undefined}>{valeur}</Chiffre>
      <div className="el-texte--mention" style={{ marginTop: 'var(--esp-2)' }}>{libelle}</div>
      {indice && <div className="el-texte--mention" style={{ marginTop: 'var(--esp-1)', opacity: 0.75 }}>{indice}</div>}
    </Carte>
  );
}

/* ------------------------------------------------------------ Séparateur */

export const Trait = ({ className }) => <hr className={cx('el-trait', className)} />;

/** Texte réservé aux lecteurs d'écran. */
export const LecteurSeul = ({ children }) => <span className="el-lecteur-seul">{children}</span>;

/* ---------------------------------------------------- Correspondances utiles */

/** Jeton de couleur associé à un type d'activité. */
export const couleurType = (type) => ({
  CM: 'var(--type-cm)',
  TD: 'var(--type-td)',
  TP: 'var(--type-tp)',
  ANNALE: 'var(--type-annale)',
  ANKI: 'var(--type-anki)',
  PROJET: 'var(--type-projet)',
  LANGUE: 'var(--type-langue)',
}[type] || 'var(--accent)');

/** Suffixe de classe de pastille associé à un type d'activité. */
export const tonType = (type) => ({
  CM: 'cm', TD: 'td', TP: 'tp', ANNALE: 'annale', ANKI: 'anki', PROJET: 'projet', LANGUE: 'langue',
}[type]);
