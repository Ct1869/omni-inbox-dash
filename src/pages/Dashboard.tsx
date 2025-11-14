import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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

export interface Account {
  id: string;
  name: string;
  email: string;
  unreadCount: number;
}

export interface Message {
  id: string;
  accountId: string;
  threadId: string;
  from: {
    name: string;
    email: string;
  };
  subject: string;
  preview: string;
  date: string;
  isUnread: boolean;
  isFlagged: boolean;
  hasAttachments: boolean;
  labels: string[];
  messageId?: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterFlagged, setFilterFlagged] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [mailboxView, setMailboxView] = useState<"inbox" | "sent">("inbox");

  // Online status and keyboard shortcuts
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

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get("code");
    const outlookConnected = searchParams.get("outlook_connected");
    
    if (code) {
      handleOAuthCallback(code);
      setSearchParams({});
    } else if (outlookConnected) {
      toast.success(`Outlook account connected: ${outlookConnected}`);
      setRefreshTrigger(prev => prev + 1);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const handleOAuthCallback = async (code: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in first");
        return;
      }

      const redirectUri = `${window.location.origin}/dashboard`;
      
      // Check if this is an Outlook callback (Microsoft adds state parameter)
      const state = searchParams.get("state");
      const isOutlook = state?.includes("outlook");
      
      const functionName = isOutlook ? "outlook-oauth" : "gmail-oauth";
      const provider = isOutlook ? "Outlook" : "Gmail";
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { code, redirectUri },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        console.error("Edge function error:", error);
        throw error;
      }

      if (!data || !data.account) {
        throw new Error("Invalid response from server");
      }

      toast.success(`${provider} account connected: ${data.account.email}`);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("OAuth error:", error);
      toast.error("Failed to connect email account");
    }
  };

  const initiateGmailOAuth = useCallback(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "392918695055-nord9i04nlslrmeea8r8h6c9ghspi48l.apps.googleusercontent.com";

    const redirectUri = `${window.location.origin}/dashboard`;
    const scope = "https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile openid";
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope,
      access_type: "offline",
      prompt: "consent",
    })}`;

    window.location.href = authUrl;
  }, []);

  const handleSelectAccount = useCallback((account: Account | null) => {
    setSelectedAccount(account);
    setSelectedMessage(null);
  }, []);

  const handleSelectMessage = useCallback((message: Message | null) => {
    setSelectedMessage(message);
  }, []);

  const handleSetMailboxView = useCallback((view: "inbox" | "sent") => {
    setMailboxView(view);
  }, []);

  const initiateOutlookOAuth = () => {
    const clientId = "5404f8de-9670-445c-a20c-d68ca4d02c2c";
    const redirectUri = `${window.location.origin}/dashboard`;
    const scope = "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/User.Read offline_access";
    
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope,
      response_mode: "query",
      state: `outlook_oauth_${window.location.origin}`,
    })}`;

    window.location.href = authUrl;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="h-screen flex flex-col lg:flex-row overflow-hidden bg-background">
      {/* Sidebar - hidden on mobile when account or message selected */}
      <div className={cn(
        "flex-shrink-0 h-full",
        (selectedAccount || selectedMessage) && "hidden lg:flex"
      )}>
        <AccountsSidebar
          selectedAccount={selectedAccount}
          onSelectAccount={handleSelectAccount}
          onConnectGmail={initiateGmailOAuth}
          onConnectOutlook={initiateOutlookOAuth}
          onRefresh={() => setRefreshTrigger(prev => prev + 1)}
          onCompose={() => {
            if (selectedAccount) {
              setIsComposeOpen(true);
            }
          }}
        />
      </div>
      
      {/* Message List - shown when account selected on mobile, always on desktop */}
      <div className={cn(
        "flex-1 flex flex-col overflow-hidden min-h-0",
        selectedMessage && "hidden lg:flex",
        !selectedAccount && "hidden lg:flex"
      )}>
        {/* Mailbox Tabs */}
        <div className="border-b border-border bg-background px-4 py-2">
          <div className="flex gap-2">
            <button
              onClick={() => handleSetMailboxView("inbox")}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                mailboxView === "inbox"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              Inbox
            </button>
            <button
              onClick={() => handleSetMailboxView("sent")}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                mailboxView === "sent"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              Sent
            </button>
          </div>
        </div>

        <MessageList
          selectedAccount={selectedAccount}
          selectedMessage={selectedMessage}
          onSelectMessage={handleSelectMessage}
          searchQuery={searchQuery}
          filterUnread={filterUnread}
          filterFlagged={filterFlagged}
          refreshTrigger={refreshTrigger}
          isUltimateInbox={!selectedAccount}
          mailboxView={mailboxView}
        />
      </div>
      
      {/* Message Detail - shown when message selected */}
      <div className={cn(
        "flex-1 min-w-0 h-full",
        !selectedMessage && "hidden lg:flex"
      )}>
        <MessageDetail
          message={selectedMessage}
          accountId={selectedAccount?.id}
          onMessageDeleted={() => {
            setRefreshTrigger(prev => prev + 1);
            setSelectedMessage(null);
          }}
        />
      </div>
      
      {selectedAccount && (
        <ComposeDialog
          open={isComposeOpen}
          onOpenChange={setIsComposeOpen}
          accountId={selectedAccount.id}
          accountEmail={selectedAccount.email}
        />
      )}
    </div>
  );
};

export default Dashboard;
