import { describe, it, expect } from 'vitest';
import { isValidAddress, isValidAmountInput, parseAmountToWei, isValidPassword } from './validation';

describe('validation utils', () => {
    describe('isValidAddress', () => {
        it('accepts valid 40-char hex with 0x', () => {
            const addr = '0x1234567890abcdef1234567890abcdef12345678';
            expect(isValidAddress(addr)).toBe(true);
        });

        it('rejects invalid or short address', () => {
            expect(isValidAddress('0x123')).toBe(false);
            expect(isValidAddress('1234567890abcdef1234567890abcdef12345678')).toBe(false);
        });
    });

    describe('isValidAmountInput', () => {
        it('allows empty format while typing', () => {
            expect(isValidAmountInput('')).toBe(true);
            expect(isValidAmountInput('1.')).toBe(true);
        });

        it('allows valid decimals', () => {
            expect(isValidAmountInput('1.55')).toBe(true);
        });

        it('rejects multiple decimals or characters', () => {
            expect(isValidAmountInput('1..5')).toBe(false);
            expect(isValidAmountInput('abc')).toBe(false);
        });
    });

    describe('parseAmountToWei', () => {
        it('parses valid 1 ETH', () => {
            expect(parseAmountToWei('1')).toBe('1000000000000000000');
        });

        it('parses 1.5 ETH', () => {
            expect(parseAmountToWei('1.5')).toBe('1500000000000000000');
        });

        it('returns null on invalid entries', () => {
            expect(parseAmountToWei('.')).toBe(null);
            expect(parseAmountToWei('abc')).toBe(null);
            expect(parseAmountToWei('')).toBe(null);
        });
    });

    describe('isValidPassword', () => {
        it('enforces min 8 characters', () => {
            expect(isValidPassword('12345678')).toBe(true);
            expect(isValidPassword('123')).toBe(false);
        });
    });
});
