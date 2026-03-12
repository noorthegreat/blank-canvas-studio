import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield, Users, MessageSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminGlobalDialogs } from "@/components/admin/AdminGlobalDialogs";

// Components
import { QuestionsManager } from "@/components/admin/QuestionsManager";
import { ReportsViewer } from "@/components/admin/ReportsViewer";
import { AdminDashboardTab } from "@/components/admin/AdminDashboardTab";
import { AdminMatchesTab } from "@/components/admin/AdminMatchesTab";
import { AdminVenuesTab } from "@/components/admin/AdminVenuesTab";
import { AdminMapTab } from "@/components/admin/AdminMapTab";
import { AdminProfilesTab } from "@/components/admin/AdminProfilesTab";
import { AdminDateManagerTab } from "@/components/admin/AdminDateManagerTab";
import { AdminRemindersTab } from "@/components/admin/AdminRemindersTab";
import { DateFeedbackManager } from "@/components/admin/DateFeedbackManager";
import { AdminMatchingRulesTab } from "@/components/admin/AdminMatchingRulesTab";
import { AdminMassEmailTab } from "@/components/admin/AdminMassEmailTab";
import { AdminEventAttendeesTab } from "@/components/admin/AdminEventAttendeesTab";
import { MutualLikesDryRunPanel } from "@/components/admin/matching/MutualLikesDryRunPanel";
import { AdminUserDebugTab } from "@/components/admin/AdminUserDebugTab";

const Admin = () => {
    const navigate = useNavigate();
    const { toast } = useToast();

    const [isLoading, setIsLoading] = useState(true);

    // UI/Dialog State
    const [selectedUserProfile, setSelectedUserProfile] = useState<any | null>(null);
    const [selectedProfileForEmail, setSelectedProfileForEmail] = useState<any | null>(null);
    const [selectedDateForEmail, setSelectedDateForEmail] = useState<any | null>(null);

    const [viewingDateId, setViewingDateId] = useState<string | null>(null);
    const [viewingAsUserId, setViewingAsUserId] = useState<string | null>(null);

    useEffect(() => {
        checkAdminAccess();
    }, [navigate]);

    const checkAdminAccess = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            navigate("/auth");
            return;
        }

        const { data: hasAdminRole } = await supabase.rpc('has_role', {
            _user_id: session.user.id,
            _role: 'admin'
        });

        if (!hasAdminRole) {
            toast({
                title: "Access Denied",
                description: "You don't have permission to access this page.",
                variant: "destructive",
            });
            navigate("/");
            return;
        }

        setIsLoading(false);
    };

    if (isLoading) {
        return (
            <>
                <div className="min-h-screen bg-linear-to-br from-background via-background to-primary/5 flex items-center justify-center">
                    <p className="text-muted-foreground">Loading admin data...</p>
                </div>
            </>
        );
    }

    const isAnyDialogOpen = !!selectedUserProfile || !!selectedProfileForEmail || !!selectedDateForEmail || !!viewingDateId;

    return (
        <>

            {isAnyDialogOpen && (
                <AdminGlobalDialogs
                    selectedUserProfile={selectedUserProfile}
                    setSelectedUserProfile={setSelectedUserProfile}
                    selectedProfileForEmail={selectedProfileForEmail}
                    setSelectedProfileForEmail={setSelectedProfileForEmail}
                    selectedDateForEmail={selectedDateForEmail}
                    setSelectedDateForEmail={setSelectedDateForEmail}
                    viewingDateId={viewingDateId}
                    setViewingDateId={setViewingDateId}
                    viewingAsUserId={viewingAsUserId}
                    setViewingAsUserId={setViewingAsUserId}
                />
            )}

            {/* Main Content */}
            <div className="min-h-screen">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="flex items-center gap-3 mb-8">
                        <Shield className="w-8 h-8 text-primary" />
                        <h1 className="text-4xl font-bold">Admin Dashboard</h1>
                    </div>

                    <Tabs defaultValue="dashboard" className="space-y-6">
                        <TabsList className="flex-wrap h-auto">
                            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                            <TabsTrigger value="matches">Current Matches</TabsTrigger>
                            <TabsTrigger value="questions">Questions</TabsTrigger>
                            <TabsTrigger value="venues">Venues</TabsTrigger>
                            <TabsTrigger value="map">Map</TabsTrigger>
                            <TabsTrigger value="profiles">Profiles</TabsTrigger>
                            <TabsTrigger value="date-manager">Date Manager</TabsTrigger>
                            <TabsTrigger value="reminders">Reminders</TabsTrigger>
                            <TabsTrigger value="reports">Reports</TabsTrigger>
                            <TabsTrigger value="feedback">Feedback</TabsTrigger>
                            <TabsTrigger value="matching">Matching Rules</TabsTrigger>
                            <TabsTrigger value="event-attendees">Event Attendees</TabsTrigger>
                            <TabsTrigger value="user-debug">User Debug</TabsTrigger>
                            <TabsTrigger value="system">Mass Email</TabsTrigger>
                            <TabsTrigger value="dry-run">Date Janitor</TabsTrigger>
                        </TabsList>

                        <TabsContent value="dashboard">
                            <AdminDashboardTab />
                        </TabsContent>

                        <TabsContent value="matches">
                            <AdminMatchesTab />
                        </TabsContent>

                        <TabsContent value="questions" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Users className="h-5 w-5" />
                                        Questionnaire Management
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <QuestionsManager />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="venues">
                            <AdminVenuesTab />
                        </TabsContent>

                        <TabsContent value="map">
                            <AdminMapTab />
                        </TabsContent>

                        <TabsContent value="profiles">
                            <AdminProfilesTab
                                onViewProfile={setSelectedUserProfile}
                                onEmailProfile={setSelectedProfileForEmail}
                            />
                        </TabsContent>

                        <TabsContent value="date-manager">
                            <AdminDateManagerTab
                                onViewDateAsUser={(dateId, userId) => {
                                    setViewingDateId(dateId);
                                    setViewingAsUserId(userId);
                                }}
                                onEmailDate={setSelectedDateForEmail}
                            />
                        </TabsContent>

                        <TabsContent value="reminders">
                            <AdminRemindersTab />
                        </TabsContent>

                        <TabsContent value="reports">
                            <ReportsViewer />
                        </TabsContent>

                        <TabsContent value="feedback">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <MessageSquare className="h-5 w-5" />
                                        Date Feedback Questions
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <DateFeedbackManager />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="matching">
                            <AdminMatchingRulesTab />
                        </TabsContent>

                        <TabsContent value="event-attendees">
                            <AdminEventAttendeesTab />
                        </TabsContent>

                        <TabsContent value="user-debug">
                            <AdminUserDebugTab />
                        </TabsContent>

                        <TabsContent value="system">
                            <AdminMassEmailTab />
                        </TabsContent>

                        <TabsContent value="dry-run">
                            <MutualLikesDryRunPanel />
                        </TabsContent>
                    </Tabs>
                </div>

            </div >
        </>
    );
};

export default Admin;
