
/**
 * Le règlement des études, cité et non interprété.
 *
 * `data/reglement_etudes.md` existait depuis le début du projet et aucun code
 * ne le lisait : il n'avait servi qu'à être expédié à une API distante, avec le
 * cursus, à l'époque où le Répétiteur appelait un modèle. Les questions de règlement
 * — délai de justification, compensation, passage en L3 — tombaient donc dans
 * l'incompris, alors que la réponse dormait sur le disque.
 *
 * Ici, le Répétiteur change de registre, et le dit. Ailleurs il calcule sur les
 * données de l'étudiant ; ici il recopie un texte. Il ne combine pas les deux :
 * déduire « tu es donc défaillant » d'un article et d'une absence, c'est rendre
 * un avis de scolarité, ce qu'aucun programme ne devrait faire à la place du
 * jury. Chaque citation le rappelle.
 */

/*
 * Le système de fichiers n'est atteint qu'au moment de s'en servir.
 *
 * Ce module fait partie du moteur, et le moteur tourne aussi dans le navigateur
 * du téléphone, où `fs` n'existe pas : un `require('fs')` en tête de fichier
 * suffisait à empêcher tout le Répétiteur d'y être embarqué. Même procédé que
 * `rlEngine`, pour la même raison.
 *
 * Sur le téléphone il n'y a pas de disque à lire : le texte y est fourni par
 * `definirTexteReglement`, comme les données le sont par `stockage.js`. Un
 * règlement absent reste une absence déclarée — jamais un règlement approximatif.
 */
function accesFichiers() {
  try {
    // eslint-disable-next-line global-require
    return { fs: require('fs'), path: require('path') };
  } catch {
    return null;
  }
}

function cheminParDefaut() {
  const acces = accesFichiers();
  if (!acces || typeof __dirname === 'undefined') return null;
  return acces.path.resolve(__dirname, '..', '..', '..', '..', 'data', 'reglement_etudes.md');
}

const CHEMIN = cheminParDefaut();

/** Texte fourni par l'appareil, quand il n'y a pas de disque à lire. */
let texteInjecte = null;

/** Déclare le texte du règlement (appareil sans système de fichiers). */
function definirTexteReglement(texte) {
  texteInjecte = typeof texte === 'string' && texte.trim() ? texte : null;
  cache = null;
}

/** Rappel joint à toute citation. */
const RESERVE =
  'C’est le texte du règlement, pas mon interprétation : pour un cas particulier, ' +
  'la scolarité fait foi.';

let cache = null;

/**
 * Le panneau affiche du texte brut : les astérisques du gras markdown s'y
 * liraient telles quelles — « **DEUG** », « **Statut AJAC** ». Le règlement est
 * écrit en markdown pour être lisible dans un éditeur ; il reste parfaitement
 * lisible sans ses marques.
 */
const sansGras = (t) => String(t)
  .replace(/\*\*(.+?)\*\*/gs, '$1')
  .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1$2');

/**
 * Sections de premier niveau (`##`) du règlement, dans l'ordre du document.
 * @returns {Array<{titre: string, texte: string}>}
 */
function chargerReglement(force = false) {
  if (cache && !force) return cache;

  let brut;
  try {
    if (texteInjecte !== null) {
      brut = texteInjecte;
    } else {
      const acces = accesFichiers();
      if (!acces || !CHEMIN) throw new Error('Règlement introuvable sur cet appareil');
      brut = acces.fs.readFileSync(CHEMIN, 'utf-8');
    }
  } catch {
    // Absence du fichier : on rend une liste vide, et l'appelant le dira. Il
    // n'y a pas de repli acceptable — un règlement approximatif ne vaut rien.
    cache = [];
    return cache;
  }

  const sections = [];
  let courante = null;

  for (const ligne of brut.split(/\r?\n/)) {
    const titre = /^##\s+(?!#)(.*)$/.exec(ligne);
    if (titre) {
      if (courante) sections.push(courante);
      courante = { titre: titre[1].trim(), lignes: [] };
      continue;
    }
    if (courante) courante.lignes.push(ligne);
  }
  if (courante) sections.push(courante);

  cache = sections.map(s => ({
    titre: s.titre,
    texte: sansGras(s.lignes.join('\n').replace(/\n?---\s*$/, '').trim()),
  }));
  return cache;
}

/**
 * Titres de section rattachés à chaque intention de règlement.
 * Plusieurs sections peuvent répondre à une même question : elles sont citées
 * dans l'ordre du document, qui est celui de la lecture.
 */
const SECTIONS = {
  reglement_assiduite: ['Assiduité et absences aux enseignements'],
  reglement_absence_epreuve: ['Absences aux épreuves', 'Abréviations'],
  reglement_compensation: ['Compensation et validation', 'Évaluation continue intégrale'],
  reglement_progression: ['Progression', 'Diplôme'],
  reglement_maquette: ['Maquette — Semestre 3 (30 ECTS)', 'Maquette — Semestre 4 (30 ECTS)'],
};

/** Sections correspondant à une intention, ou `[]`. */
function citer(cle) {
  const voulues = SECTIONS[cle];
  if (!voulues) return [];

  const sections = chargerReglement();
  return voulues
    .map(titre => sections.find(s => s.titre === titre))
    .filter(Boolean);
}

/** Vrai si le règlement a pu être lu. */
const reglementLisible = () => chargerReglement().length > 0;

module.exports = { chargerReglement, citer, reglementLisible, definirTexteReglement, SECTIONS, RESERVE, CHEMIN };
