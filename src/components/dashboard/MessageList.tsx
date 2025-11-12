import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Search, 
  Star, 
  Paperclip, 
  Circle, 
  X, 
  Filter,
  Bell,
  Users,
  Tag,
  Zap,
  Inbox
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Account, Message } from "@/pages/Dashboard";

// Mock data generator
const generateMockMessages = (accountId: string): Message[] => {
  const subjects = [
    "Q4 Report Review",
    "Meeting Follow-up",
    "Project Update Required",
    "Invoice #12345",
    "Weekly Newsletter",
    "Security Alert",
    "Team Lunch Tomorrow",
    "Contract Renewal",
    "Design review feedback",
    "Payment confirmation",
  ];
  
  const senders = [
    { name: "John Smith", email: "john@client.com" },
    { name: "Sarah Johnson", email: "sarah@partner.com" },
    { name: "Mike Williams", email: "mike@vendor.com" },
    { name: "Emily Davis", email: "emily@company.com" },
    { name: "Ali Mamedgasanov", email: "ali@baked.design" },
    { name: "Stripe", email: "no-reply@stripe.com" },
    { name: "Netflix", email: "info@netflix.com" },
  ];

  return Array.from({ length: 50 }, (_, i) => ({
    id: `msg-${accountId}-${i}`,
    accountId,
    threadId: `thread-${Math.floor(i / 3)}`,
    from: senders[i % senders.length],
    subject: `${subjects[i % subjects.length]} - ${i + 1}`,
    preview: "This is a preview of the email message content that will be displayed in the list...",
    date: new Date(Date.now() - i * 3600000).toISOString(),
    isUnread: i < 10,
    isFlagged: i % 7 === 0,
    hasAttachments: i % 5 === 0,
    labels: ["Inbox", i % 3 === 0 ? "Important" : ""],
  }));
};

interface MessageListProps {
  selectedAccount: Account | null;
  selectedMessage: Message | null;
  onSelectMessage: (message: Message) => void;
  searchQuery: string;
  filterUnread: boolean;
  filterFlagged: boolean;
}

const MessageList = ({
  selectedAccount,
  selectedMessage,
  onSelectMessage,
  searchQuery,
  filterUnread,
  filterFlagged,
}: MessageListProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [localSearch, setLocalSearch] = useState("");

  useEffect(() => {
    if (selectedAccount) {
      setIsLoading(true);
      setTimeout(() => {
        setMessages(generateMockMessages(selectedAccount.id));
        setIsLoading(false);
      }, 300);
    } else {
      setMessages([]);
    }
  }, [selectedAccount]);

  const filteredMessages = messages.filter((msg) => {
    const query = (searchQuery || localSearch).toLowerCase();
    if (query && !msg.subject.toLowerCase().includes(query) &&
        !msg.from.name.toLowerCase().includes(query)) {
      return false;
    }
    if (filterUnread && !msg.isUnread) return false;
    if (filterFlagged && !msg.isFlagged) return false;
    return true;
  });

  const pinnedMessages = filteredMessages.slice(0, 3);
  const regularMessages = filteredMessages.slice(3);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    
    if (hours < 1) return "Just now";
    if (hours < 24) return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    if (hours < 168) return date.toLocaleDateString("en-US", { weekday: "short" });
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  if (!selectedAccount) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Circle className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Select an Account</h3>
          <p className="text-sm text-muted-foreground">
            Choose a client account to view their messages
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[420px] border-r border-border bg-card flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            Inbox
          </h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-9 bg-input border-border h-9"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" className="h-8">
            <Zap className="h-3 w-3 mr-1" />
            Primary
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Bell className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Users className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Users className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Tag className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages List */}
      <ScrollArea className="flex-1 scrollbar-thin">
        {isLoading ? (
          <div className="p-2 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted/20 animate-pulse rounded-md" />
            ))}
          </div>
        ) : (
          <div>
            {/* Pinned Section */}
            {pinnedMessages.length > 0 && (
              <div className="border-b border-border">
                <div className="px-4 py-2 text-xs font-medium text-muted-foreground">
                  Pinned [{pinnedMessages.length}]
                </div>
                {pinnedMessages.map((message) => (
                  <MessageItem
                    key={message.id}
                    message={message}
                    isSelected={selectedMessage?.id === message.id}
                    onClick={() => onSelectMessage(message)}
                    formatDate={formatDate}
                    getInitials={getInitials}
                  />
                ))}
              </div>
            )}

            {/* Primary Section */}
            <div>
              <div className="px-4 py-2 text-xs font-medium text-muted-foreground">
                Primary [{regularMessages.length}]
              </div>
              {regularMessages.map((message) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  isSelected={selectedMessage?.id === message.id}
                  onClick={() => onSelectMessage(message)}
                  formatDate={formatDate}
                  getInitials={getInitials}
                />
              ))}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

interface MessageItemProps {
  message: Message;
  isSelected: boolean;
  onClick: () => void;
  formatDate: (date: string) => string;
  getInitials: (name: string) => string;
}

const MessageItem = ({ message, isSelected, onClick, formatDate, getInitials }: MessageItemProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-border/50 transition-colors relative",
        "hover:bg-hover-bg",
        isSelected && "bg-selected-bg",
        message.isUnread && "bg-unread-bg/50"
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-9 w-9 flex-shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary text-xs">
            {getInitials(message.from.name)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn(
                "text-sm truncate",
                message.isUnread ? "font-semibold text-foreground" : "text-foreground"
              )}>
                {message.from.name}
              </span>
              {message.threadId && (
                <span className="text-xs text-muted-foreground">[6]</span>
              )}
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDate(message.date)}
            </span>
          </div>
          
          <div className={cn(
            "text-sm mb-1 truncate",
            message.isUnread ? "font-medium text-foreground" : "text-muted-foreground"
          )}>
            {message.subject}
          </div>
          
          <div className="flex items-center gap-2">
            {message.isFlagged && (
              <div className="w-2 h-2 rounded-full bg-accent" />
            )}
            {message.hasAttachments && (
              <div className="w-2 h-2 rounded-full bg-primary" />
            )}
            {message.isUnread && (
              <div className="w-2 h-2 rounded-full bg-accent" />
            )}
          </div>
        </div>
      </div>
    </button>
  );
};

export default MessageList;
