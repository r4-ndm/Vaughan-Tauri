import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TokenList } from './TokenList';

describe('TokenList Component', () => {
    const mockTokens = [
        {
            address: '0x123',
            symbol: 'ETH',
            name: 'Ethereum',
            balanceWei: '1500000000000000000', // 1.5 ETH
            decimals: 18,
            usdPrice: 2000,
        },
        {
            address: '0x456',
            symbol: 'USDC',
            name: 'USD Coin',
            balanceWei: '500000000', // 500 USDC (6 decimals)
            decimals: 6,
            usdPrice: 1,
        }
    ];

    it('renders loading state when isLoading is true', () => {
        render(<TokenList tokens={[]} isLoading={true} />);
        expect(screen.getByText('Loading tokens...')).toBeInTheDocument();
    });

    it('renders empty state when tokens array is empty', () => {
        render(<TokenList tokens={[]} />);
        expect(screen.getByText('No tokens found')).toBeInTheDocument();
    });

    it('renders list of tokens correctly', () => {
        render(<TokenList tokens={mockTokens} />);

        // Check symbols
        expect(screen.getByText('ETH')).toBeInTheDocument();
        expect(screen.getByText('USDC')).toBeInTheDocument();

        // Check names
        expect(screen.getByText('Ethereum')).toBeInTheDocument();
        expect(screen.getByText('USD Coin')).toBeInTheDocument();

        // Check formatted balances
        expect(screen.getByText('1.5')).toBeInTheDocument();
    });

    it('calls onTokenClick when a token is clicked', () => {
        const handleTokenClick = vi.fn();
        render(<TokenList tokens={mockTokens} onTokenClick={handleTokenClick} />);

        const ethTokenRow = screen.getByText('ETH').closest('div[role="button"]');
        if (ethTokenRow) {
            fireEvent.click(ethTokenRow);
        }

        expect(handleTokenClick).toHaveBeenCalledTimes(1);
        expect(handleTokenClick).toHaveBeenCalledWith(mockTokens[0]);
    });
});
