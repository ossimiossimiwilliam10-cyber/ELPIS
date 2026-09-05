import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkloadEngine, heuresAttendues } from './useWorkloadEngine';

describe('useWorkloadEngine', () => {
  it('should return expected shape', () => {
    const { result } = renderHook(() => useWorkloadEngine());
    // TODO: Ajouter des assertions sur result.current
    expect(result.current).toBeDefined();
  });
});

describe('heuresAttendues', () => {
  /*
   * La maquette donne les volumes horaires de chaque matière. Ils étaient
   * enregistrés en base, relus à chaque chargement, et utilisés nulle part :
   * la charge se déduisait du seul coefficient, à 15 h par point. Deux matières
   * de coefficient 1 recevaient donc la même estimation, que la première compte
   * 60 heures d'enseignement et la seconde 25.
   *
   * Sur le cursus réel, le total annuel passe de 360 h à 947 h — et la
   * convention ECTS situe le travail personnel de 60 crédits entre 927 et
   * 1227 h. L'ancienne estimation se trompait d'un facteur 2,6.
   */
  it('déduit la charge des heures encadrées de la maquette', () => {
    // Maths pour les Sciences Physiques 3 : 20 h de CM, 40 h de TD.
    expect(heuresAttendues({ nom: 'Maths 3', coefficient: 1, cm_h: 20, td_h: 40 }))
      .toBeCloseTo(96, 5);
  });

  it('additionne cours, travaux dirigés et travaux pratiques', () => {
    // Électronique : 10 h de CM, 12 h de TD, 22 h de TP.
    expect(heuresAttendues({ coefficient: 2, cm_h: 10, td_h: 12, tp_h: 22 }))
      .toBeCloseTo(70.4, 5);
  });

  it('distingue deux matières de même coefficient mais de volumes différents', () => {
    // C'est exactement ce que l'ancien calcul confondait.
    const maths = heuresAttendues({ coefficient: 1, cm_h: 20, td_h: 40 });
    const chimie = heuresAttendues({ coefficient: 1, cm_h: 25 });
    expect(maths).toBeGreaterThan(chimie * 2);
  });

  it('se replie sur le coefficient quand la maquette manque', () => {
    // Un cursus saisi sans les volumes horaires ne doit pas tomber à zéro.
    expect(heuresAttendues({ coefficient: 3 })).toBe(45);
    expect(heuresAttendues({ coefficient: 3, cm_h: 0, td_h: 0, tp_h: 0 })).toBe(45);
  });

  it('applique un coefficient de 1 par défaut', () => {
    expect(heuresAttendues({})).toBe(15);
    expect(heuresAttendues(null)).toBe(15);
  });

  it('ignore des volumes horaires illisibles', () => {
    expect(heuresAttendues({ coefficient: 2, cm_h: 'vingt', td_h: null })).toBe(30);
  });
});
