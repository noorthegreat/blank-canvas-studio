import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const AdminRemindersTab = () => {
    const { toast } = useToast();
    const [reminderDryRunResults, setReminderDryRunResults] = useState<any | null>(null);
    const [isCheckingReminders, setIsCheckingReminders] = useState(false);
    const [isSendingReminders, setIsSendingReminders] = useState(false);

    const handleDryRunReminders = async () => {
        setIsCheckingReminders(true);
        try {
            const { data, error } = await supabase.functions.invoke('send-date-reminders', {
                body: { dryRun: true }
            });

            if (error) throw error;
            setReminderDryRunResults(data.results);

            toast({
                title: "Dry Run Complete",
                description: "Check the results section below.",
            });
        } catch (error: any) {
            console.error("Dry run error:", error);
            toast({
                title: "Error",
                description: "Dry run failed: " + error.message,
                variant: "destructive",
            });
        } finally {
            setIsCheckingReminders(false);
        }
    };

    const handleRealRunReminders = async () => {
        if (!window.confirm("ARE YOU SURE? This will SEND EMAILS to users and UPDATE database records.")) return;

        setIsSendingReminders(true);
        try {
            const { data, error } = await supabase.functions.invoke('send-date-reminders', {
                body: { dryRun: false }
            });

            if (error) throw error;
            setReminderDryRunResults(data.results);

            toast({
                title: "Reminders Sent",
                description: "Emails have been sent and database updated.",
            });
        } catch (error: any) {
            console.error("Real run error:", error);
            toast({
                title: "Error",
                description: "Failed to send reminders: " + error.message,
                variant: "destructive",
            });
        } finally {
            setIsSendingReminders(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Date Reminder System (Dry Run)
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="mb-4 text-muted-foreground">
                    Check which reminder emails would be sent right now.
                </p>

                <div className="flex gap-4 mb-6">
                    <Button
                        onClick={handleDryRunReminders}
                        disabled={isCheckingReminders || isSendingReminders}
                    >
                        {isCheckingReminders ? "Checking..." : "Run Dry Run Check"}
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleRealRunReminders}
                        disabled={isCheckingReminders || isSendingReminders}
                    >
                        {isSendingReminders ? "Sending..." : "Run REAL Reminders (Send Emails)"}
                    </Button>
                </div>

                {reminderDryRunResults && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold">
                                Results ({reminderDryRunResults.dryRun ? "Dry Run" : "Active Run"})
                            </h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-muted p-4 rounded-lg">
                                <div className="text-2xl font-bold">{reminderDryRunResults.sent24h}</div>
                                <div className="text-sm text-muted-foreground">24h Reminders</div>
                            </div>
                            <div className="bg-muted p-4 rounded-lg">
                                <div className="text-2xl font-bold">{reminderDryRunResults.sent1h}</div>
                                <div className="text-sm text-muted-foreground">1h Reminders</div>
                            </div>
                            <div className="bg-muted p-4 rounded-lg">
                                <div className="text-2xl font-bold">{reminderDryRunResults.sentPlan48h}</div>
                                <div className="text-sm text-muted-foreground">Planning (48h)</div>
                            </div>
                            <div className="bg-muted p-4 rounded-lg">
                                <div className="text-2xl font-bold">{reminderDryRunResults.sentPlanSoon}</div>
                                <div className="text-sm text-muted-foreground">Planning (Soon)</div>
                            </div>
                        </div>

                        {/* Detailed Lists */}
                        <div className="space-y-4">
                            {reminderDryRunResults.recipients24h?.length > 0 && (
                                <div className="border rounded-md p-4">
                                    <h3 className="font-semibold mb-2">24h Reminders Pending</h3>
                                    <ul className="space-y-2">
                                        {reminderDryRunResults.recipients24h.map((r: any, i: number) => (
                                            <li key={i} className="text-sm flex justify-between bg-secondary/20 p-2 rounded">
                                                <span>To: {r.userId}</span>
                                                <span className="text-muted-foreground">{r.customData?.dateDetails?.date} @ {r.customData?.dateDetails?.time}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {reminderDryRunResults.recipients1h?.length > 0 && (
                                <div className="border rounded-md p-4">
                                    <h3 className="font-semibold mb-2">1h Reminders Pending</h3>
                                    <ul className="space-y-2">
                                        {reminderDryRunResults.recipients1h.map((r: any, i: number) => (
                                            <li key={i} className="text-sm flex justify-between bg-secondary/20 p-2 rounded">
                                                <span>To: {r.userId}</span>
                                                <span className="text-muted-foreground">{r.customData?.dateDetails?.date} @ {r.customData?.dateDetails?.time}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {reminderDryRunResults.recipientsPlan48h?.length > 0 && (
                                <div className="border rounded-md p-4">
                                    <h3 className="font-semibold mb-2">Planning (48h) Reminders Pending</h3>
                                    <ul className="space-y-2">
                                        {reminderDryRunResults.recipientsPlan48h.map((r: any, i: number) => (
                                            <li key={i} className="text-sm flex justify-between bg-secondary/20 p-2 rounded">
                                                <span>To: {r.userId}</span>
                                                <span className="text-muted-foreground">Partner: {r.customData?.partnerName}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {reminderDryRunResults.recipientsPlanSoon?.length > 0 && (
                                <div className="border rounded-md p-4">
                                    <h3 className="font-semibold mb-2">Planning (Soon) Reminders Pending</h3>
                                    <ul className="space-y-2">
                                        {reminderDryRunResults.recipientsPlanSoon.map((r: any, i: number) => (
                                            <li key={i} className="text-sm flex justify-between bg-secondary/20 p-2 rounded">
                                                <span>To: {r.userId}</span>
                                                <span className="text-muted-foreground">Window Start: {r.customData?.firstPossibleDay}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {(!reminderDryRunResults.recipients24h?.length &&
                                !reminderDryRunResults.recipients1h?.length &&
                                !reminderDryRunResults.recipientsPlan48h?.length &&
                                !reminderDryRunResults.recipientsPlanSoon?.length) && (
                                    <div className="text-center text-muted-foreground py-8 bg-muted/20 rounded-md border border-dashed">
                                        No reminders pending at this time.
                                    </div>
                                )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
