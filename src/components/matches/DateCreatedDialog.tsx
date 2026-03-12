import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Heart } from "lucide-react";

interface DateCreatedDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    matchedUser: any;
    isCreatingDate: boolean;
}

const DateCreatedDialog = ({ open, onOpenChange, matchedUser, isCreatingDate }: DateCreatedDialogProps) => {
    const navigate = useNavigate();

    if (!matchedUser) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md text-center">
                <DialogHeader>
                    <DialogTitle className="text-3xl font-bold text-center bg-linear-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">
                        It's a Date!
                    </DialogTitle>
                </DialogHeader>
                <div className="flex flex-col items-center gap-6 py-6">
                    <div className="relative">
                        <div className="absolute -inset-4 bg-linear-to-r from-pink-500 to-violet-500 opacity-30 blur-xl rounded-full animate-pulse" />
                        <Heart className="w-24 h-24 text-pink-500 fill-pink-500 relative z-10 animate-bounce" />
                    </div>
                    <div className="space-y-2">
                        <p className="text-lg">
                            You and <span className="font-semibold">{matchedUser.first_name}</span> like each other!
                        </p>
                        <p className="text-muted-foreground">
                            We've automatically created a date for you both. Check your dates page for details!
                        </p>
                    </div>
                </div>
                <DialogFooter className="sm:justify-center gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Keep Browsing
                    </Button>
                    <Button
                        className="bg-linear-to-r from-pink-500 to-violet-500 text-white"
                        onClick={() => navigate("/dates")}
                        disabled={isCreatingDate}
                    >
                        {isCreatingDate ? "Creating Date..." : "View Date"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default DateCreatedDialog;
