import { describe, it, expect } from 'vitest';
import { truncateAddress, formatBalance, formatCurrency } from './format';

describe('format utils', () => {
    describe('truncateAddress', () => {
        it('truncates standard address', () => {
            const address = '0x1234567890abcdef1234567890abcdef12345678';
            expect(truncateAddress(address)).toBe('0x1234...5678');
        });

        it('returns empty string on empty input', () => {
            expect(truncateAddress('')).toBe('');
        });
    });

    describe('formatBalance', () => {
        it('formats 1 ETH correctly', () => {
            // 1 ETH = 1000000000000000000 wei
            expect(formatBalance('1000000000000000000')).toBe('1');
        });

        it('formats partial ETH correctly', () => {
            // 1.5 ETH
            expect(formatBalance('1500000000000000000')).toBe('1.5');
        });

        it('limits decimals properly', () => {
            // 0.123456789 ETH -> should be 0.123456
            expect(formatBalance('123456789000000000')).toBe('0.123456');
        });
    });

    describe('formatCurrency', () => {
        it('formats USD amounts', () => {
            expect(formatCurrency(1500)).toBe('$1,500');
            expect(formatCurrency(15.5)).toBe('$15.50');
            expect(formatCurrency(0.005)).toBe('$0.0050');
        });
    });
});
