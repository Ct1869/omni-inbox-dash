import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Inbox, 
  Star, 
  FileText, 
  Send, 
  Archive, 
  AlertCircle, 
  Trash2,
  ChevronDown,
  Plus,
  MoreHorizontal,
  RefreshCcw
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Account } from "@/pages/Dashboard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";



interface AccountsSidebarProps {
  selectedAccount: Account | null;
  onSelectAccount: (account: Account) => void;
  onConnectGmail: () => void;
  onRefresh: () => void;
}

const AccountsSidebar = ({ selectedAccount, onSelectAccount, onConnectGmail, onRefresh }: AccountsSidebarProps) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const userEmail = localStorage.getItem("userEmail") || "user@email.com";
  const userName = userEmail.split("@")[0];

  const handleSyncNow = async () => {
    if (!selectedAccount || isSyncing) return;
    setIsSyncing(true);
    toast.loading("Syncing messages...", { id: "sync" });
    try {
      const { error } = await supabase.functions.invoke("sync-messages", {
        body: { accountId: selectedAccount.id },
      });
      if (error) throw error;
      toast.success("Messages synced successfully", { id: "sync" });
      onRefresh();
    } catch (err: any) {
      console.error("Sync error:", err);
      toast.error(err.message || "Failed to sync messages", { id: "sync" });
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('email_accounts')
          .select('id, name, email, unread_count')
          .order('created_at', { ascending: false });
        if (error) throw error;
        const mapped: Account[] = (data || []).map((a: any) => ({
          id: a.id,
          name: a.name || a.email,
          email: a.email,
          unreadCount: a.unread_count ?? 0,
        }));
        setAccounts(mapped);
      } catch (err) {
        console.error('Load accounts error:', err);
        toast.error('Failed to load accounts');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAccounts();
  }, []);

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };


  return (
    <aside className="w-64 bg-background border-r border-border flex flex-col">
      {/* User Profile */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {getInitials(userName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{userName}</div>
            <div className="text-xs text-muted-foreground truncate">{userEmail}</div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6"
            onClick={onConnectGmail}
            title="Connect Gmail account"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
        
        <Button className="w-full justify-start bg-secondary hover:bg-secondary/80 text-secondary-foreground">
          <Plus className="h-4 w-4 mr-2" />
          New email
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 scrollbar-thin">
        <div className="p-2">
          {/* Sync Button */}
          {selectedAccount && (
            <div className="mb-4 px-1">
              <Button
                onClick={handleSyncNow}
                disabled={isSyncing}
                variant="outline"
                className="w-full justify-start"
                size="sm"
              >
                <RefreshCcw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
                {isSyncing ? "Syncing..." : "Sync Now"}
              </Button>
            </div>
          )}

          {/* Accounts Section */}
          <div>
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
              Client Accounts ({accounts.length})
            </div>
            <div className="space-y-0.5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-9 bg-muted/20 animate-pulse rounded-md mx-1" />
                ))
              ) : (
                accounts.slice(0, 10).map((account) => (
                  <button
                    key={account.id}
                    onClick={() => onSelectAccount(account)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                      selectedAccount?.id === account.id
                        ? "bg-selected-bg text-foreground"
                        : "text-muted-foreground hover:bg-hover-bg hover:text-foreground"
                    )}
                  >
                    <span className="truncate">{account.name}</span>
                    {account.unreadCount > 0 && (
                      <Badge variant="secondary" className="ml-2 bg-unread-indicator text-primary-foreground h-5 px-1.5 text-xs">
                        {account.unreadCount}
                      </Badge>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
};

export default AccountsSidebar;
