import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import CMCompletionModal from './components/CMCompletionModal';

describe('CMCompletionModal UI Component', () => {
  const modalScenarios = [];
  for (let i = 0; i < 50; i++) {
    // Generate different combinations of defaultMinutes and exercise types
    modalScenarios.push([
      i % 2 === 0 ? 'CM' : 'TD', 
      30 + (i % 30), 
      i % 4 + 1 // Score 1 to 4
    ]);
  }

  test.each(modalScenarios)('renders modal for %s with default %d min, selects score %d', (type, defMins, targetScore) => {
    const taskTitle = `Exercice ${type}`;
    const onSubmit = vi.fn();
    const onClose = vi.fn();

    render(
      <CMCompletionModal 
        isOpen={true}
        taskTitle={taskTitle} 
        defaultMinutes={defMins} 
        onClose={onClose} 
        onSubmit={onSubmit} 
      />
    );

    // Title should be visible (we know the hardcoded title is "✅ CM terminé" or something but let's check taskTitle is in the doc)
    expect(screen.getByText(taskTitle)).toBeDefined();

    // Verify all 4 FSRS buttons are present
    const btnEchec = screen.getByText('Échec');
    const btnDifficile = screen.getByText('Difficile');
    const btnBon = screen.getByText('Bon');
    const btnFacile = screen.getByText('Facile');

    expect(btnEchec).toBeDefined();
    expect(btnDifficile).toBeDefined();
    expect(btnBon).toBeDefined();
    expect(btnFacile).toBeDefined();

    // Click the target score
    let targetBtn;
    if (targetScore === 1) targetBtn = btnEchec;
    else if (targetScore === 2) targetBtn = btnDifficile;
    else if (targetScore === 3) targetBtn = btnBon;
    else targetBtn = btnFacile;

    fireEvent.click(targetBtn);

    // Click Validate
    const validerBtn = screen.getByText('Valider');
    fireEvent.click(validerBtn);

    // Verify onSubmit was called with correct data
    expect(onSubmit).toHaveBeenCalledWith({
      minutes: defMins,
      sm2Score: targetScore
    });
  });
});
