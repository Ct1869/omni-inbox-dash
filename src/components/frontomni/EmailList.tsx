import React, { useMemo } from 'react';
import { Email, FilterState } from '@/types/frontomni';
import { ICONS } from '@/constants/frontomni';

interface EmailListProps {
  emails: Email[];
  selectedEmailId: string | null;
  onSelectEmail: (email: Email) => void;
  filter: FilterState;
  onUpdateFilter: (updates: Partial<FilterState>) => void;
  loading: boolean;
  onToggleSidebar: () => void;
  checkedEmailIds: Set<string>;
  onToggleCheckEmail: (id: string) => void;
  onCheckAll: (ids: string[]) => void;
  onBulkDelete: () => void;
  onBulkMarkRead: () => void;
}

export const EmailList: React.FC<EmailListProps> = ({
  emails,
  selectedEmailId,
  onSelectEmail,
  filter,
  onUpdateFilter,
  loading,
  onToggleSidebar,
  checkedEmailIds,
  onToggleCheckEmail,
  onCheckAll,
  onBulkDelete,
  onBulkMarkRead
}) => {

  const allIds = useMemo(() => emails.map(e => e.id), [emails]);
  const isAllChecked = emails.length > 0 && checkedEmailIds.size === emails.length;
  const isBulkMode = checkedEmailIds.size > 0;

  const handleSelectAll = () => {
    if (isAllChecked) {
      onCheckAll([]);
    } else {
      onCheckAll(allIds);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-obsidian/90 relative w-full">
      {/* Toolbar */}
      <div className="h-16 border-b border-border flex items-center justify-between px-4 lg:px-6 backdrop-blur-md bg-glass z-10 shrink-0">

        {/* Bulk Action Bar Overlay */}
        {isBulkMode ? (
          <div className="absolute inset-0 bg-neon-cyan/10 backdrop-blur-xl z-20 flex items-center justify-between px-4 lg:px-6 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-4">
              <button
                onClick={handleSelectAll}
                className="flex items-center justify-center w-5 h-5 rounded border border-neon-cyan bg-neon-cyan text-black"
              >
                <ICONS.Check size={14} strokeWidth={3} />
              </button>
              <span className="text-neon-cyan font-medium text-sm">{checkedEmailIds.size} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onBulkMarkRead}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-text-primary text-xs font-medium transition-colors"
              >
                <ICONS.Mail size={14} />
                <span className="hidden sm:inline">Mark Read</span>
              </button>
              <button
                onClick={onBulkDelete}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-500 dark:text-red-200 text-xs font-medium transition-colors"
              >
                <ICONS.Trash size={14} />
                <span className="hidden sm:inline">Delete</span>
              </button>
              <div className="w-[1px] h-6 bg-border mx-2"></div>
              <button onClick={() => onCheckAll([])} className="p-1.5 hover:bg-white/10 rounded text-text-secondary">
                <ICONS.Close size={18} />
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-3 flex-1">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 -ml-2 text-text-secondary hover:text-text-primary"
          >
            <ICONS.More size={20} className="rotate-90" />
          </button>

          {/* Checkbox for Select All (Inactive State) */}
          <div className="hidden sm:flex items-center">
            <button
              onClick={handleSelectAll}
              className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isAllChecked
                  ? 'bg-neon-cyan border-neon-cyan text-black'
                  : 'border-text-muted hover:border-text-secondary bg-transparent'
                }`}
            >
              {isAllChecked && <ICONS.Check size={12} strokeWidth={3} />}
            </button>
          </div>

          <div className="relative w-full max-w-md">
            <ICONS.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
            <input
              type="text"
              placeholder="Search emails..."
              className="w-full bg-charcoal/50 border border-border rounded-full py-2 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-purple/50 transition-colors"
              value={filter.searchQuery}
              onChange={(e) => onUpdateFilter({ searchQuery: e.target.value })}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 ml-2">
          <button
            onClick={() => onUpdateFilter({ onlyUnread: !filter.onlyUnread })}
            className={`p-2 rounded-md transition-colors border hidden sm:block ${filter.onlyUnread ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30' : 'text-text-muted border-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}
            title="Unread only"
          >
            <div className="w-3 h-3 rounded-full border-2 border-current opacity-80"></div>
          </button>
          <button
            onClick={() => onUpdateFilter({ onlyStarred: !filter.onlyStarred })}
            className={`p-2 rounded-md transition-colors border hidden sm:block ${filter.onlyStarred ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' : 'text-text-muted border-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}
            title="Starred only"
          >
            <ICONS.Star size={18} className={filter.onlyStarred ? 'fill-current' : ''} />
          </button>
          <div className="flex bg-charcoal rounded-lg p-1 border border-border ml-1">
            <button
              onClick={() => onUpdateFilter({ folder: 'inbox' })}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${filter.folder === 'inbox' ? 'bg-glass text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
            >
              Inbox
            </button>
            <button
              onClick={() => onUpdateFilter({ folder: 'sent' })}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${filter.folder === 'sent' ? 'bg-glass text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
            >
              Sent
            </button>
          </div>
        </div>
      </div>

      {/* List Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-24 bg-black/5 dark:bg-white/5 rounded-lg animate-pulse border border-border"></div>
            ))}
          </div>
        ) : emails.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-text-muted">
            <ICONS.Inbox size={48} className="mb-4 opacity-20" />
            <p>No emails found matching your filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {emails.map((email) => {
              const isChecked = checkedEmailIds.has(email.id);
              return (
                <div
                  key={email.id}
                  className={`group flex items-start px-4 lg:px-6 py-4 cursor-pointer transition-all duration-200 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] ${selectedEmailId === email.id
                      ? 'bg-neon-cyan/[0.05] border-l-2 border-neon-cyan'
                      : 'border-l-2 border-transparent'
                    } ${!email.isRead ? 'bg-black/[0.02] dark:bg-white/[0.01]' : ''} ${isChecked ? 'bg-neon-cyan/[0.1]' : ''}`}
                >
                  {/* Selection Checkbox */}
                  <div className="pt-1 pr-4" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onToggleCheckEmail(email.id)}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isChecked
                          ? 'bg-neon-cyan border-neon-cyan text-black'
                          : 'border-text-muted hover:border-text-secondary bg-transparent text-transparent'
                        } ${!isChecked && 'opacity-0 group-hover:opacity-100 sm:opacity-100'}`} // Hide on mobile unless checked or active
                    >
                      <ICONS.Check size={10} strokeWidth={4} />
                    </button>
                  </div>

                  {/* Email Content */}
                  <div className="flex-1 min-w-0" onClick={() => onSelectEmail(email)}>
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-3 min-w-0">
                        {!email.isRead && (
                          <div className="w-2 h-2 rounded-full bg-neon-cyan shadow-[0_0_8px_rgba(0,243,255,0.5)] shrink-0"></div>
                        )}
                        <span className={`text-sm truncate ${!email.isRead ? 'text-text-primary font-semibold' : 'text-text-secondary'}`}>
                          {email.fromName}
                        </span>
                        <span className="hidden sm:inline-block text-[10px] text-text-muted px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 border border-border">
                          ...{email.accountId.slice(-4)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 pl-2 shrink-0">
                        <span className="text-xs text-text-muted font-mono whitespace-nowrap">
                          {email.timestamp.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                        <ICONS.Star
                          size={14}
                          className={`${email.isStarred ? 'text-yellow-400 fill-yellow-400' : 'text-text-muted group-hover:text-text-secondary'}`}
                        />
                      </div>
                    </div>
                    <div className="mb-0.5">
                      <h3 className={`text-sm truncate ${!email.isRead ? 'text-text-primary font-medium' : 'text-text-muted'}`}>
                        {email.subject}
                      </h3>
                    </div>
                    <p className="text-xs text-text-muted line-clamp-1 group-hover:text-text-secondary transition-colors">
                      {email.snippet}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};