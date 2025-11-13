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
  onSelectAccount: (account: Account | null) => void;
  onConnectGmail: () => void;
  onRefresh: () => void;
  onCompose: () => void;
}

const AccountsSidebar = ({ selectedAccount, onSelectAccount, onConnectGmail, onRefresh, onCompose }: AccountsSidebarProps) => {
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
        <Button 
          variant="default" 
          className="w-full justify-start gap-2 mb-2"
          onClick={onCompose}
          disabled={!selectedAccount}
        >
          <Send className="h-4 w-4" />
          Compose
        </Button>
        <Button 
          variant="outline" 
          className="w-full justify-start gap-2 mb-2"
          onClick={handleSyncNow}
          disabled={!selectedAccount || isSyncing}
        >
          <RefreshCcw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </Button>
      </div>

      {/* Email Accounts */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          <div className="text-xs font-semibold text-muted-foreground px-2 py-1 mb-1">
            Inboxes
          </div>
          
          {/* Ultimate Inbox - All Accounts */}
          <button
            onClick={() => onSelectAccount(null)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors mb-1",
              !selectedAccount
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50"
            )}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Inbox className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="font-medium text-sm">Ultimate Inbox</div>
              <div className="text-xs text-muted-foreground">All accounts</div>
            </div>
          </button>

          <div className="text-xs font-semibold text-muted-foreground px-2 py-1 mb-1 mt-3">
            Email Accounts
          </div>
            <div className="space-y-0.5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 bg-muted/20 animate-pulse rounded-md mx-1" />
                ))
              ) : (
                accounts.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => onSelectAccount(account)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                      selectedAccount?.id === account.id
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50"
                    )}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {getInitials(account.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left min-w-0">
                      <div className="font-medium text-sm truncate">{account.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{account.email}</div>
                    </div>
                    {account.unreadCount > 0 && (
                      <Badge variant="secondary" className="ml-2 bg-primary text-primary-foreground h-5 px-1.5 text-xs">
                        {account.unreadCount}
                      </Badge>
                    )}
                  </button>
                ))
              )}
            </div>
        </div>
      </ScrollArea>
    </aside>
  );
};

export default AccountsSidebar;
