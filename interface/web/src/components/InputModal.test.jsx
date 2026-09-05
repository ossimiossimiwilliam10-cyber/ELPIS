import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InputModal from './InputModal';

const ouvrir = (props = {}) => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <InputModal
      isOpen
      onConfirm={onConfirm}
      onCancel={onCancel}
      title="Nouveau nom :"
      defaultValue="Algèbre"
      {...props}
    />
  );
  return { onConfirm, onCancel };
};

beforeEach(() => vi.clearAllMocks());

describe('InputModal', () => {
  it('reste invisible tant qu\'elle est fermée', () => {
    render(<InputModal isOpen={false} onConfirm={vi.fn()} onCancel={vi.fn()} title="Titre" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('s\'annonce comme une boîte de dialogue nommée', () => {
    ouvrir();
    expect(screen.getByRole('dialog', { name: 'Nouveau nom :' })).toBeInTheDocument();
  });

  it('pré-remplit la valeur transmise', () => {
    ouvrir();
    expect(screen.getByRole('textbox')).toHaveValue('Algèbre');
  });

  it('remonte la valeur saisie', () => {
    const { onConfirm } = ouvrir();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Analyse' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onConfirm).toHaveBeenCalledWith('Analyse');
  });

  it('élague les espaces autour de la saisie', () => {
    const { onConfirm } = ouvrir();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Analyse  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onConfirm).toHaveBeenCalledWith('Analyse');
  });

  it('accepte une saisie vide, qui a parfois un sens', () => {
    // Certains appels traitent le vide comme « utiliser la valeur par défaut ».
    const { onConfirm } = ouvrir();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onConfirm).toHaveBeenCalledWith('');
  });

  it('valide à la touche Entrée', () => {
    const { onConfirm } = ouvrir();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Analyse' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalledWith('Analyse');
  });

  it('renonce sur Échap', () => {
    const { onCancel, onConfirm } = ouvrir();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('renonce au bouton Annuler', () => {
    const { onCancel } = ouvrir();
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('donne un nom accessible au champ', () => {
    ouvrir();
    expect(screen.getByRole('textbox', { name: 'Nouveau nom :' })).toBeInTheDocument();
  });

  it('se rabat sur l\'invite quand il n\'y a pas de titre', () => {
    render(<InputModal isOpen onConfirm={vi.fn()} onCancel={vi.fn()} placeholder="Temps en minutes" />);
    expect(screen.getByRole('textbox', { name: 'Temps en minutes' })).toBeInTheDocument();
  });
});
