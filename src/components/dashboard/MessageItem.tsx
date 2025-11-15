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
        "px-4 py-3 border-b border-border cursor-pointer transition-colors hover:bg-muted/30",
        isSelected && "bg-muted/50",
        message.isUnread && "bg-muted/20"
      )}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isCheckboxSelected}
          onChange={(e) => {
            e.stopPropagation();
            onToggleCheckbox(message.id);
          }}
          className="mt-1"
        />
        
        {brandInfo ? (
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
            brandInfo.color
          )}>
            {brandInfo.initial}
          </div>
        ) : (
          <Avatar className="w-10 h-10 flex-shrink-0">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {getInitials(message.from.name)}
            </AvatarFallback>
          </Avatar>
        )}
        
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn(
                "text-sm truncate",
                message.isUnread ? "font-semibold text-foreground" : "font-normal text-muted-foreground"
              )}>
                {message.from.name}
              </span>
              {message.labels && message.labels.length > 0 && (
                <div className="flex gap-1">
                  {message.labels.slice(0, 2).map((label) => (
                    <Badge 
                      key={label} 
                      variant="secondary" 
                      className="text-xs px-1.5 py-0"
                    >
                      {label}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDate(message.date)}
              </span>
              {message.isFlagged && (
                <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
              )}
              {message.hasAttachments && (
                <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </div>
          </div>
          
          <div className={cn(
            "text-sm truncate",
            message.isUnread ? "font-medium text-foreground" : "text-muted-foreground"
          )}>
            {message.subject}
          </div>
          
          <div className="text-xs text-muted-foreground truncate">
            {message.preview}
          </div>
        </div>
      </div>
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
