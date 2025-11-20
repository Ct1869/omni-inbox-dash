import React from 'react';
import { Email } from '@/types/frontomni';
import { ICONS } from '@/constants/frontomni';

interface EmailDetailProps {
  email: Email | null;
  onClose: () => void;
  onReply: (email: Email) => void;
  onForward: (email: Email) => void;
}

export const EmailDetail: React.FC<EmailDetailProps> = ({ email, onClose, onReply, onForward }) => {
  if (!email) {
    return (
      <div className="hidden lg:flex flex-col items-center justify-center h-full w-full bg-charcoal/30 border-l border-border text-text-muted">
        <div className="w-16 h-16 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center mb-4">
          <ICONS.Mail className="opacity-50 w-8 h-8" />
        </div>
        <p>Select an email to view details</p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 lg:static lg:flex-1 h-full bg-obsidian z-20 lg:z-auto flex flex-col border-l border-border shadow-2xl lg:shadow-none">
      {/* Header Actions */}
      <div className="h-16 border-b border-border flex items-center justify-between px-6 bg-glass backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="lg:hidden p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full text-text-muted">
            <ICONS.Left size={20} />
          </button>
          <button className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full text-text-muted hover:text-text-primary transition-colors" title="Archive">
            <ICONS.Archive size={18} />
          </button>
          <button className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full text-text-muted hover:text-red-400 transition-colors" title="Delete">
            <ICONS.Trash size={18} />
          </button>
          <div className="w-[1px] h-6 bg-border mx-2"></div>
          <button className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full text-text-muted hover:text-yellow-400 transition-colors" title="Star">
            <ICONS.Star size={18} className={email.isStarred ? 'fill-yellow-400 text-yellow-400' : ''} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted font-mono">
            {email.timestamp.toLocaleString()}
          </span>
          <div className="flex">
            <button className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full text-text-muted">
              <ICONS.Left size={18} />
            </button>
            <button className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full text-text-muted">
              <ICONS.Right size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Email Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-text-primary mb-4 leading-tight">
              {email.subject}
            </h1>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                  {(email.fromName || '?').charAt(0)}
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-text-primary font-medium">{email.fromName}</span>
                    <span className="text-text-muted text-sm">&lt;{email.fromEmail}&gt;</span>
                  </div>
                  <div className="text-xs text-text-muted mt-0.5">
                    to me
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="prose prose-sm max-w-none text-text-secondary leading-relaxed border-t border-border pt-8 dark:prose-invert">
            <div dangerouslySetInnerHTML={{ __html: email.body }} />
          </div>

          {/* Quick Actions */}
          <div className="mt-12 flex gap-3 pt-8 border-t border-border">
            <button
              onClick={() => onReply(email)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-neon-cyan/10 border border-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/20 transition-all font-medium text-sm"
            >
              <ICONS.Reply size={16} />
              Reply
            </button>
            <button
              onClick={() => onForward(email)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-black/5 dark:bg-white/5 border border-border text-text-secondary hover:bg-black/10 dark:hover:bg-white/10 transition-all font-medium text-sm"
            >
              <ICONS.Forward size={16} />
              Forward
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};