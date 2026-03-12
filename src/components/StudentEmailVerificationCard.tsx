import { useState } from "react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { isStudentEmail } from "@/lib/dating-eligibility";

interface StudentEmailVerificationCardProps {
  currentEmail?: string | null;
  onOpenProfile?: () => void;
}

const getEmailRedirectTo = () => {
  return window.location.origin + "/matches";
};

const StudentEmailVerificationCard = ({ currentEmail, onOpenProfile }: StudentEmailVerificationCardProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(currentEmail ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!isStudentEmail(normalizedEmail)) {
      toast({
        title: "Student email required",
        description: "Use a valid uzh.ch or ethz.ch student email.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser(
        { email: normalizedEmail },
        { emailRedirectTo: getEmailRedirectTo() }
      );

      if (error) throw error;

      setLinkSent(true);
      toast({
        title: "Verification email sent",
        description: "Open the link in your student inbox to finish email verification.",
      });
    } catch (error: any) {
      toast({
        title: "Unable to start verification",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card className="text-center p-12 shadow-xl border-border/50">
        <CardTitle className="mb-2">Dating is currently unavailable</CardTitle>
        <CardDescription className="mb-6">
          You currently aren&apos;t able to date. Verify your student email first to unlock matches and dates.
        </CardDescription>
        <div className="flex flex-wrap gap-3 justify-center">
          <Button onClick={() => setOpen(true)}>
            Verify Student Email
          </Button>
          {onOpenProfile && (
            <Button variant="outline" onClick={onOpenProfile}>
              Open Profile
            </Button>
          )}
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Student Email</DialogTitle>
            <DialogDescription>
              Add your student email to this existing account. After confirmation, that email becomes your primary communication email.
            </DialogDescription>
          </DialogHeader>

          {!linkSent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="student-email">Student Email</Label>
                <Input
                  id="student-email"
                  type="email"
                  placeholder="you@uzh.ch or you@ethz.ch"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Sending..." : "Send Verification Link"}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Check your student inbox and click the confirmation link. After that, refresh this page and dating will unlock.
              </p>
              <DialogFooter>
                <Button onClick={() => setOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StudentEmailVerificationCard;
