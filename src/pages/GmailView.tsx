import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import AccountsSidebar from "@/components/dashboard/AccountsSidebar";
import MessageList from "@/components/dashboard/MessageList";
import MessageDetail from "@/components/dashboard/MessageDetail";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import ComposeDialog from "@/components/dashboard/ComposeDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import type { Account, Message } from "@/pages/Dashboard";
const GmailView = () => {
  const navigate = useNavigate();
  const {
    accountId
  } = useParams();
  const [searchParams] = useSearchParams();
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterFlagged, setFilterFlagged] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [mailboxView, setMailboxView] = useState<"inbox" | "sent">("inbox");
  const isOnline = useOnlineStatus();
  useKeyboardShortcuts({
    onCompose: useCallback(() => setIsComposeOpen(true), []),
    onRefresh: useCallback(() => setRefreshTrigger(prev => prev + 1), [])
  });

  // Check authentication
  useEffect(() => {
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      if (!session) {
        navigate("/auth");
      }
    });
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Load the selected Gmail account
  useEffect(() => {
    const loadAccount = async () => {
      if (!accountId) return;
      try {
        const {
          data,
          error
        } = await supabase.from('email_accounts').select('id, name, email, unread_count, provider').eq('id', accountId).eq('provider', 'gmail').single();
        if (error) throw error;
        if (data) {
          setSelectedAccount({
            id: data.id,
            name: data.name || data.email,
            email: data.email,
            unreadCount: data.unread_count ?? 0,
            provider: data.provider
          });
        }
      } catch (err) {
        console.error('Load account error:', err);
        toast.error('Failed to load Gmail account');
        navigate('/dashboard');
      }
    };
    loadAccount();
  }, [accountId, navigate, refreshTrigger]);
  const initiateGmailOAuth = async () => {
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('gmail-oauth', {
        body: {
          initiateOAuth: true
        }
      });
      if (error) throw error;
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (err: any) {
      console.error('Gmail OAuth error:', err);
      toast.error(err.message || 'Failed to initiate Gmail connection');
    }
  };
  const initiateOutlookOAuth = async () => {
    // Not needed in Gmail view, but keep for sidebar consistency
    toast.info('Please use Outlook view for Outlook accounts');
  };
  const handleSelectAccount = (account: Account | null) => {
    if (account) {
      if (account.provider === 'gmail') {
        navigate(`/dashboard/gmail/${account.id}`);
      } else {
        navigate(`/dashboard/outlook/${account.id}`);
      }
    } else {
      navigate('/dashboard');
    }
  };
  const handleSelectMessage = (message: Message | null) => {
    setSelectedMessage(message);
  };
  const handleSyncNow = async () => {
    if (!selectedAccount) return;
    toast.loading('Syncing Gmail messages...', {
      id: 'sync'
    });
    try {
      const {
        error
      } = await supabase.functions.invoke('sync-messages', {
        body: {
          accountId: selectedAccount.id,
          maxMessages: 100
        }
      });
      if (error) throw error;
      toast.success('Gmail synced successfully', {
        id: 'sync'
      });
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      console.error('Gmail sync error:', err);
      toast.error(err.message || 'Failed to sync Gmail', {
        id: 'sync'
      });
    }
  };
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };
  return <div className="flex h-screen overflow-hidden bg-background animate-fade-in">
      <AccountsSidebar selectedAccount={selectedAccount} onSelectAccount={handleSelectAccount} onConnectGmail={initiateGmailOAuth} onConnectOutlook={initiateOutlookOAuth} onRefresh={() => setRefreshTrigger(prev => prev + 1)} onCompose={() => setIsComposeOpen(true)} onSyncAll={handleSyncNow} refreshTrigger={refreshTrigger} provider="gmail" />
      
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} filterUnread={filterUnread} onFilterUnreadChange={setFilterUnread} filterFlagged={filterFlagged} onFilterFlaggedChange={setFilterFlagged} onLogout={handleLogout} />

        <div className="flex-1 flex overflow-hidden">
          <div className={cn("border-r border-border overflow-hidden", selectedMessage ? "hidden lg:flex lg:w-96" : "flex-1 lg:w-96")}>
            <div className="w-full h-full flex flex-col">
              <div className="p-4 border-b border-border">
                <div className="flex gap-2">
                  <button
                    onClick={() => setMailboxView("inbox")}
                    className={cn(
                      "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors",
                      mailboxView === "inbox"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    Inbox
                  </button>
                  <button
                    onClick={() => setMailboxView("sent")}
                    className={cn(
                      "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors",
                      mailboxView === "sent"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    Sent
                  </button>
                </div>
              </div>

              <MessageList selectedAccount={selectedAccount} selectedMessage={selectedMessage} onSelectMessage={handleSelectMessage} searchQuery={searchQuery} filterUnread={filterUnread} filterFlagged={filterFlagged} refreshTrigger={refreshTrigger} isUltimateInbox={false} mailboxView={mailboxView} />
            </div>
          </div>

          {selectedMessage && (
            <div className="flex-1 overflow-hidden">
              <MessageDetail 
                message={selectedMessage} 
                accountId={accountId} 
                onMessageDeleted={() => {
                  setSelectedMessage(null);
                  setRefreshTrigger(prev => prev + 1);
                }} 
                provider="gmail" 
              />
            </div>
          )}
        </div>
      </div>

      <ComposeDialog open={isComposeOpen} onOpenChange={setIsComposeOpen} accountId={selectedAccount?.id || ''} accountEmail={selectedAccount?.email || ''} provider="gmail" />
    </div>;
};
export default GmailView;