import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';

global.fetch = vi.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({}),
    ok: true,
  })
);

/**
 * Mocks partagés des bibliothèques d'animation et de glisser-déposer.
 *
 * Ces bibliothèques n'apportent rien aux assertions et alourdissent chaque test ;
 * les mocker ici évite surtout que chaque fichier redéfinisse un mock partiel du
 * genre `{ default: vi.fn() }`, qui fait échouer le rendu dès qu'un composant importe
 * un export non prévu (motion, AnimatePresence, DragDropContext…).
 */

// Props propres à framer-motion : elles ne doivent pas atterrir sur le DOM.
const ANIMATION_PROPS = new Set([
  'initial', 'animate', 'exit', 'transition', 'variants', 'custom',
  'whileHover', 'whileTap', 'whileFocus', 'whileDrag', 'whileInView',
  'layout', 'layoutId', 'drag', 'dragConstraints', 'onAnimationComplete',
]);

const stripAnimationProps = (props) =>
  Object.fromEntries(Object.entries(props).filter(([key]) => !ANIMATION_PROPS.has(key)));

vi.mock('framer-motion', () => {
  const motion = new Proxy({}, {
    get: (_target, tag) => {
      const Component = ({ children, ...props }) =>
        React.createElement(typeof tag === 'string' ? tag : 'div', stripAnimationProps(props), children);
      Component.displayName = `motion.${String(tag)}`;
      return Component;
    },
  });

  return {
    motion,
    AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children),
    useAnimation: () => ({ start: vi.fn(), stop: vi.fn(), set: vi.fn() }),
    useReducedMotion: () => false,
  };
});

vi.mock('@hello-pangea/dnd', () => {
  // Le glisser-déposer n'est pas simulable en jsdom : on rend les enfants en fournissant
  // les objets `provided` attendus, afin que la liste reste inspectable.
  const provided = {
    innerRef: vi.fn(),
    droppableProps: {},
    draggableProps: {},
    dragHandleProps: {},
    placeholder: null,
  };
  const snapshot = { isDragging: false, isDraggingOver: false };

  return {
    DragDropContext: ({ children }) => React.createElement(React.Fragment, null, children),
    Droppable: ({ children }) => children(provided, snapshot),
    Draggable: ({ children }) => children(provided, snapshot),
  };
});

// jsdom n'implémente pas ces API de mise en page : les composants qui font
// défiler une conversation ou mesurent leur conteneur tombaient à l'exécution.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
