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
}

const AccountsSidebar = ({ selectedAccount, onSelectAccount, onConnectGmail }: AccountsSidebarProps) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const userEmail = localStorage.getItem("userEmail") || "user@email.com";
  const userName = userEmail.split("@")[0];

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

  const navItems = [
    { icon: Inbox, label: "Inbox", count: 281, active: true },
    { icon: Star, label: "Favorites", count: 0 },
    { icon: FileText, label: "Drafts", count: 13 },
    { icon: Send, label: "Sent", count: 0 },
  ];

  const managementItems = [
    { icon: Archive, label: "Archive", count: 0 },
    { icon: AlertCircle, label: "Spam", count: 24 },
    { icon: Trash2, label: "Bin", count: 0 },
  ];

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
          {/* Core Section */}
          <div className="mb-4">
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground">Core</div>
            <div className="space-y-0.5">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                    item.active 
                      ? "bg-selected-bg text-foreground" 
                      : "text-muted-foreground hover:bg-hover-bg hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.count > 0 && (
                    <span className="text-xs text-muted-foreground">{item.count}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Management Section */}
          <div className="mb-4">
            <button className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
              <span>Management</span>
              <ChevronDown className="h-3 w-3" />
            </button>
            <div className="space-y-0.5">
              {managementItems.map((item) => (
                <button
                  key={item.label}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-hover-bg hover:text-foreground transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.count > 0 && (
                    <span className="text-xs">{item.count}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

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
