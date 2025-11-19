import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Reply,
  Forward,
  Star,
  Archive,
  Trash2,
  MoreHorizontal,
  Clock,
  Paperclip,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Message } from "@/pages/Dashboard";
import { supabase } from "@/integrations/supabase/client";
import EmailViewer from "./EmailViewer";
import { replyEmailSchema } from "@/lib/validation";
import { z } from "zod";
import { useRateLimit } from "@/hooks/useRateLimit";

interface MessageDetailProps {
  message: Message | null;
  accountId?: string;
  onMessageDeleted?: () => void;
  provider?: 'gmail' | 'outlook';
}

const MessageDetail = ({ message, accountId, onMessageDeleted, provider = 'gmail' }: MessageDetailProps) => {
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bodyHtml, setBodyHtml] = useState<string | null>(null);
  const [bodyText, setBodyText] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [receivedAt, setReceivedAt] = useState<string | null>(null);
  const [hasAttachments, setHasAttachments] = useState(false);
  const [attachmentCount, setAttachmentCount] = useState<number>(0);
  const { toast } = useToast();

  // SECURITY: Rate limit email actions to prevent spam
  const rateLimitReply = useRateLimit(10, 60000); // 10 replies per minute
  const rateLimitForward = useRateLimit(5, 60000); // 5 forwards per minute
  const rateLimitDelete = useRateLimit(20, 60000); // 20 deletes per minute

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const formattedDate = useMemo(() => {
    if (!message) return '';
    const d = receivedAt ? new Date(receivedAt) : new Date(message.date);
    return d.toLocaleString();
  }, [receivedAt, message]);

  useEffect(() => {
    const loadFullMessage = async () => {
      if (!message) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('cached_messages')
          .select('body_html, body_text, recipient_emails, received_at, has_attachments, attachment_count, message_id')
          .eq('id', message.id)
          .maybeSingle();
        if (error) throw error;
        setBodyHtml(data?.body_html ?? null);
        setBodyText(data?.body_text ?? null);
        setRecipients(data?.recipient_emails ?? []);
        setReceivedAt(data?.received_at ?? null);
        setHasAttachments(!!data?.has_attachments);
        setAttachmentCount(data?.attachment_count ?? 0);

        // Mark as read when opening
        if (message.isUnread && accountId && data?.message_id) {
          const functionName = provider === 'outlook' ? 'send-outlook-reply' : 'send-reply';
          supabase.functions.invoke(functionName, {
            body: {
              accountId,
              messageId: data.message_id,
              markAsRead: true,
            },
          }).catch(err => console.error('Mark as read error:', err));
        }
      } catch (err) {
        console.error('Load message detail error:', err);
        toast({ title: 'Failed to load message content', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    loadFullMessage();
  }, [message, toast, accountId]);

  const handleReplyInternal = async () => {
    if (!message || !accountId) return;
    
    // SECURITY: Validate reply content
    const validated = replyEmailSchema.parse({
      to: message.from.email,
      body: replyText.trim()
    });

    setIsSending(true);
    try {
      const functionName = provider === 'outlook' ? 'send-outlook-reply' : 'send-reply';
      const { error } = await supabase.functions.invoke(functionName, {
        body: {
          accountId,
          messageId: message.id,
          replyText: validated.body,
        },
      });
      if (error) throw error;
      toast({ title: 'Reply sent successfully' });
      setReplyText('');
      setIsReplying(false);
    } finally {
      setIsSending(false);
    }
  };

  const handleReply = async () => {
    try {
      await rateLimitReply(handleReplyInternal)();
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({ 
          title: 'Validation error', 
          description: err.errors[0].message,
          variant: 'destructive' 
        });
      } else {
        console.error('Send reply error:', err);
        toast({ 
          title: 'Failed to send reply', 
          description: err instanceof Error ? err.message : "Unknown error",
          variant: 'destructive' 
        });
      }
    }
  };

  const handleForwardInternal = async (email: string) => {
    if (!message || !accountId) return;
    
    // SECURITY: Validate email address
    const validated = z.string().email("Invalid email format").parse(email.trim());
    
    const functionName = provider === 'outlook' ? 'send-outlook-reply' : 'send-reply';
    const { error } = await supabase.functions.invoke(functionName, {
      body: {
        accountId,
        messageId: message.id,
        forwardTo: validated,
      },
    });
    if (error) throw error;
    toast({ title: 'Message forwarded' });
  };

  const handleForward = async () => {
    const email = prompt('Forward to (email):');
    if (!email) return;
    
    try {
      await rateLimitForward(() => handleForwardInternal(email))();
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({ 
          title: 'Invalid email address', 
          description: 'Please enter a valid email address',
          variant: 'destructive' 
        });
      } else {
        console.error('Forward error:', err);
        toast({ 
          title: 'Failed to forward', 
          description: err instanceof Error ? err.message : "Unknown error",
          variant: 'destructive' 
        });
      }
    }
  };

  const handleDeleteInternal = async () => {
    if (!message || !accountId) return;
    if (!confirm('Move this message to trash?')) return;
    
    const functionName = provider === 'outlook' ? 'send-outlook-reply' : 'send-reply';
    const { error } = await supabase.functions.invoke(functionName, {
      body: {
        accountId,
        messageId: message.id,
        action: 'delete',
      },
    });
    if (error) throw error;
    toast({ title: 'Message deleted' });
    onMessageDeleted?.();
  };

  const handleDelete = async () => {
    try {
      await rateLimitDelete(handleDeleteInternal)();
    } catch (err) {
      console.error('Delete error:', err);
      toast({ 
        title: 'Failed to delete', 
        description: err instanceof Error ? err.message : "Unknown error",
        variant: 'destructive' 
      });
    }
  };

  if (!message) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Reply className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Message Selected</h3>
          <p className="text-sm text-muted-foreground">
            Select a message from the list to view its contents
          </p>
        </div>
      </div>
    );
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="flex-1 flex flex-col bg-background h-full overflow-hidden">
        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-border flex-shrink-0">
          <Skeleton className="h-7 w-3/4 mb-3" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <ScrollArea className="flex-1 px-4 md:px-6 py-4">
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-32 w-full mt-4" />
            <Skeleton className="h-32 w-full" />
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background h-full overflow-hidden">
      {/* Header - Fixed with responsive padding */}
      <div className="px-4 md:px-6 py-3 md:py-4 border-b border-border flex-shrink-0 bg-background sticky top-0 z-10">
        <h1 className="text-lg md:text-xl font-semibold mb-2 line-clamp-2">{message.subject}</h1>
        
        {/* Sender Info - Responsive Stack */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Avatar className="h-6 w-6 flex-shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {getInitials(message.from.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-1 min-w-0 flex-wrap text-sm text-muted-foreground">
              <span className="text-foreground font-medium truncate">{message.from.name}</span>
              <span className="truncate">&lt;{message.from.email}&gt;</span>
              {recipients.length > 0 && (
                <span className="truncate hidden md:inline">to {recipients.join(", ")}</span>
              )}
            </div>
          </div>
          
          {/* Action Buttons - Responsive */}
          <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
            <div className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground">
              <Clock className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">{formattedDate}</span>
            </div>
            {hasAttachments && (
              <div className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground">
                <Paperclip className="h-3 w-3 md:h-4 md:w-4" />
                <span>{attachmentCount}</span>
              </div>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8">
              <Star className={cn("h-3 w-3 md:h-4 md:w-4", message.isFlagged && "fill-accent text-accent")} />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 hidden sm:flex" onClick={handleForward} title="Forward">
              <Forward className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 hidden sm:flex">
              <Archive className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 text-destructive" onClick={handleDelete} title="Delete">
              <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8">
              <MoreHorizontal className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Message Body - Scrollable with responsive padding */}
      <ScrollArea className="flex-1 overflow-auto">
        <div className="p-4 md:p-6 w-full max-w-5xl mx-auto">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading message…</div>
          ) : (
            <EmailViewer htmlContent={bodyHtml} textContent={bodyText} />
          )}

          {/* Reply Section - Responsive */}
          {!isReplying ? (
            <div className="mt-6 md:mt-8">
              <Button onClick={() => setIsReplying(true)} className="w-full md:w-auto">
                <Reply className="w-4 h-4 mr-2" />
                Reply
              </Button>
            </div>
          ) : (
            <div className="mt-6 md:mt-8 space-y-4">
              <Textarea
                placeholder="Type your reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="min-h-24 md:min-h-32 bg-input border-border"
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsReplying(false);
                    setReplyText('');
                  }}
                  disabled={isSending}
                  className="text-sm"
                >
                  Cancel
                </Button>
                <Button onClick={handleReply} disabled={!replyText.trim() || isSending} className="text-sm">
                  {isSending ? 'Sending...' : 'Send Reply'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default MessageDetail;
