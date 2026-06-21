import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from './Sidebar';

describe('Sidebar', () => {
  it('renders correctly with given props', () => {
    const setActiveTab = vi.fn();
    render(
      <Sidebar 
        activeTab="dashboard" 
        setActiveTab={setActiveTab} 
        theme="dark" 
        setTheme={vi.fn()} 
        streak={5} 
        pendingTasksCount={2} 
      />
    );
    
    expect(screen.getByText('ELPIS')).toBeDefined();
    expect(screen.getByText('Accueil')).toBeDefined();
    
    // Badge for pending tasks should be visible
    expect(screen.getByText('2')).toBeDefined();
    
    // Streak indicator
    expect(screen.getByText('🔥 Streak : 5 Jours')).toBeDefined();
  });

  it('changes active tab on click', () => {
    const setActiveTab = vi.fn();
    render(
      <Sidebar 
        activeTab="dashboard" 
        setActiveTab={setActiveTab} 
        theme="dark" 
        setTheme={vi.fn()} 
        streak={1} 
        pendingTasksCount={0} 
      />
    );
    
    fireEvent.click(screen.getByText('Bibliothèque'));
    expect(setActiveTab).toHaveBeenCalledWith('cours');
  });

  it('toggles theme', () => {
    const setTheme = vi.fn();
    const { rerender } = render(
      <Sidebar 
        activeTab="dashboard" 
        setActiveTab={vi.fn()} 
        theme="dark" 
        setTheme={setTheme} 
        streak={1} 
        pendingTasksCount={0} 
      />
    );
    
    const themeBtnDark = screen.getByTitle('Passer au mode clair');
    fireEvent.click(themeBtnDark);
    expect(setTheme).toHaveBeenCalledWith('light');
    
    // Re-render with light theme
    rerender(
      <Sidebar 
        activeTab="dashboard" 
        setActiveTab={vi.fn()} 
        theme="light" 
        setTheme={setTheme} 
        streak={1} 
        pendingTasksCount={0} 
      />
    );
    
    const themeBtnLight = screen.getByTitle('Passer au mode sombre');
    fireEvent.click(themeBtnLight);
    expect(setTheme).toHaveBeenCalledWith('dark');
  });
});
