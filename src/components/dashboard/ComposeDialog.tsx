import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { composeEmailSchema, type ComposeEmailInput } from "@/lib/validation";
import { z } from "zod";
import { useRateLimit } from "@/hooks/useRateLimit";

interface ComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountEmail: string;
  provider?: 'gmail' | 'outlook';
}

const ComposeDialog = ({ open, onOpenChange, accountId, accountEmail, provider = 'gmail' }: ComposeDialogProps) => {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();
  
  // SECURITY: Rate limit to 5 emails per minute to prevent spam
  const rateLimitSend = useRateLimit(5, 60000);

  const handleSendInternal = async () => {
    // SECURITY: Validate all inputs before sending
    const validated: ComposeEmailInput = composeEmailSchema.parse({
      to: to.trim(),
      subject: subject.trim(),
      body: body
    });

    setIsSending(true);
    
    try {
      const functionName = provider === 'outlook' ? 'send-outlook-reply' : 'send-reply';
      const { error } = await supabase.functions.invoke(functionName, {
        body: {
          accountId,
          composeData: {
            to: validated.to,
            subject: validated.subject,
            body: validated.body || " ",
          },
        },
      });

      if (error) throw error;

      toast({ title: "Email sent successfully" });
      setTo("");
      setSubject("");
      setBody("");
      onOpenChange(false);
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = async () => {
    try {
      await rateLimitSend(handleSendInternal)();
    } catch (err) {
      if (err instanceof z.ZodError) {
        // Show first validation error
        toast({ 
          title: "Validation error", 
          description: err.errors[0].message,
          variant: "destructive" 
        });
      } else {
        console.error('Send email error:', err);
        toast({ 
          title: 'Failed to send email', 
          description: err instanceof Error ? err.message : "Unknown error",
          variant: 'destructive' 
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-2xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4">
          <DialogTitle>New Message</DialogTitle>
          <p className="text-sm text-muted-foreground">From: {accountEmail}</p>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 pb-4">
            <div>
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                type="email"
                placeholder="recipient@example.com"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Email subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="body">Message</Label>
              <Textarea
                id="body"
                placeholder="Type your message here..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[200px] md:min-h-[300px] resize-none"
              />
            </div>
          </div>
        </ScrollArea>

        <div className="flex-shrink-0 flex gap-2 px-6 py-4 border-t">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending}
            className="flex-1 sm:flex-none"
          >
            {isSending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ComposeDialog;
