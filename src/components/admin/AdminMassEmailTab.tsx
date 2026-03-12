
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Users, Calendar, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AdminMassEmailTabProps {
    profiles: any[];
}

const EMAIL_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #0a0830;">
    <div style="max-width: 600px; margin: 28px auto; background: #121042; border: 1px solid rgba(167, 139, 250, 0.22); border-radius: 12px; overflow: hidden; box-shadow: 0 20px 45px rgba(2, 6, 23, 0.55);">
        <div style="background: linear-gradient(135deg, #111d7a 0%, #5b21d7 100%); padding: 40px 20px; text-align: center;">
            <img src="https://vlaqcfzmsjzgmzxodhkd.supabase.co/storage/v1/object/public/email-assets/orbiit-logo-email.png" alt="Orbiit" style="display:block; margin: 0 auto 14px auto; width: 132px; max-width: 45%; height: auto; border:0;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">{{subjectHeader}}</h1>
        </div>
        <div style="padding: 40px 30px;">
            <h2 style="color: #ffffff; font-size: 24px; margin-top: 0;">Hi {{firstName}},</h2>
            <div style="color: #e8e9ff; font-size: 16px; margin: 20px 0;">
                {{content}}
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 30px; border-top: 1px solid rgba(198, 172, 255, 0.25); padding-top: 20px;">
                <p style="color: #e8e9ff; font-size: 14px;">
                    Orbiit Team
                </p>
                <img src="https://vlaqcfzmsjzgmzxodhkd.supabase.co/storage/v1/object/public/email-assets/orbiit-logo-email.png" style="display: block; height: auto; border: 0; width: 50%; max-width: 150px;" width="150" alt="Orbiit Logo">
            </div>
        </div>
    </div>
    <div style="text-align: center; padding: 20px; color: #b9bdd8; font-size: 12px;">
        <p>© {{year}} Orbiit. All rights reserved.</p>
    </div>
