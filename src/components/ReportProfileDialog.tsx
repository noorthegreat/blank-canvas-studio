
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";

type ReportReason = 'spam_bot' | 'harassment' | 'inappropriate_content' | 'other';

interface ReportProfileDialogProps {
    reportedUserId: string;
    reportedUserName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const ReportProfileDialog = ({ reportedUserId, reportedUserName, open, onOpenChange }: ReportProfileDialogProps) => {
    const { toast } = useToast();
    const [reason, setReason] = useState<ReportReason | "">("");
    const [customAnswer, setCustomAnswer] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!reason) {
            toast({
                title: "Error",
                description: "Please select a reason for the report.",
                variant: "destructive",
            });
            return;
        }

        if (reason === 'other' && !customAnswer.trim()) {
            toast({
                title: "Error",
                description: "Please provide more details for 'Other' reason.",
                variant: "destructive",
            });
            return;
        }

        setIsSubmitting(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                toast({
                    title: "Error",
                    description: "You must be logged in to submit a report.",
                    variant: "destructive",
                });
                return;
            }

            const { error } = await supabase
                .from('user_reports')
                .insert({
                    reporter_id: user.id,
                    reported_user_id: reportedUserId,
                    reason: reason,
                    custom_answer: customAnswer || null
                });

            if (error) throw error;

            toast({
                title: "Report Submitted",
                description: "Thank you for letting us know. We will review this report shortly.",
            });
            onOpenChange(false);
            setReason("");
            setCustomAnswer("");
        } catch (error: any) {
            console.error("Error submitting report:", error);
            toast({
                title: "Error",
                description: "Failed to submit report: " + error.message,
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Report {reportedUserName}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="reason">Reason for filtering</Label>
                        <Select value={reason} onValueChange={(value: ReportReason) => setReason(value)}>
                            <SelectTrigger id="reason">
                                <SelectValue placeholder="Select a reason" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="spam_bot">Spam / Bot Account</SelectItem>
                                <SelectItem value="harassment">Harassment</SelectItem>
                                <SelectItem value="inappropriate_content">Inappropriate Content</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="details">Additional Details {reason === 'other' && <span className="text-primary">*</span>}</Label>
                        <Textarea
                            id="details"
                            placeholder={reason === 'other' ? "Please explain..." : "Optional details..."}
                            value={customAnswer}
                            onChange={(e) => setCustomAnswer(e.target.value)}
                            className="resize-none h-32"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleSubmit}
                        disabled={isSubmitting || !reason || (reason === 'other' && !customAnswer.trim())}
                    >
                        {isSubmitting ? "Submitting..." : "Submit Report"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ReportProfileDialog;
