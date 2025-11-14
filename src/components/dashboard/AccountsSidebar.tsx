import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  Mail,
  RefreshCw,
  Bell
} from "lucide-react";
import gmailIcon from "@/assets/gmail-icon.svg";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
  onSyncAll?: () => void;
  refreshTrigger?: number;
  provider?: 'gmail' | 'outlook';
}

const AccountsSidebar = ({ selectedAccount, onSelectAccount, onConnectGmail, onConnectOutlook, onRefresh, onCompose, onSyncAll, refreshTrigger, provider }: AccountsSidebarProps) => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSettingUpWatches, setIsSettingUpWatches] = useState(false);
  const [accountFilter, setAccountFilter] = useState<'all' | 'gmail' | 'outlook'>('all');
  const [syncingAccounts, setSyncingAccounts] = useState<Set<string>>(new Set());
  const userEmail = localStorage.getItem("userEmail") || "user@email.com";
  const userName = userEmail.split("@")[0];
  
  const syncStatuses = useSyncStatus(accounts.map(a => a.id));
  
  const gmailAccounts = accounts.filter(a => a.provider === 'gmail');
  const outlookAccounts = accounts.filter(a => a.provider === 'outlook');
  const gmailUnread = gmailAccounts.reduce((sum, acc) => sum + acc.unreadCount, 0);
  const outlookUnread = outlookAccounts.reduce((sum, acc) => sum + acc.unreadCount, 0);

  const handleSyncNow = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    
    // If no account selected (Ultimate Inbox), sync all accounts
    if (!selectedAccount) {
      if (onSyncAll) {
        onSyncAll();
      }
      setIsSyncing(false);
      return;
    }
    
    // Sync individual account
    toast.loading(`Syncing ${selectedAccount.email}...`, { id: "sync" });
    try {
      const functionName = selectedAccount.provider === 'outlook' ? 'sync-outlook-messages' : 'sync-messages';
      const { error } = await supabase.functions.invoke(functionName, {
        body: { accountId: selectedAccount.id, maxMessages: 100 },
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

  const handleSyncAccount = async (accountId: string, provider: string) => {
    setSyncingAccounts(prev => new Set(prev).add(accountId));
    
    try {
      const functionName = provider === 'gmail' ? 'sync-messages' : 'sync-outlook-messages';
      const { error } = await supabase.functions.invoke(functionName, {
        body: { accountId },
      });

      if (error) throw error;

      toast.success(`${provider === 'gmail' ? 'Gmail' : 'Outlook'} account synced successfully`);
      onRefresh();
    } catch (error) {
      console.error("Sync error:", error);
      toast.error(`Failed to sync ${provider === 'gmail' ? 'Gmail' : 'Outlook'} account`);
    } finally {
      setSyncingAccounts(prev => {
        const next = new Set(prev);
        next.delete(accountId);
        return next;
      });
    }
  };

  const handleSyncAll = async () => {
    const accountsToSync = filteredAccounts;
    
    toast.info(`Syncing ${accountsToSync.length} account(s)...`);
    
    for (const account of accountsToSync) {
      await handleSyncAccount(account.id, account.provider || 'gmail');
    }
  };

  const handleSetupWatches = async () => {
    setIsSettingUpWatches(true);
    toast.loading("Setting up push notifications...", { id: "setup-watches" });
    
    try {
      // Setup Gmail watches
      const gmailAccounts = filteredAccounts.filter(a => a.provider === 'gmail');
      if (gmailAccounts.length > 0) {
        const { data: gmailData, error: gmailError } = await supabase.functions.invoke('setup-gmail-watches');
        if (gmailError) throw gmailError;
        
        const gmailResults = gmailData?.results || [];
        gmailResults.forEach((result: any) => {
          if (!result.success) {
            toast.error(`Gmail ${result.email}: ${result.message}`);
          }
        });
      }

      // Setup Outlook subscriptions
      const outlookAccounts = filteredAccounts.filter(a => a.provider === 'outlook');
      if (outlookAccounts.length > 0) {
        const { data: outlookData, error: outlookError } = await supabase.functions.invoke('setup-outlook-subscriptions');
        if (outlookError) throw outlookError;
        
        const outlookResults = outlookData?.results || [];
        outlookResults.forEach((result: any) => {
          if (!result.success) {
            toast.error(`Outlook ${result.email}: ${result.message}`);
          }
        });
      }

      toast.success("Push notifications setup complete", { id: "setup-watches" });
      onRefresh();
    } catch (err: any) {
      console.error("Setup notifications error:", err);
      toast.error(err.message || "Failed to setup push notifications", { id: "setup-watches" });
    } finally {
      setIsSettingUpWatches(false);
    }
  };

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setIsLoading(true);
        let query = supabase
          .from('email_accounts')
          .select('id, name, email, unread_count, provider')
          .order('created_at', { ascending: false });
        
        if (provider) {
          query = query.eq('provider', provider);
        }
        
        const { data, error } = await query;
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
  }, [refreshTrigger, provider]);

  const filteredAccounts = accounts.filter(account => {
    // If provider prop is set, it's already filtered at fetch level
    if (provider) return true;
    // Otherwise use the accountFilter state
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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="min-h-[44px] min-w-[44px]"
                  onClick={() => navigate('/dashboard/gmail')}
                >
                  <img src={gmailIcon} alt="Gmail" className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Gmail Inbox</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="min-h-[44px] min-w-[44px]"
                  onClick={() => navigate('/dashboard/outlook')}
                >
                  <Mail className="h-4 w-4 text-primary" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Outlook Inbox</TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
            disabled={isSyncing || accounts.length === 0}
          >
            <RefreshCcw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
            {selectedAccount ? 'Sync Now' : 'Sync All'}
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
                  <Bell className={cn("h-4 w-4", isSettingUpWatches && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Setup Push Notifications</p>
                <p className="text-xs text-muted-foreground">Enable real-time email updates</p>
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
          
          {/* Gmail Inbox - show on gmail pages or when no provider */}
          {(!provider || provider === 'gmail') && (
            <button
              onClick={() => {
                setAccountFilter('gmail');
                navigate('/dashboard/gmail');
              }}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-2 rounded-md transition-colors mb-1",
                !selectedAccount && accountFilter === 'gmail'
                  ? "bg-muted/50 text-foreground"
                  : "hover:bg-muted/30"
              )}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0">
                <Mail className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="flex-1 text-left min-w-0 overflow-hidden pr-1">
                <div className="font-medium text-sm truncate">Gmail Inbox</div>
                <div className="text-xs text-muted-foreground truncate">All Gmail accounts</div>
              </div>
              {gmailUnread > 0 && (
                <Badge variant="secondary" className="shrink-0">
                  {gmailUnread}
                </Badge>
              )}
            </button>
          )}

          {/* Outlook Inbox - show on outlook pages or when no provider */}
          {(!provider || provider === 'outlook') && (
            <button
              onClick={() => {
                setAccountFilter('outlook');
                navigate('/dashboard/outlook');
              }}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-2 rounded-md transition-colors mb-1",
                !selectedAccount && accountFilter === 'outlook'
                  ? "bg-muted/50 text-foreground"
                  : "hover:bg-muted/30"
              )}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0">
                <Mail className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="flex-1 text-left min-w-0 overflow-hidden pr-1">
                <div className="font-medium text-sm truncate">Outlook Inbox</div>
                <div className="text-xs text-muted-foreground truncate">All Outlook accounts</div>
              </div>
              {outlookUnread > 0 && (
                <Badge variant="secondary" className="shrink-0">
                  {outlookUnread}
                </Badge>
              )}
            </button>
          )}

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
                  const isSyncingThis = syncingAccounts.has(account.id);

                  return (
                    <div
                      key={account.id}
                      className="flex items-center gap-1 group"
                    >
                      <button
                        onClick={() => {
                          if (account.provider === 'gmail') {
                            navigate(`/dashboard/gmail/${account.id}`);
                          } else if (account.provider === 'outlook') {
                            navigate(`/dashboard/outlook/${account.id}`);
                          }
                          onSelectAccount(account);
                        }}
                        className={cn(
                          "flex-1 flex items-center gap-2 px-2 py-2 rounded-md transition-colors",
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSyncAccount(account.id, account.provider || 'gmail');
                        }}
                        disabled={isSyncingThis || isAccountSyncing}
                      >
                        <RefreshCw className={cn(
                          "h-3.5 w-3.5",
                          (isSyncingThis || isAccountSyncing) && "animate-spin"
                        )} />
                      </Button>
                    </div>
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
