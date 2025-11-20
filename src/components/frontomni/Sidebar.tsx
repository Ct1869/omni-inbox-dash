import React, { useState, useMemo } from 'react';
import { EmailAccount, Provider, Theme } from '@/types/frontomni';
import { ICONS } from '@/constants/frontomni';
import { Sun, Moon, Monitor } from 'lucide-react';

interface SidebarProps {
  accounts: EmailAccount[];
  currentFilter: { provider: Provider | 'all'; accountId: string | null };
  onFilterChange: (provider: Provider | 'all', accountId: string | null) => void;
  onSync: () => void;
  isSyncing: boolean;
  isOpen: boolean;
  onClose: () => void;
  currentTheme: Theme;
  onThemeChange: (theme: Theme) => void;
  onAddAccount: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  accounts,
  currentFilter,
  onFilterChange,
  onSync,
  isSyncing,
  isOpen,
  onClose,
  currentTheme,
  onThemeChange,
  onAddAccount
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => {
      const matchesSearch = acc.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProvider = currentFilter.provider === 'all' || acc.provider === currentFilter.provider;
      // If searching, search across all. If not searching, filter list by provider tab if selected
      if (searchTerm) return matchesSearch;
      return matchesProvider && matchesSearch;
    });
  }, [accounts, searchTerm, currentFilter.provider]);

  const totalUnread = useMemo(() => accounts.reduce((acc, curr) => acc + curr.unreadCount, 0), [accounts]);
  const gmailUnread = useMemo(() => accounts.filter(a => a.provider === 'gmail').reduce((acc, curr) => acc + curr.unreadCount, 0), [accounts]);
  const outlookUnread = useMemo(() => accounts.filter(a => a.provider === 'outlook').reduce((acc, curr) => acc + curr.unreadCount, 0), [accounts]);

  const handleAccountClick = (provider: Provider, id: string) => {
    onFilterChange(provider, id);
    // Per user request: "when I select an account it stays there as well".
    // We DO NOT call onClose() here for mobile. User must close manually.
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Content */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-80 h-full flex flex-col 
        border-r border-border bg-charcoal/95 backdrop-blur-xl overflow-hidden transition-transform duration-300 ease-out shadow-2xl lg:shadow-none
        lg:static lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Decorative Neon Line (Visible only in dark mode mostly, handled by opacity) */}
        <div className="absolute top-0 left-0 w-[1px] h-full bg-gradient-to-b from-neon-cyan via-neon-purple to-transparent opacity-50 dark:opacity-100"></div>

        {/* Header */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">
              NEXUS<span className="text-neon-cyan">MAIL</span>
            </h1>
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-neon-green animate-pulse' : 'bg-text-muted'}`}></div>
              <button onClick={onClose} className="lg:hidden text-text-secondary hover:text-text-primary">
                <ICONS.Close size={20} />
              </button>
            </div>
          </div>

          {/* Ultimate Inbox Buttons */}
          <div className="space-y-2 mb-6">
            <button
              onClick={() => onFilterChange('all', null)}
              className={`w-full py-2.5 px-4 rounded-lg flex items-center justify-between transition-all duration-300 border group ${currentFilter.provider === 'all' && !currentFilter.accountId
                ? 'bg-neon-cyan/10 border-neon-cyan/30 text-neon-cyan shadow-[0_0_15px_rgba(0,243,255,0.1)] dark:shadow-[0_0_15px_rgba(0,243,255,0.1)] shadow-none'
                : 'bg-glass border-transparent hover:bg-black/5 dark:hover:bg-white/10 text-text-secondary'
                }`}
            >
              <div className="flex items-center gap-3">
                <ICONS.Lightning size={16} className={currentFilter.provider === 'all' && !currentFilter.accountId ? 'text-neon-cyan' : 'text-text-muted'} />
                <span className="font-medium text-sm">Ultimate Inbox</span>
              </div>
              <span className="text-xs font-mono opacity-70">{totalUnread}</span>
            </button>

            <button
              onClick={() => onFilterChange('gmail', null)}
              className={`w-full py-2.5 px-4 rounded-lg flex items-center justify-between transition-all duration-300 border group ${currentFilter.provider === 'gmail' && !currentFilter.accountId
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-glass border-transparent hover:bg-black/5 dark:hover:bg-white/10 text-text-secondary'
                }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${currentFilter.provider === 'gmail' && !currentFilter.accountId ? 'bg-red-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>G</div>
                <span className="font-medium text-sm">Gmail Ultimate</span>
              </div>
              <span className="text-xs font-mono opacity-70">{gmailUnread}</span>
            </button>

            <button
              onClick={() => onFilterChange('outlook', null)}
              className={`w-full py-2.5 px-4 rounded-lg flex items-center justify-between transition-all duration-300 border group ${currentFilter.provider === 'outlook' && !currentFilter.accountId
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                : 'bg-glass border-transparent hover:bg-black/5 dark:hover:bg-white/10 text-text-secondary'
                }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${currentFilter.provider === 'outlook' && !currentFilter.accountId ? 'bg-blue-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>O</div>
                <span className="font-medium text-sm">Outlook Ultimate</span>
              </div>
              <span className="text-xs font-mono opacity-70">{outlookUnread}</span>
            </button>
          </div>

          <div className="relative">
            <ICONS.Search className="absolute left-3 top-2.5 text-text-muted w-4 h-4" />
            <input
              type="text"
              placeholder="Search accounts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-obsidian/50 dark:bg-black/20 border border-border rounded-md py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 transition-all"
            />
          </div>
        </div>

        {/* Account List */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
          <div className="text-xs font-mono text-text-muted mb-2 px-3 uppercase tracking-wider flex justify-between">
            <span>Connected Accounts</span>
            <button onClick={onSync} className="hover:text-neon-cyan transition-colors flex items-center gap-1 group" title="Sync current view">
              <span className="hidden group-hover:inline text-[10px]">SYNC VIEW</span>
              <ICONS.Refresh size={12} className={isSyncing ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="space-y-1">
            {filteredAccounts.slice(0, 50).map((acc) => (
              <div
                key={acc.id}
                onClick={() => handleAccountClick(acc.provider, acc.id)}
                className={`group flex items-center justify-between p-3 rounded-md cursor-pointer transition-all border ${currentFilter.accountId === acc.id
                  ? 'bg-neon-cyan/5 border-neon-cyan/20 shadow-sm'
                  : 'hover:bg-black/5 dark:hover:bg-white/5 border-transparent hover:border-border'
                  }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${acc.provider === 'gmail' ? 'bg-red-500' : 'bg-blue-500'}`} />
                  <div className="flex flex-col min-w-0">
                    <span className={`text-sm truncate font-medium transition-colors ${currentFilter.accountId === acc.id ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary'}`}>
                      {acc.email}
                    </span>
                    <span className="text-[10px] text-text-muted flex items-center gap-1">
                      {acc.status === 'syncing' ? (
                        <span className="text-neon-green">Syncing...</span>
                      ) : (
                        <span>Last: {acc.lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </span>
                  </div>
                </div>
                {acc.unreadCount > 0 && (
                  <span className="text-xs font-mono text-neon-cyan bg-neon-cyan/10 px-1.5 py-0.5 rounded">
                    {acc.unreadCount}
                  </span>
                )}
              </div>
            ))}
            {filteredAccounts.length > 50 && (
              <div className="p-4 text-center text-xs text-text-muted italic">
                + {filteredAccounts.length - 50} more accounts
              </div>
            )}
          </div>
        </div>

        {/* Theme Selector & Footer */}
        <div className="p-4 border-t border-border bg-charcoal">
          {/* Theme Buttons */}
          <div className="flex justify-between mb-4 gap-1 bg-obsidian/50 p-1 rounded-lg border border-border">
            <button
              onClick={() => onThemeChange('light')}
              className={`flex-1 h-7 rounded flex items-center justify-center gap-2 transition-all ${currentTheme === 'light' ? 'bg-white text-black shadow-sm' : 'text-text-muted hover:text-text-primary hover:bg-white/5'}`}
              title="Light Mode"
            >
              <Sun size={14} />
            </button>
            <button
              onClick={() => onThemeChange('dark')}
              className={`flex-1 h-7 rounded flex items-center justify-center gap-2 transition-all ${currentTheme === 'dark' ? 'bg-white/20 text-white shadow-sm' : 'text-text-muted hover:text-text-primary hover:bg-white/5'}`}
              title="Dark Mode"
            >
              <Moon size={14} />
            </button>
            <button
              onClick={() => onThemeChange('system')}
              className={`flex-1 h-7 rounded flex items-center justify-center gap-2 transition-all ${currentTheme === 'system' ? 'bg-white/20 text-white shadow-sm' : 'text-text-muted hover:text-text-primary hover:bg-white/5'}`}
              title="System Theme"
            >
              <Monitor size={14} />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button className="flex-1 flex items-center justify-center gap-2 p-2 rounded-md bg-glass hover:bg-black/5 dark:hover:bg-white/10 text-text-secondary hover:text-text-primary transition-colors text-xs border border-border">
              <ICONS.Settings size={14} />
              <span>Settings</span>
            </button>
            <button
              onClick={onAddAccount}
              className="flex-1 flex items-center justify-center gap-2 p-2 rounded-md bg-glass hover:bg-black/5 dark:hover:bg-white/10 text-text-secondary hover:text-text-primary transition-colors text-xs border border-border"
            >
              <ICONS.Add size={14} />
              <span>Add</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};