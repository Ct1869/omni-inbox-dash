import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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

interface MessageDetailProps {
  message: Message | null;
  accountId?: string;
}

const MessageDetail = ({ message, accountId }: MessageDetailProps) => {
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

  useEffect(() => {
    const loadFullMessage = async () => {
      if (!message) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('cached_messages')
          .select('body_html, body_text, recipient_emails, received_at, has_attachments, attachment_count')
          .eq('id', message.id)
          .single();
        if (error) throw error;
        setBodyHtml(data?.body_html ?? null);
        setBodyText(data?.body_text ?? null);
        setRecipients(data?.recipient_emails ?? []);
        setReceivedAt(data?.received_at ?? null);
        setHasAttachments(!!data?.has_attachments);
        setAttachmentCount(data?.attachment_count ?? 0);
      } catch (err) {
        console.error('Load message detail error:', err);
        toast({ title: 'Failed to load message content', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    loadFullMessage();
  }, [message]);

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

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const formattedDate = useMemo(() => {
    const d = receivedAt ? new Date(receivedAt) : new Date(message.date);
    return d.toLocaleString();
  }, [receivedAt, message.date]);

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <h1 className="text-xl font-semibold mb-2">{message.subject}</h1>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {getInitials(message.from.name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-foreground font-medium">{message.from.name}</span>
            <span>&lt;{message.from.email}&gt;</span>
            {recipients.length > 0 && (
              <span className="truncate">to {recipients.join(", ")}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{formattedDate}</span>
            </div>
            {hasAttachments && (
              <div className="flex items-center gap-1">
                <Paperclip className="h-4 w-4" />
                <span>{attachmentCount}</span>
              </div>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Star className={cn("h-4 w-4", message.isFlagged && "fill-accent text-accent")} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Archive className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Message Body */}
      <ScrollArea className="flex-1 scrollbar-thin">
        <div className="p-6 max-w-3xl">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading message…</div>
          ) : bodyHtml ? (
            <article className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          ) : bodyText ? (
            <pre className="whitespace-pre-wrap text-sm text-foreground">{bodyText}</pre>
          ) : (
            <div className="text-sm text-muted-foreground">No content available.</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default MessageDetail;
