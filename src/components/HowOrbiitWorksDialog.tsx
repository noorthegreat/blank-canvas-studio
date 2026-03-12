import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Heart, Calendar, MapPin, RotateCcw, MessageSquare, ShieldAlert } from "lucide-react";

interface HowOrbiitWorksDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const HowOrbiitWorksDialog = ({ open, onOpenChange }: HowOrbiitWorksDialogProps) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-center mb-4">How Orbiit Works</DialogTitle>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {/* Step 1 */}
                    <div className="flex gap-4 items-start">
                        <div className="shrink-0 p-2 bg-primary/10 rounded-full">
                            <Heart className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">1. Check out your matches</h3>
                            <p className="text-muted-foreground">
                                You will be notified by email when you and another user like each other.
                            </p>
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex gap-4 items-start">
                        <div className="shrink-0 p-2 bg-secondary/10 rounded-full">
                            <Calendar className="w-6 h-6 text-secondary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">2. Schedule your date</h3>
                            <p className="text-muted-foreground">
                                Provide as many available days and times as possible. You may also choose to share your phone number. If you do, it will be revealed one hour before the date.
                            </p>
                        </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex gap-4 items-start">
                        <div className="shrink-0 p-2 bg-accent/10 rounded-full">
                            <MapPin className="w-6 h-6 text-accent" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">3. Receive your date details</h3>
                            <p className="text-muted-foreground">
                                We will send you the final venue and time for your date.
                            </p>
                        </div>
                    </div>

                    {/* Step 4 */}
                    <div className="flex gap-4 items-start">
                        <div className="shrink-0 p-2 bg-primary/10 rounded-full">
                            <RotateCcw className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">4. Need to reschedule?</h3>
                            <p className="text-muted-foreground">
                                If you cannot attend, you may reschedule your date. Each user has up to two rescheduling opportunities.
                            </p>
                        </div>
                    </div>

                    {/* Step 5 */}
                    <div className="flex gap-4 items-start">
                        <div className="shrink-0 p-2 bg-secondary/10 rounded-full">
                            <MessageSquare className="w-6 h-6 text-secondary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">5. Share your feedback</h3>
                            <p className="text-muted-foreground">
                                After your date, we ask that you send us a short review and let us know how it went.
                            </p>
                        </div>
                    </div>

                    {/* Step 6 */}
                    <div className="flex gap-4 items-start">
                        <div className="shrink-0 p-2 bg-destructive/10 rounded-full">
                            <ShieldAlert className="w-6 h-6 text-destructive" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">6. No ghosting policy</h3>
                            <p className="text-muted-foreground">
                                If you ghost a date without rescheduling, you will be removed from the platform.
                            </p>
                        </div>
                    </div>
                </div>

                <DialogFooter className="sm:justify-center">
                    <Button
                        size="lg"
                        onClick={() => onOpenChange(false)}
                        className="w-full sm:w-auto px-8"
                    >
                        Got it
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default HowOrbiitWorksDialog;
