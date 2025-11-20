import React, { useEffect, useState } from 'react';
import { ICONS } from '@/constants/frontomni';
import { EmailAccount } from '@/types/frontomni';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: EmailAccount[];
  defaultFromId?: string | null;
  defaultProvider?: 'gmail' | 'outlook' | 'all';
  onSend: (accountId: string, to: string, subject: string, body: string) => Promise<void>;
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  accounts,
  defaultFromId,
  defaultProvider,
  onSend,
  initialTo = '',
  initialSubject = '',
  initialBody = ''
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Determine default account
      if (defaultFromId) {
        setSelectedAccountId(defaultFromId);
      } else if (defaultProvider && defaultProvider !== 'all') {
        const firstProviderAcc = accounts.find(a => a.provider === defaultProvider);
        if (firstProviderAcc) setSelectedAccountId(firstProviderAcc.id);
      } else if (accounts.length > 0) {
        setSelectedAccountId(accounts[0].id);
      }
      // Reset fields with initial values
      setTo(initialTo);
      setSubject(initialSubject);
      setBody(initialBody);
    }
  }, [isOpen, defaultFromId, defaultProvider, accounts, initialTo, initialSubject, initialBody]);

  const handleSend = async () => {
    if (!selectedAccountId || !to || !subject || !body) return;

    setIsSending(true);
    try {
      await onSend(selectedAccountId, to, subject, body);
      // onClose is handled by parent on success, or we can do it here
    } catch (error) {
      console.error('Failed to send', error);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl h-[85vh] bg-charcoal border border-border rounded-xl shadow-2xl flex flex-col relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Glow Effect */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-cyan via-neon-purple to-neon-cyan opacity-50"></div>

        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-glass border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <ICONS.Compose size={18} className="text-neon-cyan" />
            New Message
          </h2>
          <div className="flex gap-2">
            <button onClick={onClose} className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-text-muted hover:text-text-primary">
              <ICONS.Close size={18} />
            </button>
          </div>
        </div>

        {/* Fields */}
        <div className="p-4 space-y-4 flex-1 overflow-y-auto bg-obsidian">
          <div className="flex flex-col gap-4">
            <div className="relative group">
              <label className="text-xs text-text-muted uppercase font-mono mb-1 block">From</label>
              <div className="relative">
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full bg-black/5 dark:bg-black/20 border border-border rounded-md py-2 pl-3 pr-8 text-text-primary text-sm focus:border-neon-cyan/50 outline-none appearance-none cursor-pointer hover:bg-black/10 dark:hover:bg-white/5 transition-colors"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.email} ({acc.provider})
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ICONS.Left className="-rotate-90 text-text-muted w-3 h-3" />
                </div>
              </div>
              {selectedAccount && (
                <div className="mt-1 flex items-center gap-2 text-[10px] text-text-muted">
                  <span className={`w-1.5 h-1.5 rounded-full ${selectedAccount.provider === 'gmail' ? 'bg-red-500' : 'bg-blue-500'}`}></span>
                  <span>Sending via {selectedAccount.provider.charAt(0).toUpperCase() + selectedAccount.provider.slice(1)}</span>
                </div>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="To"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full bg-transparent border-b border-border py-2 text-text-primary placeholder:text-text-muted focus:border-neon-cyan/50 outline-none transition-colors"
              />
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-transparent border-b border-border py-2 text-text-primary placeholder:text-text-muted focus:border-neon-cyan/50 outline-none transition-colors font-medium"
              />
            </div>
            <div className="h-full min-h-[300px]">
              <textarea
                placeholder="Write your message..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full h-full bg-transparent resize-none outline-none text-text-primary leading-relaxed placeholder:text-text-muted"
              ></textarea>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-charcoal flex justify-between items-center">
          <div className="flex gap-2 text-text-muted">
            <button className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded"><ICONS.Filter size={18} /></button>
            <button className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded"><ICONS.Check size={18} /></button>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded text-sm text-text-muted hover:text-text-primary transition-colors">
              Discard
            </button>
            <button
              onClick={handleSend}
              disabled={isSending || !to || !subject || !body}
              className="px-6 py-2 rounded bg-neon-cyan text-black font-bold text-sm hover:bg-cyan-400 transition-colors shadow-[0_0_15px_rgba(0,243,255,0.3)] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? 'Sending...' : 'Send'} <ICONS.Sent size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};