import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SoundSettings } from './SoundSettings';

describe('SoundSettings Component', () => {
    const defaultProps = {
        enabled: true,
        volume: 50,
        soundPack: 'Default',
        availablePacks: ['Default', 'Minimal'],
        onToggleEnabled: vi.fn(),
        onVolumeChange: vi.fn(),
        onPackChange: vi.fn(),
        onTestSound: vi.fn(),
    };

    it('renders correctly', () => {
        render(<SoundSettings {...defaultProps} />);
        expect(screen.getByText('Sound Alerts')).toBeInTheDocument();
        expect(screen.getByText('50%')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Test Sound/i })).toBeInTheDocument();
    });

    it('calls onToggleEnabled when switch is clicked', () => {
        const onToggleEnabled = vi.fn();
        render(<SoundSettings {...defaultProps} onToggleEnabled={onToggleEnabled} />);

        // Switch role matching toggle
        const toggle = screen.getByRole('switch');
        fireEvent.click(toggle);

        // It should flip the current 'enabled' prop standard value
        expect(onToggleEnabled).toHaveBeenCalledWith(false);
    });

    it('calls onVolumeChange when slider value moves', () => {
        const onVolumeChange = vi.fn();
        render(<SoundSettings {...defaultProps} onVolumeChange={onVolumeChange} />);

        const slider = screen.getByRole('slider');
        fireEvent.change(slider, { target: { value: '75' } });

        expect(onVolumeChange).toHaveBeenCalledWith(75);
    });

    it('calls onPackChange when select choice changes', () => {
        const onPackChange = vi.fn();
        render(<SoundSettings {...defaultProps} onPackChange={onPackChange} />);

        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'Minimal' } });

        expect(onPackChange).toHaveBeenCalledWith('Minimal');
    });

    it('disables controls when enabled is false', () => {
        render(<SoundSettings {...defaultProps} enabled={false} />);

        const slider = screen.getByRole('slider');
        const select = screen.getByRole('combobox');
        const testButton = screen.getByRole('button', { name: /Test Sound/i });

        expect(slider).toBeDisabled();
        expect(select).toBeDisabled();
        expect(testButton).toBeDisabled();
    });
});
