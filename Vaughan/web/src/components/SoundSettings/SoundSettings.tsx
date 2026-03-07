import React from 'react';
import { Volume2, VolumeX, Play } from 'lucide-react';

export interface SoundSettingsProps {
    enabled: boolean;
    volume: number; // 0 to 100
    soundPack: string;
    availablePacks: string[];
    onToggleEnabled: (enabled: boolean) => void;
    onVolumeChange: (volume: number) => void;
    onPackChange: (pack: string) => void;
    onTestSound: () => void;
}

/**
 * SoundSettings component provides controls for application audio.
 * Matches existing Iced UI styles with toggles and sliders.
 */
export const SoundSettings: React.FC<SoundSettingsProps> = ({
    enabled,
    volume,
    soundPack,
    availablePacks,
    onToggleEnabled,
    onVolumeChange,
    onPackChange,
    onTestSound,
}) => {
    return (
        <div className="w-full flex flex-col gap-6 p-6 bg-card border border-border">
            <div className="flex flex-row items-center justify-between">
                <div className="flex flex-col">
                    <h3 className="text-lg font-semibold text-foreground">Sound Alerts</h3>
                    <p className="text-sm text-muted-foreground">Play sounds for transactions and events</p>
                </div>

                {/* Toggle Switch */}
                <button
                    role="switch"
                    aria-checked={enabled}
                    onClick={() => onToggleEnabled(!enabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus ${enabled ? 'bg-success' : 'bg-secondary'
                        }`}
                >
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                    />
                </button>
            </div>

            <div className={`flex flex-col gap-4 transition-opacity ${enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>

                {/* Volume Control */}
                <div className="flex flex-col gap-2">
                    <div className="flex flex-row justify-between items-center">
                        <label htmlFor="volume-slider" className="text-sm font-medium text-foreground">Volume</label>
                        <span className="text-xs text-muted-foreground">{Math.round(volume)}%</span>
                    </div>
                    <div className="flex flex-row items-center gap-3">
                        <VolumeX size={18} className="text-muted-foreground" />
                        <input
                            id="volume-slider"
                            type="range"
                            min="0"
                            max="100"
                            value={volume}
                            onChange={(e) => onVolumeChange(Number(e.target.value))}
                            disabled={!enabled}
                            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <Volume2 size={18} className="text-foreground" />
                    </div>
                </div>

                {/* Sound Pack Selector */}
                <div className="flex flex-col gap-2">
                    <label htmlFor="sound-pack" className="text-sm font-medium text-foreground">Sound Pack</label>
                    <select
                        id="sound-pack"
                        value={soundPack}
                        onChange={(e) => onPackChange(e.target.value)}
                        disabled={!enabled}
                        className="bg-background border border-border text-foreground text-sm rounded-none focus:ring-border-focus focus:border-border-focus block w-full p-2.5"
                    >
                        {availablePacks.map((pack) => (
                            <option key={pack} value={pack}>
                                {pack}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Test Button */}
                <div className="pt-2 border-t border-border mt-2">
                    <button
                        onClick={onTestSound}
                        disabled={!enabled}
                        className="vaughan-btn w-full flex flex-row items-center justify-center gap-2"
                    >
                        <Play size={16} />
                        <span>Test Sound</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
