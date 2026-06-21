import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StarRating from './StarRating';

describe('StarRating', () => {
  it('renders 5 stars', () => {
    render(<StarRating value={3} onChange={() => {}} />);
    const stars = screen.getAllByText('★');
    expect(stars).toHaveLength(5);
  });

  it('highlights correct number of stars based on value', () => {
    const { container } = render(<StarRating value={3} onChange={() => {}} />);
    const highlightedStars = Array.from(container.querySelectorAll('span')).filter(
      span => span.style.color === 'rgb(251, 191, 36)' // #fbbf24
    );
    expect(highlightedStars).toHaveLength(3);
  });

  it('calls onChange with correct value when a star is clicked', () => {
    const onChangeMock = vi.fn();
    render(<StarRating value={1} onChange={onChangeMock} />);
    const stars = screen.getAllByText('★');
    
    // Click the 4th star
    fireEvent.click(stars[3]);
    
    expect(onChangeMock).toHaveBeenCalledWith(4);
  });
});
