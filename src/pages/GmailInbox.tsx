import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AccountsSidebar from "@/components/dashboard/AccountsSidebar";
import MessageList from "@/components/dashboard/MessageList";
import MessageDetail from "@/components/dashboard/MessageDetail";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import ComposeDialog from "@/components/dashboard/ComposeDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import type { Account, Message } from "@/pages/Dashboard";

const GmailInbox = () => {
  const navigate = useNavigate();
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterFlagged, setFilterFlagged] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [mailboxView, setMailboxView] = useState<"inbox" | "sent">("inbox");
  const [gmailAccounts, setGmailAccounts] = useState<Account[]>([]);

  const isOnline = useOnlineStatus();
  
  useKeyboardShortcuts({
    onCompose: useCallback(() => setIsComposeOpen(true), []),
    onRefresh: useCallback(() => setRefreshTrigger(prev => prev + 1), []),
  });

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

  useEffect(() => {
    fetchGmailAccounts();
  }, [refreshTrigger]);

  const fetchGmailAccounts = async () => {
    const { data: accounts } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("provider", "gmail")
      .eq("is_active", true);

    if (accounts) {
      setGmailAccounts(accounts.map(acc => ({
        id: acc.id,
        name: acc.name || acc.email,
        email: acc.email,
        unreadCount: acc.unread_count || 0,
        provider: acc.provider as 'gmail'
      })));
    }
  };

  const initiateGmailOAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in first");
        return;
      }

      const redirectUri = `${window.location.origin}/dashboard`;
      const { data, error } = await supabase.functions.invoke("gmail-oauth", {
        body: { redirectUri },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate Gmail connection");
    }
  };

  const handleSyncAll = async () => {
    toast.loading("Syncing all Gmail accounts...", { id: "sync-all" });
    try {
      for (const account of gmailAccounts) {
        await supabase.functions.invoke("sync-messages", {
          body: { accountId: account.id, maxMessages: 100 },
        });
      }
      toast.success("All Gmail accounts synced", { id: "sync-all" });
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      toast.error("Failed to sync all accounts", { id: "sync-all" });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="flex h-screen bg-background">
      <AccountsSidebar
        selectedAccount={null}
        onSelectAccount={(account) => {
          if (account) {
            navigate(`/dashboard/gmail/${account.id}`);
          }
        }}
        onConnectGmail={initiateGmailOAuth}
        onConnectOutlook={() => {}}
        onRefresh={() => setRefreshTrigger(prev => prev + 1)}
        onCompose={() => setIsComposeOpen(true)}
        onSyncAll={handleSyncAll}
        refreshTrigger={refreshTrigger}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader
          searchQuery=""
          onSearchChange={() => {}}
          filterUnread={false}
          onFilterUnreadChange={() => {}}
          filterFlagged={false}
          onFilterFlaggedChange={() => {}}
          onLogout={handleLogout}
        />

        <div className="flex-1 flex overflow-hidden">
          <div className={selectedMessage ? "hidden lg:block lg:w-1/2" : "flex-1"}>
            <MessageList
              selectedAccount={null}
              selectedMessage={selectedMessage}
              onSelectMessage={setSelectedMessage}
              searchQuery={searchQuery}
              filterUnread={filterUnread}
              filterFlagged={filterFlagged}
              refreshTrigger={refreshTrigger}
              isUltimateInbox={true}
              mailboxView={mailboxView}
              onMailboxViewChange={setMailboxView}
              provider="gmail"
            />
          </div>

          {selectedMessage && (
            <div className="flex-1 lg:w-1/2 border-l">
              <MessageDetail
                message={selectedMessage}
                accountId={selectedMessage.accountId}
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

      <ComposeDialog
        open={isComposeOpen}
        onOpenChange={setIsComposeOpen}
        accountId={gmailAccounts[0]?.id || ""}
        accountEmail={gmailAccounts[0]?.email || ""}
        provider="gmail"
      />
    </div>
  );
};

export default GmailInbox;
