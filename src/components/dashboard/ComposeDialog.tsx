import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
      <DialogContent className="w-[95vw] md:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
          <p className="text-sm text-muted-foreground">From: {accountEmail}</p>
        </DialogHeader>
        <div className="space-y-4">
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
              className="min-h-48 md:min-h-64"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSending}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={isSending}>
              {isSending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ComposeDialog;
