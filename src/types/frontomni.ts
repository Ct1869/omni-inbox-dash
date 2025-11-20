export type Provider = 'gmail' | 'outlook';
export type Theme = 'light' | 'dark' | 'system';

export interface EmailAccount {
  id: string;
  email: string;
  provider: Provider;
  unreadCount: number;
  lastSync: Date;
  status: 'connected' | 'syncing' | 'error';
}

export interface Email {
  id: string;
  accountId: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  body: string;
  timestamp: Date;
  isRead: boolean;
  isStarred: boolean;
  folder: 'inbox' | 'sent' | 'archive' | 'trash';
}

export interface FilterState {
  provider: 'all' | Provider;
  accountId: string | null; // New field for single account filtering
  onlyUnread: boolean;
  onlyStarred: boolean;
  folder: 'inbox' | 'sent' | 'archive' | 'trash' | 'starred';
  searchQuery: string;
}

export interface SyncStats {
  totalAccounts: number;
  syncing: number;
  failed: number;
  lastSyncCompleted: Date | null;
}