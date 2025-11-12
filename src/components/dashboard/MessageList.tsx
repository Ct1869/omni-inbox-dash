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
import { supabase } from "@/integrations/supabase/client";



interface MessageListProps {
  selectedAccount: Account | null;
  selectedMessage: Message | null;
  onSelectMessage: (message: Message) => void;
  searchQuery: string;
  filterUnread: boolean;
  filterFlagged: boolean;
  refreshTrigger: number;
}

const MessageList = ({
  selectedAccount,
  selectedMessage,
  onSelectMessage,
  searchQuery,
  filterUnread,
  filterFlagged,
  refreshTrigger,
}: MessageListProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [localSearch, setLocalSearch] = useState("");

  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedAccount) {
        setMessages([]);
        return;
      }
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('cached_messages')
          .select('id, account_id, thread_id, sender_name, sender_email, subject, snippet, received_at, is_read, is_starred, has_attachments, labels')
          .eq('account_id', selectedAccount.id)
          .order('received_at', { ascending: false })
          .limit(100);
        if (error) throw error;
        const mapped: Message[] = (data || []).map((m: any) => ({
          id: m.id,
          accountId: m.account_id,
          threadId: m.thread_id || '',
          from: { name: m.sender_name || m.sender_email, email: m.sender_email },
          subject: m.subject || '(no subject)',
          preview: m.snippet || '',
          date: m.received_at,
          isUnread: !m.is_read,
          isFlagged: m.is_starred,
          hasAttachments: m.has_attachments,
          labels: m.labels || [],
        }));
        setMessages(mapped);
      } catch (err) {
        console.error('Load messages error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [selectedAccount, refreshTrigger]);

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
            placeholder="Search messages..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-9 bg-input border-border h-9"
          />
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
        ) : filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center p-8">
            <div>
              <Inbox className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {messages.length === 0 ? "No messages yet. Click 'Sync Now' to fetch emails." : "No messages match your filters"}
              </p>
            </div>
          </div>
        ) : (
          <div>
            {filteredMessages.map((message) => (
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
