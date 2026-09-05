import { describe, test, expect } from 'vitest';
import {
  PLAFOND_EXCLUSIONS,
  MOTS_MAX,
  texteBrut,
  clefMot,
  normaliserNombre,
  extraireCartes,
  filtrerDoublons,
  promptVocabulaire,
} from '../moteur/vocabulaire';

const niveauB2 = {
  code: 'B2',
  libelle: 'Avancé',
  heures: 612,
  attendu: 'la nuance : collocations naturelles, registres distincts',
};

describe('Nettoyage des champs Anki', () => {
  test('le balisage HTML des champs est retiré', () => {
    expect(texteBrut('<div>to thrive</div>')).toBe('to thrive');
    expect(texteBrut('to&nbsp;thrive')).toBe('to thrive');
    expect(texteBrut('a<br>b')).toBe('a b');
  });

  test('les entités HTML courantes sont rendues', () => {
    expect(texteBrut('R&amp;D')).toBe('R&D');
    expect(texteBrut('&quot;mot&quot;')).toBe('"mot"');
    expect(texteBrut('l&#39;eau')).toBe("l'eau");
  });

  test('deux écritures d’un même mot donnent la même clé', () => {
    expect(clefMot('<div>To Thrive</div>')).toBe(clefMot('  to thrive.  '));
    expect(clefMot('« mot »')).toBe('mot');
  });

  test('les accents distinguent bien deux mots', () => {
    // Les retirer confondrait « año » et « ano » en espagnol.
    expect(clefMot('año')).not.toBe(clefMot('ano'));
  });

  test('le nombre demandé reste dans ses bornes', () => {
    expect(normaliserNombre(0)).toBe(1);
    expect(normaliserNombre(500)).toBe(MOTS_MAX);
    expect(normaliserNombre('douze')).toBe(10);
    expect(normaliserNombre(12)).toBe(12);
  });
});

describe('Extraction des cartes', () => {
  const attendu = [{ recto: 'to thrive', verso: 'prospérer (they thrive here)' }];

  test('un tableau JSON nu est lu', () => {
    expect(extraireCartes(JSON.stringify(attendu))).toEqual(attendu);
  });

  test('les balises de code et le bavardage autour sont ignorés', () => {
    const reponse = 'Bien sûr ! Voici :\n```json\n' + JSON.stringify(attendu) + '\n```\nBonne révision.';
    expect(extraireCartes(reponse)).toEqual(attendu);
  });

  test('les clés alternatives « mot » et « traduction » sont acceptées', () => {
    const brut = '[{"mot": "to thrive", "traduction": "prospérer"}]';
    expect(extraireCartes(brut)).toEqual([{ recto: 'to thrive', verso: 'prospérer' }]);
  });

  test('les entrées incomplètes sont écartées', () => {
    const brut = '[{"recto": "a"}, {"verso": "b"}, {"recto": "c", "verso": "d"}]';
    expect(extraireCartes(brut)).toEqual([{ recto: 'c', verso: 'd' }]);
  });

  test('un modèle qui se répète dans sa propre réponse ne produit qu’une carte', () => {
    const brut = '[{"recto":"To Thrive","verso":"a"},{"recto":"to thrive","verso":"b"}]';
    expect(extraireCartes(brut)).toHaveLength(1);
  });

  test('une réponse sans JSON exploitable ne produit rien', () => {
    expect(extraireCartes("Je ne peux pas faire cela.")).toEqual([]);
    expect(extraireCartes('[{"recto": ')).toEqual([]);
    expect(extraireCartes('{"recto": "a", "verso": "b"}')).toEqual([]);
    expect(extraireCartes(null)).toEqual([]);
  });
});

describe('Filtrage des doublons', () => {
  const cartes = [
    { recto: 'to thrive', verso: 'prospérer' },
    { recto: 'cumbersome', verso: 'encombrant' },
  ];

  test('les mots déjà présents sont écartés, les autres retenus', () => {
    const { retenues, ecartees } = filtrerDoublons(cartes, ['to thrive']);
    expect(retenues).toEqual([cartes[1]]);
    expect(ecartees).toEqual([cartes[0]]);
  });

  test('la comparaison ignore le balisage et la casse du deck', () => {
    const { retenues } = filtrerDoublons(cartes, ['<div>To&nbsp;Thrive</div>']);
    expect(retenues).toEqual([cartes[1]]);
  });

  test('sans mots connus, tout est retenu', () => {
    expect(filtrerDoublons(cartes, []).retenues).toHaveLength(2);
    expect(filtrerDoublons(cartes, null).retenues).toHaveLength(2);
  });

  test('les listes vides ne font pas tomber le filtre', () => {
    expect(filtrerDoublons(null, ['a'])).toEqual({ retenues: [], ecartees: [] });
  });
});

