import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, LogOut, Mail, Filter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DashboardHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterUnread: boolean;
  onFilterUnreadChange: (value: boolean) => void;
  filterFlagged: boolean;
  onFilterFlaggedChange: (value: boolean) => void;
  onLogout: () => void;
}

const DashboardHeader = ({
  searchQuery,
  onSearchChange,
  filterUnread,
  onFilterUnreadChange,
  filterFlagged,
  onFilterFlaggedChange,
  onLogout,
}: DashboardHeaderProps) => {
  const userEmail = localStorage.getItem("userEmail");

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 gap-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Mail className="w-4 h-4 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-semibold">Email Hub</h1>
        </div>
      </div>

      <div className="flex-1 max-w-2xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-muted/50"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuCheckboxItem
              checked={filterUnread}
              onCheckedChange={onFilterUnreadChange}
            >
              Unread only
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filterFlagged}
              onCheckedChange={onFilterFlaggedChange}
            >
              Flagged only
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              {userEmail?.split("@")[0] || "User"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              {userEmail}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={onLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default DashboardHeader;
