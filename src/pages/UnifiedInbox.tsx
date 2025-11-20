import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/frontomni/Sidebar';
import { EmailList } from '@/components/frontomni/EmailList';
import { EmailDetail } from '@/components/frontomni/EmailDetail';
import { ComposeModal } from '@/components/frontomni/ComposeModal';
import { AddAccountModal } from '@/components/frontomni/AddAccountModal';
import { Email, EmailAccount, FilterState, Provider, Theme } from '@/types/frontomni';
import { ICONS } from '@/constants/frontomni';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function UnifiedInbox() {
    const navigate = useNavigate();

    // State
    const [accounts, setAccounts] = useState<EmailAccount[]>([]);
    const [emails, setEmails] = useState<Email[]>([]);
    const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [checkedEmailIds, setCheckedEmailIds] = useState<Set<string>>(new Set());
    const [currentTheme, setCurrentTheme] = useState<Theme>('dark');

    // Filter State
    const [filter, setFilter] = useState<FilterState>({
        provider: 'all',
        accountId: null,
        onlyUnread: false,
        onlyStarred: false,
        folder: 'inbox',
        searchQuery: ''
    });

    // Theme Logic
    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');

        if (currentTheme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            root.classList.add(systemTheme);
        } else {
            root.classList.add(currentTheme);
        }
    }, [currentTheme]);

    // Auth Check
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                navigate("/auth");
            }
        });
    }, [navigate]);

    // Fetch Accounts
    const fetchAccounts = async () => {
        console.log('🔍 [DEBUG] Fetching accounts...');

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            console.error('❌ [DEBUG] No authenticated user:', userError);
            toast.error('Please log in to view accounts');
            navigate('/auth');
            return;
        }

        console.log('[DEBUG] User ID:', user.id);

        const { data: accs, error } = await supabase
            .from('email_accounts')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true);

        if (error) {
            console.error('❌ [DEBUG] Error fetching accounts:', error);
            toast.error('Failed to load accounts');
            return;
        }

        console.log('✅ [DEBUG] Accounts fetched:', accs?.length || 0, 'accounts');
        console.log('[DEBUG] Account data:', accs);

        if (accs) {
            const mappedAccounts: EmailAccount[] = accs.map(acc => ({
                id: acc.id,
                email: acc.email,
                provider: acc.provider as Provider,
                unreadCount: acc.unread_count || 0,
                lastSync: new Date(acc.last_synced_at || Date.now()),
                status: 'connected' // Assuming connected if active
            }));
            console.log('📧 [DEBUG] Mapped accounts:', mappedAccounts);
            setAccounts(mappedAccounts);
        }
    };

    // Fetch Emails
    const fetchEmails = async () => {
        console.log('📬 [DEBUG] Fetching emails with filter:', filter);
        setIsLoading(true);
        try {
            let query = supabase
                .from('cached_messages')
                .select('*')
                .order('received_at', { ascending: false })
                .limit(50); // Pagination to be added later

            if (filter.accountId) {
                console.log('[DEBUG] Filtering by accountId:', filter.accountId);
                query = query.eq('account_id', filter.accountId);
            } else if (filter.provider !== 'all') {
                // Need to join with accounts to filter by provider, or fetch accounts first and filter by IDs
                // For now, client-side filtering or improved query if schema supports it
                // Assuming we fetch all for 'all' and filter in memory if needed, or better:
                // Get account IDs for provider
                const accountIds = accounts.filter(a => a.provider === filter.provider).map(a => a.id);
                console.log('[DEBUG] Filtering by provider:', filter.provider, 'Account IDs:', accountIds);
                if (accountIds.length > 0) {
                    query = query.in('account_id', accountIds);
                }
            }

            if (filter.onlyUnread) {
                console.log('[DEBUG] Filtering unread only');
                query = query.eq('is_read', false);
            }

            // Folder Filtering
            if (filter.folder === 'sent') {
                console.log('[DEBUG] Filtering sent folder');
                query = query.contains('labels', ['SENT']); // Assuming 'SENT' label for sent emails
            } else if (filter.folder === 'trash') {
                console.log('[DEBUG] Filtering trash folder');
                query = query.contains('labels', ['TRASH']);
            } else if (filter.folder === 'starred') {
                console.log('[DEBUG] Filtering starred');
                query = query.eq('is_starred', true);
            } else {
                console.log('[DEBUG] Default inbox view');
                // Default to inbox (exclude sent/trash unless explicitly asked?)
                // For now, just don't filter by label implies 'all mail' or 'inbox' depending on provider
                // A common pattern is to exclude TRASH and SPAM from default view
                // query = query.not('labels', 'cs', '{"TRASH","SPAM"}'); 
            }

            // Search Query
            if (filter.searchQuery) {
                console.log('[DEBUG] Search query:', filter.searchQuery);
                const q = `%${filter.searchQuery}%`;
                query = query.or(`subject.ilike.${q},sender_name.ilike.${q},sender_email.ilike.${q},body_text.ilike.${q}`);
            }

            const { data: msgs, error } = await query;

            if (error) throw error;

            console.log('✅ [DEBUG] Emails fetched:', msgs?.length || 0, 'emails');
            console.log('[DEBUG] Email data sample:', msgs?.slice(0, 2));

            if (msgs) {
                const mappedEmails: Email[] = msgs.map(msg => ({
                    id: msg.id,
                    accountId: msg.account_id,
                    fromName: msg.sender_name || msg.sender_email || 'Unknown',
                    fromEmail: msg.sender_email,
                    subject: msg.subject || '(No Subject)',
                    snippet: msg.snippet || '',
                    body: msg.body_text || msg.body_html || '', // Use text body if available
                    timestamp: new Date(msg.received_at),
                    isRead: msg.is_read || false,
                    isStarred: false, // Schema might not have this yet
                    folder: 'inbox' // Defaulting to inbox for now
                }));
                console.log('📧 [DEBUG] Mapped emails:', mappedEmails.length);
                setEmails(mappedEmails);
            }
        } catch (err) {
            console.error('❌ [DEBUG] Error fetching emails:', err);
            toast.error('Failed to load emails');
        } finally {
            setIsLoading(false);
        }
    };

    // Initial Load
    useEffect(() => {
        fetchAccounts();
    }, []);

    // Fetch emails when filter or accounts change
    useEffect(() => {
        if (accounts.length > 0) {
            fetchEmails();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter, accounts.length]); // Use accounts.length to avoid infinite loop

    const handleSync = async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        toast.info('Syncing emails...');

        try {
            // Determine which accounts to sync
            const accountsToSync = filter.accountId
                ? accounts.filter(a => a.id === filter.accountId)
                : filter.provider !== 'all'
                    ? accounts.filter(a => a.provider === filter.provider)
                    : accounts;

            const results = await Promise.allSettled(accountsToSync.map(async (acc) => {
                const functionName = acc.provider === 'outlook' ? 'sync-outlook-messages' : 'sync-messages';
                const { error } = await supabase.functions.invoke(functionName, {
                    body: { accountId: acc.id, maxMessages: 20 }
                });

                if (error) {
                    // Check for 401 Auth Error
                    // @ts-ignore - context exists on FunctionsHttpError
                    if (error.context && error.context.status === 401) {
                        throw new Error("AUTH_FAILED");
                    }
                    console.error(`Sync failed for ${acc.email}:`, error);
                    throw error;
                }
            }));

            const failed = results.filter(r => r.status === 'rejected');
            if (failed.length > 0) {
                // @ts-ignore - reason exists on rejected promise
                const authFailed = failed.some(r => r.reason.message === "AUTH_FAILED");

                if (authFailed) {
                    toast.error("Session expired. Please reconnect your account.", {
                        action: {
                            label: "Reconnect",
                            onClick: () => setIsAddAccountOpen(true)
                        },
                        duration: 5000
                    });
                } else {
                    console.error('Some sync jobs failed', results);
                    toast.warning(`Sync complete with ${failed.length} errors`);
                }
            } else {
                toast.success('Sync complete');
            }

            await fetchAccounts(); // Refresh accounts to get new unread counts
            await fetchEmails(); // Refresh email list
        } catch (err) {
            console.error('Sync error:', err);
            toast.error('Sync failed');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSendEmail = async (accountId: string, to: string, subject: string, body: string) => {
        const account = accounts.find(a => a.id === accountId);
        if (!account) {
            toast.error('Account not found');
            return;
        }

        const toastId = toast.loading('Sending email...');
        try {
            const functionName = account.provider === 'outlook' ? 'send-outlook-reply' : 'send-reply';
            const { data, error } = await supabase.functions.invoke(functionName, {
                body: {
                    accountId,
                    composeData: { to, subject, body }
                }
            });

            if (error) throw error;

            toast.success('Email sent successfully', { id: toastId });
            setIsComposeOpen(false);
        } catch (err) {
            console.error('Failed to send email:', err);
            toast.error('Failed to send email', { id: toastId });
        }
    };

    const handleFilterChange = (provider: Provider | 'all', accountId: string | null) => {
        setFilter(prev => ({ ...prev, provider, accountId }));
        setSelectedEmail(null);
        setCheckedEmailIds(new Set());
    };

    const handleUpdateFilter = (updates: Partial<FilterState>) => {
        setFilter(prev => ({ ...prev, ...updates }));
    };

    const toggleCheckEmail = (id: string) => {
        const newSet = new Set(checkedEmailIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setCheckedEmailIds(newSet);
    };

    const checkAllEmails = (ids: string[]) => {
        setCheckedEmailIds(new Set(ids));
    };

    const handleBulkDelete = async () => {
        if (confirm(`Delete ${checkedEmailIds.size} emails?`)) {
            // Implement delete logic here
            toast.info('Delete functionality not yet connected to backend');
            setEmails(prev => prev.filter(e => !checkedEmailIds.has(e.id)));
            setCheckedEmailIds(new Set());
        }
    };

    const handleBulkMarkRead = async () => {
        // Implement mark read logic here
        toast.info('Mark read functionality not yet connected to backend');
        setEmails(prev => prev.map(e =>
            checkedEmailIds.has(e.id) ? { ...e, isRead: true } : e
        ));
        setCheckedEmailIds(new Set());
    };

    const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);

    const handleAddAccount = () => {
        setIsAddAccountOpen(true);
    };

    const handleSelectProvider = async (provider: 'gmail' | 'outlook') => {
        setIsAddAccountOpen(false);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: provider === 'gmail' ? 'google' : 'azure',
                options: {
                    redirectTo: window.location.origin + '/dashboard',
                    scopes: provider === 'gmail'
                        ? 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify'
                        : 'Mail.Read Mail.Send Mail.ReadWrite'
                }
            });
            if (error) throw error;
        } catch (err) {
            console.error('OAuth error:', err);
            toast.error('Failed to start login flow');
        }
    };

    const [composeState, setComposeState] = useState<{
        to: string;
        subject: string;
        body: string;
    }>({ to: '', subject: '', body: '' });

    const handleReply = (email: Email) => {
        setComposeState({
            to: email.fromEmail,
            subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
            body: `\n\n\nOn ${email.timestamp.toLocaleString()}, ${email.fromName} wrote:\n> ${email.snippet}`
        });
        setIsComposeOpen(true);
    };

    const handleForward = (email: Email) => {
        setComposeState({
            to: '',
            subject: email.subject.startsWith('Fwd:') ? email.subject : `Fwd: ${email.subject}`,
            body: `\n\n\n---------- Forwarded message ---------\nFrom: ${email.fromName} <${email.fromEmail}>\nDate: ${email.timestamp.toLocaleString()}\nSubject: ${email.subject}\n\n${email.snippet}` // Note: snippet is a proxy for body text here
        });
        setIsComposeOpen(true);
    };

    const handleOpenCompose = () => {
        setComposeState({ to: '', subject: '', body: '' });
        setIsComposeOpen(true);
    };

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-obsidian text-text-primary font-sans selection:bg-neon-cyan/30">

            {/* Sidebar - Account Management */}
            <Sidebar
                accounts={accounts}
                currentFilter={{ provider: filter.provider, accountId: filter.accountId }}
                onFilterChange={handleFilterChange}
                onSync={handleSync}
                isSyncing={isSyncing}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                currentTheme={currentTheme}
                onThemeChange={setCurrentTheme}
                onAddAccount={handleAddAccount}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex relative w-full">
                {/* Email List */}
                <div className={`${selectedEmail ? 'hidden lg:flex' : 'flex'} w-full lg:w-[450px] border-r border-border flex-col`}>
                    <EmailList
                        emails={emails}
                        selectedEmailId={selectedEmail?.id || null}
                        onSelectEmail={setSelectedEmail}
                        filter={filter}
                        onUpdateFilter={handleUpdateFilter}
                        loading={isLoading}
                        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                        checkedEmailIds={checkedEmailIds}
                        onToggleCheckEmail={toggleCheckEmail}
                        onCheckAll={checkAllEmails}
                        onBulkDelete={handleBulkDelete}
                        onBulkMarkRead={handleBulkMarkRead}
                    />
                </div>

                {/* Email Detail / Reading Pane */}
                <div className={`${selectedEmail ? 'flex' : 'hidden lg:flex'} flex-1 bg-charcoal relative z-0`}>
                    <EmailDetail
                        email={selectedEmail}
                        onClose={() => setSelectedEmail(null)}
                        onReply={handleReply}
                        onForward={handleForward}
                    />
                </div>

                {/* Floating Compose Button */}
                <button
                    onClick={handleOpenCompose}
                    className="absolute bottom-6 right-6 lg:bottom-8 lg:right-8 w-12 h-12 lg:w-14 lg:h-14 bg-neon-cyan hover:bg-cyan-400 text-black rounded-full shadow-[0_0_20px_rgba(0,243,255,0.4)] flex items-center justify-center transition-all transform hover:scale-110 z-30"
                    title="Compose"
                >
                    <ICONS.Compose size={24} />
                </button>
            </div>

            {/* Modals */}
            <ComposeModal
                isOpen={isComposeOpen}
                onClose={() => setIsComposeOpen(false)}
                accounts={accounts}
                defaultFromId={filter.accountId}
                defaultProvider={filter.provider}
                onSend={handleSendEmail}
                initialTo={composeState.to}
                initialSubject={composeState.subject}
                initialBody={composeState.body}
            />

            <AddAccountModal
                isOpen={isAddAccountOpen}
                onClose={() => setIsAddAccountOpen(false)}
                onSelectProvider={handleSelectProvider}
            />
        </div>
    );
}
