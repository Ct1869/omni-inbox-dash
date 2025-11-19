import { memo } from 'react';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Star, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/pages/Dashboard";

interface MessageItemProps {
  message: Message;
  isSelected: boolean;
  onSelect: (message: Message) => void;
  isCheckboxSelected: boolean;
  onToggleCheckbox: (id: string) => void;
}

/**
 * Memoized MessageItem component to prevent unnecessary re-renders
 * Only re-renders when message data, selection state, or checkbox state changes
 */
const MessageItem = memo(({ 
  message, 
  isSelected, 
  onSelect, 
  isCheckboxSelected, 
  onToggleCheckbox 
}: MessageItemProps) => {
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

  const getBrandInfo = (email: string, name: string) => {
    const domain = email.toLowerCase().split('@')[1] || '';
    const nameLower = name.toLowerCase();
    
    // Brand detection
    const brands: Record<string, { color: string; initial: string }> = {
      'stripe.com': { color: 'bg-[#635BFF] text-white', initial: 'S' },
      'netflix.com': { color: 'bg-[#E50914] text-white', initial: 'N' },
      'linkedin.com': { color: 'bg-[#0A66C2] text-white', initial: 'in' },
      'asana.com': { color: 'bg-[#F06A6A] text-white', initial: 'A' },
      'figma.com': { color: 'bg-[#F24E1E] text-white', initial: 'F' },
      'docusign.com': { color: 'bg-[#FFCD00] text-black', initial: 'D' },
      'github.com': { color: 'bg-[#181717] text-white', initial: 'G' },
      'google.com': { color: 'bg-[#4285F4] text-white', initial: 'G' },
      'apple.com': { color: 'bg-black text-white', initial: 'A' },
      'microsoft.com': { color: 'bg-[#00A4EF] text-white', initial: 'M' },
      'slack.com': { color: 'bg-[#4A154B] text-white', initial: 'S' },
      'dropbox.com': { color: 'bg-[#0061FF] text-white', initial: 'D' },
      'zoom.us': { color: 'bg-[#2D8CFF] text-white', initial: 'Z' },
      'salesforce.com': { color: 'bg-[#00A1E0] text-white', initial: 'S' },
      'notion.so': { color: 'bg-black text-white', initial: 'N' },
      'trello.com': { color: 'bg-[#0079BF] text-white', initial: 'T' },
      'shopify.com': { color: 'bg-[#7AB55C] text-white', initial: 'S' },
    };
    
    // Check domain
    if (brands[domain]) {
      return brands[domain];
    }
    
    // Check name for brand keywords
    for (const [key, value] of Object.entries(brands)) {
      const brandName = key.split('.')[0];
      if (nameLower.includes(brandName)) {
        return value;
      }
    }
    
    return null;
  };

  const brandInfo = getBrandInfo(message.from.email, message.from.name);

  return (
    <div
      onClick={() => onSelect(message)}
      className={cn(
        "group relative flex cursor-default flex-col gap-1 p-4 text-sm transition-all hover:bg-accent/50",
        isSelected
          ? "bg-accent before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-primary"
          : "border-b border-border/40"
      )}
    >
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={isCheckboxSelected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleCheckbox(message.id);
            }}
            className="rounded border-border"
          />

          {brandInfo ? (
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
              brandInfo.color
            )}>
              {brandInfo.initial}
            </div>
          ) : (
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {getInitials(message.from.name)}
              </AvatarFallback>
            </Avatar>
          )}

          <span className={cn(
            "font-medium",
            message.isUnread ? "text-foreground font-semibold" : "text-muted-foreground"
          )}>
            {message.from.name}
          </span>
          {message.isUnread && (
            <span className="h-2 w-2 rounded-full bg-brand-teal animate-pulse" />
          )}
        </div>
        <span className={cn(
          "text-xs tabular-nums",
          isSelected ? "text-foreground" : "text-muted-foreground"
        )}>
          {formatDate(message.date)}
        </span>
      </div>

      <div className="flex items-center gap-2 ml-11">
        <span className={cn(
          "truncate font-medium",
          message.isUnread ? "text-foreground" : "text-foreground/80"
        )}>
          {message.subject}
        </span>
        {message.hasAttachments && (
          <Paperclip className="h-3 w-3 text-muted-foreground" />
        )}
        {message.isFlagged && (
          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
        )}
      </div>

      <div className="line-clamp-1 text-xs text-muted-foreground ml-11">
        {message.preview}
      </div>

      {message.labels && message.labels.length > 0 && (
        <div className="mt-2 flex items-center gap-2 ml-11">
          {message.labels.slice(0, 3).map((label) => (
            <Badge
              key={label}
              variant="outline"
              className="h-5 rounded-md border-border bg-background/50 px-1.5 text-[10px] font-normal text-muted-foreground group-hover:border-primary/30 group-hover:text-primary"
            >
              {label}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // PERFORMANCE: Custom comparison to prevent unnecessary re-renders
  // Only re-render if these specific props change
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.isUnread === nextProps.message.isUnread &&
    prevProps.message.isFlagged === nextProps.message.isFlagged &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isCheckboxSelected === nextProps.isCheckboxSelected
  );
});

MessageItem.displayName = 'MessageItem';

export default MessageItem;
