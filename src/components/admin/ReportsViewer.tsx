import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Loader2, ExternalLink } from "lucide-react";
import ProfileViewDialog from "@/components/ProfileViewDialog";
import { LongPressButton } from "@/components/ui/long-press-button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Trash2, MoreHorizontal, Archive, Undo2 } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Report = {
    id: string;
    created_at: string;
    reporter_id: string;
    reported_user_id: string;
    reason: string;
    custom_answer: string | null;
    archived?: boolean;
    reporter?: {
        id: string;
        first_name: string;
        last_name: string | null;
    };
    reported_user?: {
        id: string;
        first_name: string;
        last_name: string | null;
    };
};

export const ReportsViewer = () => {
    const { toast } = useToast();
    const [reports, setReports] = useState<Report[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
    const [profileDialogOpen, setProfileDialogOpen] = useState(false);
    const [selectedProfileData, setSelectedProfileData] = useState<any>(null);

    // Delete User State
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);
    const [userActiveDates, setUserActiveDates] = useState<any[]>([]);
    const [isLoadingDates, setIsLoadingDates] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Derived state
    const activeReports = reports.filter(r => !r.archived);
    const archivedReports = reports.filter(r => r.archived);

    const loadReports = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('user_reports')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Fetch profiles for all reporters and reported users
            // We need to do this manually because we might not have foreign key relationships 
            // set up in the types yet, or simply to ensure we get exactly what we need.
            const userIds = new Set<string>();
            data?.forEach((r: any) => {
                if (r.reporter_id) userIds.add(r.reporter_id);
                if (r.reported_user_id) userIds.add(r.reported_user_id);
            });

            if (userIds.size > 0) {
                const ids = Array.from(userIds);
                const [{ data: profiles, error: profilesError }, { data: privateRows, error: privateError }] = await Promise.all([
                    supabase
                        .from('profiles')
                        .select('id, first_name')
                        .in('id', ids),
                    supabase
                        .from('private_profile_data' as any)
                        .select('user_id, last_name')
                        .in('user_id', ids),
                ]);

                if (profilesError) throw profilesError;
                if (privateError) throw privateError;

                const profileMap = new Map();
                const privateByUser = new Map((privateRows || []).map((r: any) => [r.user_id, r]));
                profiles?.forEach((p: any) =>
                    profileMap.set(p.id, {
                        ...p,
                        last_name: privateByUser.get(p.id)?.last_name ?? null,
                    })
                );

                const enrichedReports = data.map((r: any) => ({
                    ...r,
                    reporter: profileMap.get(r.reporter_id),
                    reported_user: profileMap.get(r.reported_user_id)
                }));
                setReports(enrichedReports);
            } else {
                setReports(data as any);
            }

        } catch (error) {
            console.error("Error loading reports:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadReports();
    }, []);

    const handleViewProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) throw error;

            setSelectedProfileData(data);
            setSelectedProfileId(userId);
            setProfileDialogOpen(true);
        } catch (error) {
            console.error("Error fetching profile:", error);
        }
    };

    const handleOpenDeleteDialog = async (userId: string, userName: string) => {
        setUserToDelete({ id: userId, name: userName });
        setDeleteDialogOpen(true);
        setIsLoadingDates(true);
        setUserActiveDates([]);

        try {
            const { data, error } = await supabase
                .from('dates')
                .select('*')
                .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
                .in('status', ['pending', 'confirmed']);

            if (error) throw error;
            setUserActiveDates(data || []);
        } catch (error) {
            console.error("Error fetching user dates:", error);
            // We don't block deletion on this, but it's good to know
        } finally {
            setIsLoadingDates(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!userToDelete) return;
        setIsDeleting(true);

        try {
            const { data, error } = await supabase.functions.invoke('delete-account', {
                body: { target_user_id: userToDelete.id }
            });

            if (error) throw error;

            toast({
                title: "User Deleted",
                description: `User ${userToDelete.name} has been deleted.`,
            });
            setDeleteDialogOpen(false);
            loadReports(); // Refresh the list
        } catch (error: any) {
            console.error("Error deleting user:", error);
            toast({
                title: "Error",
                description: "Failed to delete user: " + error.message,
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleArchiveReport = async (reportId: string, archive: boolean) => {
        try {
            const { error } = await supabase
                .from('user_reports')
                .update({ archived: archive } as any) // Type assertion until types are updated
                .eq('id', reportId);

            if (error) throw error;

            toast({
                title: archive ? "Report Archived" : "Report Unarchived",
                description: archive ? "The report has been moved to the archived section." : "The report has been moved to the active section.",
            });

            // Optimistic update
            setReports(prev => prev.map(r =>
                r.id === reportId ? { ...r, archived: archive } : r
            ));
        } catch (error: any) {
            console.error("Error updating report:", error);
            toast({
                title: "Error",
                description: "Failed to update report: " + error.message,
                variant: "destructive",
            });
        }
    };



    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>User Reports</CardTitle>
                <CardDescription>Review reports submitted by users.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Active Reports Section */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium">Active Reports</h3>
                            {activeReports.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground border rounded-md bg-muted/20">
                                    No active reports.
                                </div>
                            ) : (
                                <ReportsTable
                                    reports={activeReports}
                                    handleViewProfile={handleViewProfile}
                                    handleOpenDeleteDialog={handleOpenDeleteDialog}
                                    handleArchiveReport={handleArchiveReport}
                                />
                            )}
                        </div>

                        {/* Archived Reports Section */}
                        {archivedReports.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium text-muted-foreground">Archived Reports</h3>
                                <div className="opacity-80">
                                    <ReportsTable
                                        reports={archivedReports}
                                        handleViewProfile={handleViewProfile}
                                        handleOpenDeleteDialog={handleOpenDeleteDialog}
                                        handleArchiveReport={handleArchiveReport}
                                        isArchived
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>

            <ProfileViewDialog
                profile={selectedProfileData}
                open={profileDialogOpen}
                onOpenChange={setProfileDialogOpen}
                showAdminInfo
            />

            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-destructive flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" />
                            Delete User
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <strong>{userToDelete?.name}</strong>? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        {isLoadingDates ? (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : userActiveDates.length > 0 ? (
                            <div className="space-y-3">
                                <p className="text-sm font-medium text-amber-600 bg-amber-50 p-3 rounded-md border border-amber-200">
                                    Warning: This user has {userActiveDates.length} active date(s).
                                    Partners will be notified of cancellation.
                                </p>
                                <div className="max-h-40 overflow-y-auto space-y-2 border rounded-md p-2">
                                    {userActiveDates.map(date => (
                                        <div key={date.id} className="text-xs border-b last:border-0 pb-2 mb-2 last:pb-0 last:mb-0">
                                            <p><span className="font-semibold">Status:</span> {date.status}</p>
                                            <p><span className="font-semibold">Created:</span> {format(new Date(date.created_at), 'MMM d, yyyy')}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-green-600 bg-green-50 p-3 rounded-md border border-green-200">
                                No active dates found for this user.
                            </p>
                        )}
                    </div>

                    <div className="flex flex-col gap-3">
                        <LongPressButton
                            className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                            progressColor="bg-black/20"
                            onLongPress={handleDeleteUser}
                            disabled={isDeleting || isLoadingDates}
                        >
                            {isDeleting ? "Deleting..." : "Hold to Delete User"}
                        </LongPressButton>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteDialogOpen(false)}
                            disabled={isDeleting}
                        >
                            Cancel
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

        </Card>
    );
}

const ReportsTable = ({
    reports,
    handleViewProfile,
    handleOpenDeleteDialog,
    handleArchiveReport,
    isArchived = false
}: {
    reports: Report[],
    handleViewProfile: (id: string) => void,
    handleOpenDeleteDialog: (id: string, name: string) => void,
    handleArchiveReport: (id: string, archive: boolean) => void,
    isArchived?: boolean
}) => {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Reporter</TableHead>
                        <TableHead>Reported User</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {reports.map((report) => (
                        <TableRow key={report.id}>
                            <TableCell className="whitespace-nowrap">
                                {format(new Date(report.created_at), 'MMM d, yyyy h:mm a')}
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <span>
                                        {report.reporter ? `${report.reporter.first_name} ${report.reporter.last_name}` : (report.reporter_id || "Unknown (Probably Deleted)")}
                                    </span>
                                    {report.reporter_id && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => handleViewProfile(report.reporter_id)}
                                            title="View Profile"
                                        >
                                            <ExternalLink className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-destructive">
                                        {report.reported_user ? `${report.reported_user.first_name} ${report.reported_user.last_name}` : (report.reported_user_id || "Unknown (Probably Deleted)")}
                                    </span>
                                    {report.reported_user_id && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => handleViewProfile(report.reported_user_id)}
                                            title="View Profile"
                                        >
                                            <ExternalLink className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline">{report.reason}</Badge>
                            </TableCell>
                            <TableCell className="max-w-md truncate" title={report.custom_answer || ""}>
                                {report.custom_answer || "-"}
                            </TableCell>
                            <TableCell>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreHorizontal className="h-4 w-4" />
                                            <span className="sr-only">Open menu</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <DropdownMenuItem
                                            onClick={() => handleArchiveReport(report.id, !isArchived)}
                                            className="gap-2 cursor-pointer"
                                        >
                                            {isArchived ? (
                                                <>
                                                    <Undo2 className="h-4 w-4" />
                                                    Unarchive Report
                                                </>
                                            ) : (
                                                <>
                                                    <Archive className="h-4 w-4" />
                                                    Archive Report
                                                </>
                                            )}
                                        </DropdownMenuItem>
                                        {report.reported_user_id && (
                                            <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => handleOpenDeleteDialog(
                                                        report.reported_user_id,
                                                        report.reported_user ? `${report.reported_user.first_name} ${report.reported_user.last_name}` : "Unknown User"
                                                    )}
                                                    className="text-destructive focus:text-destructive gap-2 cursor-pointer"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    Delete User
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};
