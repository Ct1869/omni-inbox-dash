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
  provider?: 'gmail' | 'outlook';
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

  useEffect(() => {
    // Redirect to Gmail inbox by default
    navigate("/dashboard/gmail", { replace: true });
  }, [navigate]);

  return null;
};

export default Dashboard;