describe('Consigne de génération', () => {
  test('la langue, le niveau et l’attendu du palier y figurent', () => {
    const { consigne } = promptVocabulaire({ langue: 'Japonais', niveau: niveauB2, nombre: 12 });
    expect(consigne).toContain('Japonais');
    expect(consigne).toContain('B2');
    expect(consigne).toContain('612 heures');
    expect(consigne).toContain(niveauB2.attendu);
    expect(consigne).toContain('exactement 12 entrées');
  });

  test('le thème est repris quand il est fourni, absent sinon', () => {
    expect(promptVocabulaire({ langue: 'Anglais', theme: 'cuisine' }).consigne).toContain('cuisine');
    expect(promptVocabulaire({ langue: 'Anglais' }).consigne).not.toContain('thème');
  });

  test('les mots connus sont transmis comme exclusions', () => {
    const { consigne, exclusions } = promptVocabulaire({
      langue: 'Anglais', motsConnus: ['to thrive', 'cumbersome'],
    });
    expect(consigne).toContain('to thrive');
    expect(consigne).toContain('Ces 2 entrées figurent déjà');
    expect(exclusions).toMatchObject({ transmises: 2, connues: 2, tronquee: false });
  });

  test('une exclusion unique s’accorde au singulier', () => {
    const { consigne } = promptVocabulaire({ langue: 'Anglais', motsConnus: ['to thrive'] });
    expect(consigne).toContain('Cette entrée figure déjà');
    expect(consigne).not.toContain('Ces 1 ');
  });

  test('les mots connus sont dédoublonnés et nettoyés avant transmission', () => {
    const { exclusions } = promptVocabulaire({
      langue: 'Anglais', motsConnus: ['<div>mot</div>', 'mot', '', null],
    });
    expect(exclusions.connues).toBe(1);
  });

  test('la liste transmise est plafonnée, et le dit', () => {
    const beaucoup = Array.from({ length: PLAFOND_EXCLUSIONS + 120 }, (_, i) => `mot${i}`);
    const { consigne, exclusions } = promptVocabulaire({ langue: 'Anglais', motsConnus: beaucoup });

    expect(exclusions.transmises).toBe(PLAFOND_EXCLUSIONS);
    expect(exclusions.connues).toBe(beaucoup.length);
    expect(exclusions.tronquee).toBe(true);
    expect(consigne).toContain('Liste partielle');
  });

  test('sans mot connu, aucune section d’exclusion n’apparaît', () => {
    const { consigne } = promptVocabulaire({ langue: 'Anglais' });
    expect(consigne).not.toContain('figurent déjà');
    expect(consigne).not.toContain('Cette entrée figure');
  });

  test('la version autonome se suffit à elle-même', () => {
    // Collée dans une conversation, elle doit rappeler son propre format de
    // réponse : le message système ne l'y accompagne pas.
    const autonome = promptVocabulaire({ langue: 'Anglais', niveau: niveauB2, autonome: true });
    expect(autonome.complet).toContain('FORMAT DE RÉPONSE');
    expect(autonome.complet).toContain('"recto"');
    expect(autonome.complet).toContain('"verso"');
    expect(autonome.complet).toContain('Anglais');
  });

  test('la version envoyée par ELPIS porte son format dans le message système', () => {
    const api = promptVocabulaire({ langue: 'Anglais', niveau: niveauB2 });
    expect(api.systeme).toContain('tableau JSON');
    expect(api.consigne).not.toContain('FORMAT DE RÉPONSE');
    expect(api.complet).toContain(api.systeme);
  });

  test('une consigne reste produite sans niveau connu', () => {
    const { consigne } = promptVocabulaire({ langue: 'Anglais', niveau: null, nombre: 5 });
    expect(consigne).toContain('Anglais');
    expect(consigne).toContain('exactement 5 entrées');
  });
});
