import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AccountsSidebar from "@/components/dashboard/AccountsSidebar";
import MessageList from "@/components/dashboard/MessageList";
import MessageDetail from "@/components/dashboard/MessageDetail";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

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
