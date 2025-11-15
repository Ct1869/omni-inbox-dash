import { Button } from "@/components/ui/button";
import { LogOut, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
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
  onLogout,
}: DashboardHeaderProps) => {
  // SECURITY: Removed localStorage usage - use Supabase auth via getUser() instead
  return null; // Header is now integrated into the layout itself
};

export default DashboardHeader;
