import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import AccountsSidebar from "@/components/dashboard/AccountsSidebar";
import MessageList from "@/components/dashboard/MessageList";
import MessageDetail from "@/components/dashboard/MessageDetail";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import ComposeDialog from "@/components/dashboard/ComposeDialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { Menu, ArrowLeft, Mail } from "lucide-react";
import type { Account, Message } from "@/pages/Dashboard";
import ErrorBoundary, { CompactErrorFallback } from "@/components/ErrorBoundary";

const OutlookView = () => {
  const navigate = useNavigate();
  const { accountId } = useParams();
  const [searchParams] = useSearchParams();
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterFlagged, setFilterFlagged] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [mailboxView, setMailboxView] = useState<"inbox" | "sent">("inbox");

  // Mobile state management
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);

  const isOnline = useOnlineStatus();
  
  useKeyboardShortcuts({
    onCompose: useCallback(() => setIsComposeOpen(true), []),
    onRefresh: useCallback(() => setRefreshTrigger(prev => prev + 1), []),
  });

  // Check authentication
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Load the selected Outlook account
  useEffect(() => {
    const loadAccount = async () => {
      if (!accountId) return;
      
      try {
        const { data, error } = await supabase
          .from('email_accounts')
          .select('id, name, email, unread_count, provider')
          .eq('id', accountId)
          .eq('provider', 'outlook')
          .single();
        
        if (error) throw error;
        
        if (data) {
          setSelectedAccount({
            id: data.id,
            name: data.name || data.email,
            email: data.email,
            unreadCount: data.unread_count ?? 0,
            provider: data.provider,
          });
        }
      } catch (err) {
        console.error('Load account error:', err);
        toast.error('Failed to load Outlook account');
        navigate('/dashboard');
      }
    };

    loadAccount();
  }, [accountId, navigate, refreshTrigger]);

  // Mobile resize listener
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth < 1024); // lg breakpoint
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-close sidebar when message is selected on mobile
  useEffect(() => {
    if (isMobileView && selectedMessage) {
      setIsMobileSidebarOpen(false);
    }
  }, [selectedMessage, isMobileView]);

  const initiateGmailOAuth = async () => {
    // Not needed in Outlook view, but keep for sidebar consistency
    toast.info('Please use Gmail view for Gmail accounts');
  };

  const initiateOutlookOAuth = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('outlook-oauth', {
        body: { initiateOAuth: true }
      });
      if (error) throw error;
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (err: any) {
      console.error('Outlook OAuth error:', err);
      toast.error(err.message || 'Failed to initiate Outlook connection');
    }
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
    
    toast.loading('Syncing Outlook messages...', { id: 'sync' });
    try {
      const { error } = await supabase.functions.invoke('sync-outlook-messages', {
        body: { accountId: selectedAccount.id, maxMessages: 100 },
      });
      if (error) throw error;
      toast.success('Outlook synced successfully', { id: 'sync' });
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      console.error('Outlook sync error:', err);
      toast.error(err.message || 'Failed to sync Outlook', { id: 'sync' });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background animate-fade-in">
      {/* Mobile overlay backdrop */}
      {isMobileView && isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar with mobile slide-in */}
      <div className={cn(
        "fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto transition-transform duration-300 lg:translate-x-0",
        isMobileView && !isMobileSidebarOpen && "-translate-x-full"
      )}>
        <ErrorBoundary
          fallback={<CompactErrorFallback title="Sidebar Error" message="Failed to load accounts" />}
          showReload={false}
        >
          <AccountsSidebar
            selectedAccount={selectedAccount}
            onSelectAccount={handleSelectAccount}
            onConnectGmail={initiateGmailOAuth}
            onConnectOutlook={initiateOutlookOAuth}
            onRefresh={() => setRefreshTrigger(prev => prev + 1)}
            onCompose={() => setIsComposeOpen(true)}
            onSyncAll={handleSyncNow}
            refreshTrigger={refreshTrigger}
            provider="outlook"
          />
        </ErrorBoundary>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header with hamburger */}
        {isMobileView && (
          <div className="flex items-center gap-2 p-4 border-b lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">
              {selectedAccount?.name || 'Outlook Inbox'}
            </h1>
          </div>
        )}

        <DashboardHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterUnread={filterUnread}
          onFilterUnreadChange={setFilterUnread}
          filterFlagged={filterFlagged}
          onFilterFlaggedChange={setFilterFlagged}
          onLogout={handleLogout}
        />

        <div className="flex-1 flex overflow-hidden">
          <div className={cn(
            "border-r border-border overflow-hidden",
            selectedMessage 
              ? "hidden lg:flex lg:w-96" 
              : "flex-1 lg:w-96"
          )}>
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

              <ErrorBoundary 
                fallback={<CompactErrorFallback title="Message List Error" message="Failed to load messages" />}
                showReload={false}
              >
                <MessageList
                  selectedAccount={selectedAccount}
                  selectedMessage={selectedMessage}
                  onSelectMessage={handleSelectMessage}
                  searchQuery={searchQuery}
                  filterUnread={filterUnread}
                  filterFlagged={filterFlagged}
                  refreshTrigger={refreshTrigger}
                  isUltimateInbox={false}
                  mailboxView={mailboxView}
                />
              </ErrorBoundary>
            </div>
          </div>

          <div className={cn(
            "flex-1 overflow-hidden flex flex-col",
            !selectedMessage && "hidden lg:flex"
          )}>
            {/* Mobile back button */}
            {isMobileView && selectedMessage && (
              <div className="flex items-center gap-2 p-4 border-b lg:hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedMessage(null)}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <Mail className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium truncate">
                  {selectedMessage.subject || '(No Subject)'}
                </span>
              </div>
            )}

            <div className="flex-1 overflow-hidden">
              <ErrorBoundary
                fallback={<CompactErrorFallback title="Message Details Error" message="Failed to load message details" />}
                showReload={false}
              >
                <MessageDetail
                  message={selectedMessage}
                  accountId={selectedAccount?.id}
                  provider="outlook"
                  onMessageDeleted={() => {
                    setSelectedMessage(null);
                    setRefreshTrigger(prev => prev + 1);
                  }}
                />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </div>

      <ComposeDialog
        open={isComposeOpen}
        onOpenChange={setIsComposeOpen}
        accountId={selectedAccount?.id || ''}
        accountEmail={selectedAccount?.email || ''}
        provider="outlook"
      />
    </div>
  );
};

export default OutlookView;
