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
  RefreshCcw,
  Check
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Account } from "@/pages/Dashboard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSyncStatus } from "@/hooks/useSyncStatus";



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
  const [isSettingUpWatches, setIsSettingUpWatches] = useState(false);
  const userEmail = localStorage.getItem("userEmail") || "user@email.com";
  const userName = userEmail.split("@")[0];
  
  const syncStatuses = useSyncStatus(accounts.map(a => a.id));

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

  const handleSetupWatches = async () => {
    setIsSettingUpWatches(true);
    toast.loading("Setting up push notifications...", { id: "setup-watches" });
    
    try {
      const { data, error } = await supabase.functions.invoke("setup-gmail-watches");
      
      if (error) throw error;
      
      // Show summary
      const results = data.results || [];
      const successful = results.filter((r: any) => r.success).length;
      const failed = results.filter((r: any) => !r.success).length;
      
      if (failed === 0) {
        toast.success(`Push notifications enabled for ${successful} account(s)`, { id: "setup-watches" });
      } else {
        toast.warning(`Enabled for ${successful} account(s), ${failed} failed`, { id: "setup-watches" });
      }
      
      // Show detailed results
      results.forEach((result: any) => {
        if (!result.success) {
          toast.error(`${result.email}: ${result.message}`);
        }
      });
      
      onRefresh();
    } catch (err: any) {
      console.error("Setup watches error:", err);
      toast.error(err.message || "Failed to setup push notifications", { id: "setup-watches" });
    } finally {
      setIsSettingUpWatches(false);
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
    <aside className="w-full lg:w-64 bg-background border-r border-border flex flex-col">
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
        <div className="flex gap-2 mb-2">
          <Button 
            variant="outline" 
            className="flex-1 justify-start gap-2"
            onClick={handleSyncNow}
            disabled={!selectedAccount || isSyncing}
          >
            <RefreshCcw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleSetupWatches}
                  disabled={isSettingUpWatches || accounts.length === 0}
                  className="shrink-0"
                >
                  <RefreshCcw className={cn("h-4 w-4", isSettingUpWatches && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Setup Push Notifications</p>
                <p className="text-xs text-muted-foreground">Enable auto-sync for all accounts</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
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
              "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors mb-1 overflow-hidden",
              !selectedAccount
                ? "bg-muted/50 text-foreground"
                : "hover:bg-muted/30"
            )}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0">
              <Inbox className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex-1 text-left min-w-0 overflow-hidden">
              <div className="font-medium text-sm truncate">Ultimate Inbox</div>
              <div className="text-xs text-muted-foreground truncate">All accounts</div>
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
                accounts.map((account) => {
                  const syncStatus = syncStatuses.get(account.id);
                  const isAccountSyncing = syncStatus?.status === "running";
                  const isSyncCompleted = syncStatus?.status === "completed";
                  const isSyncFailed = syncStatus?.status === "failed";

                  return (
                    <button
                      key={account.id}
                      onClick={() => onSelectAccount(account)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors overflow-hidden",
                        selectedAccount?.id === account.id
                          ? "bg-muted/50 text-foreground"
                          : "hover:bg-muted/30"
                      )}
                    >
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {getInitials(account.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-left min-w-0 overflow-hidden">
                        <div className="font-medium text-sm truncate">{account.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{account.email}</div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Sync status indicator */}
                        {isAccountSyncing && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <RefreshCcw className="h-3.5 w-3.5 text-blue-500 animate-spin" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Syncing... {syncStatus.messagesSynced} messages</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        
                        {isSyncFailed && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">Sync failed: {syncStatus.errorMessage}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        
                        {isSyncCompleted && (
                          <Check className="h-3.5 w-3.5 text-green-500 animate-fade-in" />
                        )}

                        {account.unreadCount > 0 && (
                          <Badge variant="secondary" className="bg-primary text-primary-foreground h-5 px-1.5 text-xs min-w-[20px] justify-center">
                            {account.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
        </div>
      </ScrollArea>
    </aside>
  );
};

export default AccountsSidebar;
