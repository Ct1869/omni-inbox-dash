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
  Check,
  Mail
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Account } from "@/pages/Dashboard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSyncStatus } from "@/hooks/useSyncStatus";



interface AccountsSidebarProps {
  selectedAccount: Account | null;
  onSelectAccount: (account: Account | null) => void;
  onConnectGmail: () => void;
  onConnectOutlook: () => void;
  onRefresh: () => void;
  onCompose: () => void;
  refreshTrigger?: number;
}

const AccountsSidebar = ({ selectedAccount, onSelectAccount, onConnectGmail, onConnectOutlook, onRefresh, onCompose, refreshTrigger }: AccountsSidebarProps) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSettingUpWatches, setIsSettingUpWatches] = useState(false);
  const [accountFilter, setAccountFilter] = useState<'all' | 'gmail' | 'outlook'>('all');
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
          .select('id, name, email, unread_count, provider')
          .order('created_at', { ascending: false });
        if (error) throw error;
        const mapped: Account[] = (data || []).map((a: any) => ({
          id: a.id,
          name: a.name || a.email,
          email: a.email,
          unreadCount: a.unread_count ?? 0,
          provider: a.provider,
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
  }, [refreshTrigger]);

  const filteredAccounts = accounts.filter(account => {
    if (accountFilter === 'all') return true;
    return account.provider === accountFilter;
  });

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="min-h-[44px] min-w-[44px]"
                title="Add email account"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onConnectGmail} className="cursor-pointer">
                <Mail className="h-4 w-4 mr-2" />
                Connect Gmail
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onConnectOutlook} className="cursor-pointer">
                <Mail className="h-4 w-4 mr-2" />
                Connect Outlook
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => setAccountFilter('all')} 
                className="cursor-pointer"
              >
                {accountFilter === 'all' && <Check className="h-4 w-4 mr-2" />}
                {accountFilter !== 'all' && <span className="w-4 mr-2" />}
                All Accounts
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setAccountFilter('gmail')} 
                className="cursor-pointer"
              >
                {accountFilter === 'gmail' && <Check className="h-4 w-4 mr-2" />}
                {accountFilter !== 'gmail' && <span className="w-4 mr-2" />}
                Gmail Only
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setAccountFilter('outlook')} 
                className="cursor-pointer"
              >
                {accountFilter === 'outlook' && <Check className="h-4 w-4 mr-2" />}
                {accountFilter !== 'outlook' && <span className="w-4 mr-2" />}
                Outlook Only
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
              "w-full flex items-center gap-2 px-2 py-2 rounded-md transition-colors mb-1",
              !selectedAccount
                ? "bg-muted/50 text-foreground"
                : "hover:bg-muted/30"
            )}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0">
              <Inbox className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex-1 text-left min-w-0 overflow-hidden pr-1">
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
                filteredAccounts.map((account) => {
                  const syncStatus = syncStatuses.get(account.id);
                  const isAccountSyncing = syncStatus?.status === "running";
                  const isSyncCompleted = syncStatus?.status === "completed";
                  const isSyncFailed = syncStatus?.status === "failed";
                  const isGmail = account.provider === 'gmail';

                  return (
                    <button
                      key={account.id}
                      onClick={() => onSelectAccount(account)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-2 rounded-md transition-colors",
                        selectedAccount?.id === account.id
                          ? "bg-muted/50 text-foreground"
                          : "hover:bg-muted/30"
                      )}
                    >
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className={cn(
                          "text-xs",
                          isGmail ? "bg-[hsl(4,82%,57%)]/10 text-[hsl(4,82%,57%)]" : "bg-primary/10 text-primary"
                        )}>
                          {getInitials(account.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-left min-w-0 overflow-hidden pr-1">
                        <div className="font-medium text-sm truncate">{account.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{account.email}</div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
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
                          <Badge 
                            variant="secondary" 
                            className={cn(
                              "h-5 px-2 text-xs min-w-[24px] justify-center flex-shrink-0",
                              isGmail 
                                ? "bg-[hsl(4,82%,57%)] text-white" 
                                : "bg-primary text-primary-foreground"
                            )}
                          >
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
