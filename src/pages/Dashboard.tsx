import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AccountsSidebar from "@/components/dashboard/AccountsSidebar";
import MessageList from "@/components/dashboard/MessageList";
import MessageDetail from "@/components/dashboard/MessageDetail";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
    if (code) {
      handleOAuthCallback(code);
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
      
      const { data, error } = await supabase.functions.invoke("gmail-oauth", {
        body: { code, redirectUri },
      });

      if (error) throw error;

      toast.success(`Gmail account connected: ${data.account.email}`);
    } catch (error) {
      console.error("OAuth error:", error);
      toast.error("Failed to connect Gmail account");
    }
  };

  const initiateGmailOAuth = () => {
    const clientId = "392918695055-nord9i04nlslrmeea8r8h6c9ghspi48l.apps.googleusercontent.com";

    const redirectUri = `${window.location.origin}/dashboard`;
    const scope = "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile openid";
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope,
      access_type: "offline",
      prompt: "consent",
    })}`;

    window.location.href = authUrl;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <AccountsSidebar
        selectedAccount={selectedAccount}
        onSelectAccount={(account) => {
          setSelectedAccount(account);
          setSelectedMessage(null);
        }}
        onConnectGmail={initiateGmailOAuth}
        onRefresh={() => setRefreshTrigger(prev => prev + 1)}
      />
      
      <MessageList
        selectedAccount={selectedAccount}
        selectedMessage={selectedMessage}
        onSelectMessage={setSelectedMessage}
        searchQuery={searchQuery}
        filterUnread={filterUnread}
        filterFlagged={filterFlagged}
        refreshTrigger={refreshTrigger}
      />
      
      <MessageDetail
        message={selectedMessage}
        accountId={selectedAccount?.id}
      />
    </div>
  );
};

export default Dashboard;
