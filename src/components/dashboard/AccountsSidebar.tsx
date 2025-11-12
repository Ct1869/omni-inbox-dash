import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Mail } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Account } from "@/pages/Dashboard";

// Mock data - replace with actual API call
const generateMockAccounts = (): Account[] => {
  const domains = ["company1.com", "company2.com", "startup.io", "enterprise.net", "agency.co"];
  const names = ["Tech Corp", "Innovate Inc", "Digital Agency", "Enterprise Solutions", "Creative Studio"];
  
  return Array.from({ length: 25 }, (_, i) => ({
    id: `account-${i + 1}`,
    name: `${names[i % names.length]} ${Math.floor(i / 5) + 1}`,
    email: `client${i + 1}@${domains[i % domains.length]}`,
    unreadCount: Math.floor(Math.random() * 50),
  }));
};

interface AccountsSidebarProps {
  selectedAccount: Account | null;
  onSelectAccount: (account: Account) => void;
}

const AccountsSidebar = ({ selectedAccount, onSelectAccount }: AccountsSidebarProps) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setAccounts(generateMockAccounts());
      setIsLoading(false);
    }, 500);
  }, []);

  const filteredAccounts = accounts.filter(
    (account) =>
      account.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="w-72 border-r bg-card flex flex-col">
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search accounts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="mt-3 text-sm text-muted-foreground">
          {filteredAccounts.length} accounts
        </div>
      </div>

      <ScrollArea className="flex-1 scrollbar-thin">
        <div className="p-2">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-muted animate-pulse rounded-lg"
                />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredAccounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => onSelectAccount(account)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg transition-colors",
                    "hover:bg-hover-bg",
                    selectedAccount?.id === account.id && "bg-selected-bg"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Mail className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {account.name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {account.email}
                          </div>
                        </div>
                      </div>
                    </div>
                    {account.unreadCount > 0 && (
                      <Badge
                        variant="secondary"
                        className="bg-unread-indicator text-primary-foreground text-xs"
                      >
                        {account.unreadCount}
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
};

export default AccountsSidebar;
