import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Play, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const MutualLikesDryRunPanel = () => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<any>(null);

    const runCheck = async (dryRun: boolean) => {
        setIsLoading(true);
        setResults(null);
        try {
            const { data, error } = await supabase.functions.invoke('check-mutual-likes', {
                body: { dry_run: dryRun }
            });

            if (error) throw error;

            // Handle string response if it comes back as string sometimes
            const parsedData = typeof data === 'string' ? JSON.parse(data) : data;

            setResults(parsedData);

            if (!parsedData.success) {
                toast({
                    title: "Error",
                    description: parsedData.error || "Unknown error occurred",
                    variant: "destructive"
                });
            } else {
                toast({
                    title: dryRun ? "Dry Run Complete" : "Execution Complete",
                    description: parsedData.message,
                });
            }
        } catch (error: any) {
            console.error("Error executing check:", error);
            toast({
                title: "Error",
                description: error.message || "Failed to execute function",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Date Janitor</CardTitle>
                    <p> Deletes expired pending dates and ensures dates that should exist, exist. Automatically runs once daily.</p>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                        This manually runs the `check-mutual-likes` function which:
                        <ul className="list-disc list-inside mt-2 ml-2">
                            <li>Checks for users who have mutually liked each other but have no date created.</li>
                            <li>Creates dates for new mutual matches (and emails them).</li>
                            <li>Checks for pending dates that have expired (past their 7-day window + 3 days buffer).</li>
                            <li>Cancels expired dates, deletes the likes (so they can rematch), and notifies users.</li>
                        </ul>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <Button
                            onClick={() => runCheck(true)}
                            disabled={isLoading}
                            variant="secondary"
                            className="w-40"
                        >
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                            Run Dry Run
                        </Button>

                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    disabled={isLoading}
                                    variant="destructive"
                                    className="w-40"
                                >
                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                                    Execute Real
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will ACTUALLY create dates, cancel expired dates, and SEND EMAILS to users.
                                        This action cannot be undone easily.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => runCheck(false)}>
                                        Yes, Execute
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </CardContent>
            </Card>

            {results && results.actions && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex gap-4">
                        <Badge variant="outline" className="text-lg py-1">
                            {results.actions.length} Action{results.actions.length !== 1 ? 's' : ''} Proposed
                        </Badge>
                        {results.dry_run && <Badge className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 py-1">Dry Run Mode</Badge>}
                    </div>

                    {results.actions.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground bg-muted/20 rounded-lg">
                            No actions needed.
                        </div>
                    )}

                    <div className="grid gap-4">
                        {results.actions.map((action: any, i: number) => {
                            // Extract emails safely from either location
                            const emailsToSend = action.details.emails_to_send || [];

                            return (
                                <Card key={i} className={`border-l-4 ${action.type === 'create_date' ? 'border-l-green-500' : 'border-l-red-500'}`}>
                                    <CardContent className="pt-6">
                                        <div className="flex justify-between items-start mb-2">
                                            <Badge variant={action.type === 'create_date' ? 'default' : 'destructive'}>
                                                {action.type === 'create_date' ? 'Create Date' : 'Cancel Date'}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground font-mono">
                                                {action.type === 'create_date' ? 'Would Email Both' : 'Would Email Both'}
                                            </span>
                                        </div>

                                        <h3 className="font-semibold text-lg mb-2">{action.description}</h3>

                                        <div className="bg-muted p-4 rounded-md text-sm space-y-2">
                                            {/* Show emails to send if available */}
                                            {emailsToSend.length > 0 && (
                                                <div className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                                                    <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Emails to Send:</span>
                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                        {emailsToSend.map((email: string, idx: number) => (
                                                            <Badge key={idx} variant="secondary" className="text-xs">
                                                                {email}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {action.type === 'create_date' && (
                                                <>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <span className="font-medium">User 1:</span> {action.details.user1.name} <br />
                                                            <span className="text-xs text-muted-foreground">{action.details.user1.email}</span>
                                                        </div>
                                                        <div>
                                                            <span className="font-medium">User 2:</span> {action.details.user2.name} <br />
                                                            <span className="text-xs text-muted-foreground">{action.details.user2.email}</span>
                                                        </div>
                                                    </div>
                                                    <div className="mt-2 text-xs text-muted-foreground">
                                                        Estimated First Day: {action.details.estimated_first_day}
                                                    </div>
                                                </>
                                            )}

                                            {action.type === 'cancel_date' && (
                                                <>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <span className="font-medium">User 1:</span> {action.details.user1.name}
                                                        </div>
                                                        <div>
                                                            <span className="font-medium">User 2:</span> {action.details.user2.name}
                                                        </div>
                                                    </div>
                                                    <div className="mt-2 font-medium text-red-600/80">
                                                        Reason: {action.details.reason}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        Date ID: {action.details.date_id}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
