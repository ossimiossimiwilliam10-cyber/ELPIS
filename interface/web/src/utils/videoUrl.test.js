import { describe, it, expect } from 'vitest';
import { estUrlSure, extraireIdYoutube, miniatureYoutube, hoteLisible } from './videoUrl';

describe('estUrlSure', () => {
  it('accepte http et https', () => {
    expect(estUrlSure('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
    expect(estUrlSure('http://exemple.fr/cours')).toBe(true);
  });

  it('refuse les schémas exécutables', () => {
    // Un champ `type="url"` les accepte pourtant : les ouvrir exécuterait
    // le script dans le contexte de l'application.
    expect(estUrlSure('javascript:alert(1)')).toBe(false);
    expect(estUrlSure('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(estUrlSure('file:///etc/passwd')).toBe(false);
  });

  it('refuse ce qui n\'est pas une adresse', () => {
    expect(estUrlSure('')).toBe(false);
    expect(estUrlSure('pas une url')).toBe(false);
    expect(estUrlSure(null)).toBe(false);
  });

  it('tolère les espaces autour', () => {
    expect(estUrlSure('  https://youtu.be/dQw4w9WgXcQ  ')).toBe(true);
  });
});

describe('extraireIdYoutube', () => {
  it('reconnaît un lien de lecture classique', () => {
    expect(extraireIdYoutube('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('reconnaît un lien raccourci', () => {
    expect(extraireIdYoutube('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('reconnaît les formes intégrée, courte et en direct', () => {
    expect(extraireIdYoutube('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extraireIdYoutube('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extraireIdYoutube('https://www.youtube.com/live/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('ignore les paramètres surnuméraires', () => {
    expect(extraireIdYoutube('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL')).toBe('dQw4w9WgXcQ');
  });

  it('accepte les sous-domaines mobiles et musique', () => {
    expect(extraireIdYoutube('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extraireIdYoutube('https://music.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('renvoie null pour un autre hébergeur', () => {
    expect(extraireIdYoutube('https://vimeo.com/123456')).toBeNull();
    expect(extraireIdYoutube('https://exemple.fr/cours.mp4')).toBeNull();
  });

  it('renvoie null pour un identifiant malformé', () => {
    expect(extraireIdYoutube('https://youtu.be/trop-court')).toBeNull();
    expect(extraireIdYoutube('https://www.youtube.com/watch?v=')).toBeNull();
  });

  it('renvoie null pour une adresse dangereuse', () => {
    expect(extraireIdYoutube('javascript:alert(1)')).toBeNull();
  });
});

describe('miniatureYoutube', () => {
  it('construit l\'adresse de la vignette', () => {
    expect(miniatureYoutube('https://youtu.be/dQw4w9WgXcQ'))
      .toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg');
  });

  it('renvoie null hors YouTube', () => {
    expect(miniatureYoutube('https://vimeo.com/123456')).toBeNull();
  });
});

describe('hoteLisible', () => {
  it('retire le préfixe www', () => {
    expect(hoteLisible('https://www.vimeo.com/123')).toBe('vimeo.com');
  });

  it('renvoie une chaîne vide pour une adresse invalide', () => {
    expect(hoteLisible('n\'importe quoi')).toBe('');
  });
});
