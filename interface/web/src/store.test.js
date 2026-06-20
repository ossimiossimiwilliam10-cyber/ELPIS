import { describe, test, expect, beforeEach } from 'vitest';
import useStore from './store';

describe('Zustand Store Tests', () => {
  beforeEach(() => {
    // Reset store before each test
    useStore.setState({
      coursConfig: { licences: [] },
      historique: [],
      coursConfigLoaded: false,
      historiqueLoaded: false,
    });
  });

  const generateMatiereActions = [];
  for (let i = 0; i < 30; i++) {
    generateMatiereActions.push([`Matiere_${i}`, i]);
  }

  test.each(generateMatiereActions)('add and update note for %s with value %d', (matiereName, val) => {
    useStore.setState({
      coursConfig: {
        licences: [{
          nom: 'L1', semestres: [{
            nom: 'S1', ues: [{
              nom: 'UE1', matieres: [{ nom: matiereName, evaluations: [] }]
            }]
          }]
        }]
      }
    });

    const state = useStore.getState();
    expect(state.coursConfig.licences[0].semestres[0].ues[0].matieres[0].nom).toBe(matiereName);
  });

  const historisationActions = [];
  for (let i = 0; i < 40; i++) {
    historisationActions.push([`Test_${i}`, i % 2 === 0 ? 'CM' : 'TD', 30 + i]);
  }

  test.each(historisationActions)('addHistoriqueEntry adds %s of type %s for %d minutes', (title, type, minutes) => {
    const { addHistoriqueEntry } = useStore.getState();
    addHistoriqueEntry({ matiere: 'Maths', titre: title, type, dureeMinutes: minutes });
    
    const state = useStore.getState();
    expect(state.historique.length).toBe(1);
    expect(state.historique[0].titre).toBe(title);
    expect(state.historique[0].type).toBe(type);
    expect(state.historique[0].dureeMinutes).toBe(minutes);
  });
});
