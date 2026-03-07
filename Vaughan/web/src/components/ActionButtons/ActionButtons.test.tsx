import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionButtons } from './ActionButtons';

describe('ActionButtons Component', () => {
    it('renders all three buttons correctly', () => {
        render(
            <ActionButtons
                onReceiveClick={() => { }}
                onDappBrowserClick={() => { }}
                onRefreshClick={() => { }}
                onHistoryClick={() => { }}
                onSettingsClick={() => { }}
            />
        );

        expect(screen.getByText('Receive')).toBeInTheDocument();
        expect(screen.getByText('Dapps')).toBeInTheDocument();
        expect(screen.getByText('Refresh')).toBeInTheDocument();
        expect(screen.getByText('Create')).toBeInTheDocument();
        expect(screen.getByText('Import')).toBeInTheDocument();
        expect(screen.getByText('Export')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByText('History')).toBeInTheDocument();
    });

    it('triggers callbacks when buttons are clicked', () => {
        const handleReceive = vi.fn();
        const handleDapp = vi.fn();
        const handleRefresh = vi.fn();
        const handleHistory = vi.fn();
        const handleSettings = vi.fn();

        render(
            <ActionButtons
                onReceiveClick={handleReceive}
                onDappBrowserClick={handleDapp}
                onRefreshClick={handleRefresh}
                onHistoryClick={handleHistory}
                onSettingsClick={handleSettings}
            />
        );

        fireEvent.click(screen.getByText('Receive'));
        expect(handleReceive).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByText('Dapps'));
        expect(handleDapp).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByText('Refresh'));
        expect(handleRefresh).toHaveBeenCalledTimes(1);
    });

    it('disables buttons when disabled prop is true', () => {
        render(
            <ActionButtons
                onReceiveClick={() => { }}
                onDappBrowserClick={() => { }}
                onRefreshClick={() => { }}
                onHistoryClick={() => { }}
                onSettingsClick={() => { }}
                disabled={true}
            />
        );

        expect(screen.getByRole('button', { name: /receive/i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /dapps/i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /refresh/i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /import/i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /export/i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /settings/i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /history/i })).toBeDisabled();
    });
});
