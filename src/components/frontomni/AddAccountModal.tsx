import React from 'react';
import { ICONS } from '@/constants/frontomni';

interface AddAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectProvider: (provider: 'gmail' | 'outlook') => void;
}

export const AddAccountModal: React.FC<AddAccountModalProps> = ({
    isOpen,
    onClose,
    onSelectProvider
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="w-full max-w-md bg-charcoal border border-border rounded-xl shadow-2xl flex flex-col relative overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                {/* Glow Effect */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-cyan via-neon-purple to-neon-cyan opacity-50"></div>

                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-glass border-b border-border">
                    <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                        <ICONS.Add size={18} className="text-neon-cyan" />
                        Add Account
                    </h2>
                    <button onClick={onClose} className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-text-muted hover:text-text-primary">
                        <ICONS.Close size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4 bg-obsidian">
                    <p className="text-text-secondary text-sm mb-4">
                        Select an email provider to connect to NexusMail.
                    </p>

                    <button
                        onClick={() => onSelectProvider('gmail')}
                        className="w-full p-4 rounded-lg border border-border bg-black/20 hover:bg-red-500/10 hover:border-red-500/50 transition-all group flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-red-500 flex items-center justify-center text-white font-bold">G</div>
                            <div className="text-left">
                                <div className="text-text-primary font-medium group-hover:text-red-400 transition-colors">Gmail</div>
                                <div className="text-xs text-text-muted">Connect your Google account</div>
                            </div>
                        </div>
                        <ICONS.Right size={16} className="text-text-muted group-hover:text-red-400" />
                    </button>

                    <button
                        onClick={() => onSelectProvider('outlook')}
                        className="w-full p-4 rounded-lg border border-border bg-black/20 hover:bg-blue-500/10 hover:border-blue-500/50 transition-all group flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-blue-500 flex items-center justify-center text-white font-bold">O</div>
                            <div className="text-left">
                                <div className="text-text-primary font-medium group-hover:text-blue-400 transition-colors">Outlook</div>
                                <div className="text-xs text-text-muted">Connect your Microsoft account</div>
                            </div>
                        </div>
                        <ICONS.Right size={16} className="text-text-muted group-hover:text-blue-400" />
                    </button>
                </div>
            </div>
        </div>
    );
};
