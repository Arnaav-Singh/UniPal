/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: () => { }, // Deprecated
            removeListener: () => { }, // Deprecated
            addEventListener: () => { },
            removeEventListener: () => { },
            dispatchEvent: () => { },
        }),
    });
});

describe('App Component', () => {
    it('renders without crashing', () => {
        render(<App />);
        // Since we don't know the exact content, we just check if the render didn't throw
        expect(document.body).toBeDefined();
    });
});