</body>
</html>`;

import { useAdminProfiles } from "@/hooks/admin/useAdminProfiles";

export const AdminMassEmailTab = () => {
    const { profiles, loading } = useAdminProfiles();
    const { toast } = useToast();
    const [isAnnouncing, setIsAnnouncing] = useState(false);
    const [announcementProgress, setAnnouncementProgress] = useState(0);
    const [emailSubject, setEmailSubject] = useState("Update from Orbiit ⭐");
    const [emailContent, setEmailContent] = useState("");
    const [targetAudience, setTargetAudience] = useState<'all' | 'event_enrollees' | 'has_completed_date'>('all');
    const [filteredProfiles, setFilteredProfiles] = useState<any[]>([]); // Initialize as empty array
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

    useEffect(() => {
        const filterProfiles = async () => {
            setAnnouncementProgress(0); // Reset progress on audience change
            if (targetAudience === 'all') {
                setFilteredProfiles(profiles);
                return;
            }

            setIsLoadingProfiles(true);
            try {
                if (targetAudience === 'event_enrollees') {
                    const { data, error } = await supabase
                        .from('event_enrollments')
                        .select('user_id');

                    if (error) throw error;

                    const enrolledUserIds = new Set(data?.map(e => e.user_id) || []);
                    const filtered = profiles.filter(p => enrolledUserIds.has(p.id));
                    setFilteredProfiles(filtered);
                } else if (targetAudience === 'has_completed_date') {
                    const { data, error } = await supabase
                        .from('dates')
                        .select('user1_id, user2_id')
                        .eq('status', 'completed');

                    if (error) throw error;

                    const userIds = new Set<string>();
                    data?.forEach(d => {
                        userIds.add(d.user1_id);
                        userIds.add(d.user2_id);
                    });

                    const filtered = profiles.filter(p => userIds.has(p.id));
                    setFilteredProfiles(filtered);
                }
            } catch (error: any) {
                console.error("Error filtering profiles:", error);
                toast({
                    title: "Error",
                    description: "Failed to filter profiles: " + error.message,
                    variant: "destructive",
                });
                setTargetAudience('all'); // Revert on error
            } finally {
                setIsLoadingProfiles(false);
            }
        };

        filterProfiles();
    }, [targetAudience, profiles, toast]);

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading profiles...</div>;
    }

    const formattedEmailContent = emailContent.replace(/\n/g, '<br />');

    const previewHtml = EMAIL_TEMPLATE
        .replace('{{subjectHeader}}', emailSubject || "Update from Orbiit ⭐")
        .replace('{{firstName}}', 'John')
        .replace('{{content}}', formattedEmailContent || "Your content will appear here...")
        .replace('{{year}}', new Date().getFullYear().toString());

    const handleStartMassEmail = async () => {
        setIsAnnouncing(true);
        let currentProgress = announcementProgress;
        const profilesToSend = filteredProfiles;

        try {
            while (currentProgress < profilesToSend.length) {
                // Get next batch of 100
                const batch = profilesToSend.slice(currentProgress, currentProgress + 100);
                const recipients = batch.map(p => ({ userId: p.id }));

                const { data, error } = await supabase.functions.invoke('send-user-emails', {
                    body: {
                        emailType: 'blank_announcement',
                        emailSubject: emailSubject || "Update from Orbiit ⭐",
                        recipients: recipients.map(r => ({ ...r, customData: { content: formattedEmailContent } }))
                    }
                });

                if (error) throw error;
                if (data.error) throw new Error(data.error);

                const newProgress = currentProgress + batch.length;
                setAnnouncementProgress(newProgress);
                currentProgress = newProgress;

                // Stop if we're done
                if (currentProgress >= profilesToSend.length) {
                    toast({
                        title: "Success",
                        description: `All ${profilesToSend.length} emails sent successfully!`,
                    });
                    break;
                }

                // Wait 3 seconds before next batch
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description: "Failed during mass email: " + error.message,
                variant: "destructive",
            });
        } finally {
            setIsAnnouncing(false);
        }
    };

    const handleTestRun = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No authenticated user found");

            toast({
                title: "Sending Test Email",
                description: "Sending a test announcement email to your address...",
            });

            const { data, error } = await supabase.functions.invoke('send-user-emails', {
                body: {
                    emailType: 'blank_announcement',
                    emailSubject: emailSubject || "Update from Orbiit ⭐",
                    recipients: [{ userId: user.id, customData: { content: formattedEmailContent || "This is a test message. Your content will appear here." } }]
                }
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);

            toast({
                title: "Test Email Sent",
                description: "Check your inbox for the test announcement.",
            });
        } catch (error: any) {
            toast({
                title: "Error",
                description: "Failed to send test email: " + error.message,
                variant: "destructive",
            });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Mass Email
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <p className="text-sm text-muted-foreground">
                            Send announcement to users in batches of 100 (to get around Resend's rate limits).
                        </p>

                        <div className="space-y-2">
                            <Label>Target Audience</Label>
                            <Select
                                value={targetAudience}
                                onValueChange={(val: 'all' | 'event_enrollees' | 'has_completed_date') => setTargetAudience(val)}
                                disabled={isAnnouncing}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select audience" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        <div className="flex items-center gap-2">
                                            <Users className="h-4 w-4" />
                                            <span>All Users ({profiles.length})</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="event_enrollees">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4" />
                                            <span>Event Enrollees Only</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="has_completed_date">
                                        <div className="flex items-center gap-2">
                                            <Activity className="h-4 w-4" />
                                            <span>Users who Completed a Date</span>
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            {targetAudience !== 'all' && (
                                <p className="text-xs text-muted-foreground">
                                    {isLoadingProfiles ? "Calculating recipient count..." : `Will send to ${filteredProfiles.length} users.`}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Recipient List ({filteredProfiles.length})</Label>
                            </div>
                            <Input
                                placeholder="Search by name or email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="mb-2"
                            />
                            <div className="border rounded-md p-2 h-[200px] overflow-y-auto space-y-1 bg-muted/20">
                                {isLoadingProfiles ? (
                                    <div className="flex items-center justify-center h-full">
                                        <p className="text-xs text-muted-foreground">Loading...</p>
                                    </div>
                                ) : filteredProfiles.length === 0 ? (
                                    <p className="text-xs text-muted-foreground text-center py-8">No recipients found</p>
                                ) : (
                                    filteredProfiles
                                        .filter(profile => {
                                            if (!searchQuery) return true;
                                            const query = searchQuery.toLowerCase();
                                            return (
                                                profile.first_name?.toLowerCase().includes(query) ||
                                                profile.last_name?.toLowerCase().includes(query) ||
                                                profile.email?.toLowerCase().includes(query)
                                            );
                                        })
                                        .map(profile => (
                                            <div key={profile.id} className="text-xs flex justify-between p-2 hover:bg-muted/50 rounded border-b last:border-0 border-muted/50">
                                                <span className="font-medium">{profile.first_name} {profile.last_name}</span>
                                                <span className="text-muted-foreground">{profile.email}</span>
                                            </div>
                                        ))
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Subject Line</Label>
                                <Input
                                    placeholder="Enter email subject..."
                                    value={emailSubject}
                                    onChange={(e) => setEmailSubject(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Email Content</Label>
                                <textarea
                                    className="w-full min-h-[300px] p-3 rounded-md border text-sm font-mono"
                                    placeholder="Enter email content (HTML allowed)..."
                                    value={emailContent}
                                    onChange={(e) => setEmailContent(e.target.value)}
                                />
                            </div>

                            <div className="flex justify-between text-sm font-medium">
                                <span>Progress: {announcementProgress} / {filteredProfiles.length} users</span>
                                <span>{filteredProfiles.length > 0 ? Math.round((announcementProgress / filteredProfiles.length) * 100) : 0}%</span>
                            </div>

                            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                                <div
                                    className="bg-primary h-full transition-all duration-300"
                                    style={{ width: `${filteredProfiles.length > 0 ? (announcementProgress / filteredProfiles.length) * 100 : 0}%` }}
                                />
                            </div>
                            <div className="flex items-center gap-4 p-4 border rounded-lg bg-secondary/20">
                                <div className="flex-1">
                                    <h4 className="text-sm font-medium">Test Run</h4>
                                    <p className="text-xs text-muted-foreground">Send a copy of the email to yourself to verify formatting and content.</p>
                                </div>
                                <Button variant="secondary" size="sm" onClick={handleTestRun}>
                                    Send Test Email
                                </Button>
                            </div>

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        disabled={isAnnouncing || announcementProgress >= filteredProfiles.length || !emailContent || isLoadingProfiles || filteredProfiles.length === 0}
                                        className="w-full sm:w-auto"
                                    >
                                        {isAnnouncing ? "Sending..." :
                                            announcementProgress >= filteredProfiles.length && filteredProfiles.length > 0 ? "All Sent!" :
                                                `Start Mass Email to ${targetAudience === 'all' ? 'All' : 'Enrolled'} Users`}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will send the email to <strong>{filteredProfiles.length - announcementProgress}</strong> users (starting from {announcementProgress}).
                                            <br /><br />
                                            It will run effectively in batches of 100 with a 3-second delay to avoid rate limits.
                                            <br /><br />
                                            Please do not close this tab while the process is running.
                                            <br /><br />
                                            <strong className="text-primary">Send yourself a test email first to make sure it looks good!</strong>
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleStartMassEmail}>
                                            Yes, Send to All
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            {announcementProgress >= filteredProfiles.length && filteredProfiles.length > 0 && (
                                <Button
                                    variant="outline"
                                    onClick={() => setAnnouncementProgress(0)}
                                    className="w-full sm:w-auto mt-2"
                                >
                                    Reset Progress
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Live Preview</label>
                        <div className="border rounded-lg overflow-hidden shadow-xs bg-muted h-[600px] sticky top-4">
                            {emailContent ? (
                                <iframe
                                    className="w-full h-full bg-white"
                                    srcDoc={previewHtml}
                                    title="Email Preview"
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                    Start typing to see preview...
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
