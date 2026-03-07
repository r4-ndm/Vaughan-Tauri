import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SendConfirmView } from './SendConfirmView';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(),
}));

// Mock Tauri event for Layout's ApprovalModal
vi.mock('@tauri-apps/api/event', () => ({
    listen: vi.fn(() => Promise.resolve(vi.fn())),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
        useLocation: () => ({
            state: {
                from: '0xSenderAddress',
                to: '0xReceiverAddress',
                amount: '1.5',
                symbol: 'ETH',
                gas_limit: 21000,
                gas_price_gwei: '10'
            }
        })
    };
});

describe('SendConfirmView Component', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        vi.clearAllMocks();
        queryClient = new QueryClient();

        (invoke as any).mockImplementation((cmd: string) => {
            if (cmd === 'send_transaction') return Promise.resolve({ tx_hash: '0xabc123' });
            return Promise.resolve();
        });
    });

    const renderWithProviders = (component: React.ReactNode) => {
        return render(
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>{component}</BrowserRouter>
            </QueryClientProvider>
        );
    };

    it('renders the confirmation details', () => {
        renderWithProviders(<SendConfirmView />);

        expect(screen.getByText('1.5 ETH')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Wallet Password')).toBeInTheDocument();
    });

    it('sends the transaction and shows success', async () => {
        renderWithProviders(<SendConfirmView />);

        const passwordInput = screen.getByPlaceholderText('Wallet Password');
        fireEvent.change(passwordInput, { target: { value: 'mypassword' } });

        const confirmBtn = screen.getByRole('button', { name: /confirm send/i });
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(invoke).toHaveBeenCalledWith('send_transaction', expect.objectContaining({
                request: expect.objectContaining({
                    password: 'mypassword',
                    amount: '1.5'
                })
            }));

            expect(screen.getByText('Transaction Sent!')).toBeInTheDocument();
            expect(screen.getByText('0xabc123')).toBeInTheDocument();
        });
    });

    it('sends the transaction with fast gas price when fast is selected', async () => {
        renderWithProviders(<SendConfirmView />);

        const fastBtn = screen.getByRole('button', { name: /fast/i });
        fireEvent.click(fastBtn);

        const passwordInput = screen.getByPlaceholderText('Wallet Password');
        fireEvent.change(passwordInput, { target: { value: 'mypassword' } });

        const confirmBtn = screen.getByRole('button', { name: /confirm send/i });
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(invoke).toHaveBeenCalledWith('send_transaction', expect.objectContaining({
                request: expect.objectContaining({
                    password: 'mypassword',
                    amount: '1.5',
                    gas_price_gwei: '15' // 10 * 1.5
                })
            }));
        });
    });

    it('sends the transaction with custom gas settings when custom is selected', async () => {
        renderWithProviders(<SendConfirmView />);

        const customBtn = screen.getByRole('button', { name: /^custom$/i });
        fireEvent.click(customBtn);

        const limitInput = screen.getByDisplayValue('21000');
        const priceInput = screen.getByDisplayValue('10');

        fireEvent.change(limitInput, { target: { value: '30000' } });
        fireEvent.change(priceInput, { target: { value: '25' } });

        const passwordInput = screen.getByPlaceholderText('Wallet Password');
        fireEvent.change(passwordInput, { target: { value: 'mypassword' } });

        const confirmBtn = screen.getByRole('button', { name: /confirm send/i });
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(invoke).toHaveBeenCalledWith('send_transaction', expect.objectContaining({
                request: expect.objectContaining({
                    password: 'mypassword',
                    amount: '1.5',
                    gas_limit: 30000,
                    gas_price_gwei: '25'
                })
            }));
        });
    });
});
