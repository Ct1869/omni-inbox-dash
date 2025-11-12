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

  // Check authentication
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      navigate("/login");
    }
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

      const { data, error } = await supabase.functions.invoke("gmail-oauth", {
        body: { code },
      });

      if (error) throw error;

      toast.success(`Gmail account connected: ${data.account.email}`);
    } catch (error) {
      console.error("OAuth error:", error);
      toast.error("Failed to connect Gmail account");
    }
  };

  const initiateGmailOAuth = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
          redirectTo: `${window.location.origin}/dashboard`,
        }
      });

      if (error) {
        toast.error("Failed to initiate Google sign-in");
        console.error(error);
      }
    } catch (error) {
      console.error("OAuth error:", error);
      toast.error("Failed to connect Gmail account");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userRole");
    navigate("/login");
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
      />
      
      <MessageList
        selectedAccount={selectedAccount}
        selectedMessage={selectedMessage}
        onSelectMessage={setSelectedMessage}
        searchQuery={searchQuery}
        filterUnread={filterUnread}
        filterFlagged={filterFlagged}
      />
      
      <MessageDetail
        message={selectedMessage}
        accountId={selectedAccount?.id}
      />
    </div>
  );
};

export default Dashboard;
