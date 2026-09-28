import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import SignUp from './SignUp';
import { AuthProvider } from '@/contexts/AuthContext';

// Mock the AuthContext
vi.mock('@/contexts/AuthContext', async () => {
    const actual = await vi.importActual('@/contexts/AuthContext');
    return {
        ...actual,
        useAuth: () => ({
            user: null,
            register: vi.fn(),
        }),
        AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    };
});

describe('SignUp Component', () => {
    it('renders the registration form with Institute label', () => {
        render(
            <BrowserRouter>
                <AuthProvider>
                    <SignUp />
                </AuthProvider>
            </BrowserRouter>
        );

        // Check for Institute label
        expect(screen.getByText('Institute')).toBeInTheDocument();

        // Check for default value (since school is pre-selected)
        expect(screen.getAllByText('Manipal Institute of Technology').length).toBeGreaterThan(0);
    });
});
