import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useState } from "react";
import ProfileViewDialog from "@/components/ProfileViewDialog";
import AdminEmailDialog from "@/components/AdminEmailDialog";
import DateView from "@/components/DateView";
import { useAdminProfiles } from "@/hooks/admin/useAdminProfiles";
import { useAdminDates } from "@/hooks/admin/useAdminDates";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Loader2 } from "lucide-react";
import { LongPressButton } from "@/components/ui/long-press-button";
import { Button } from "@/components/ui/button";

interface AdminGlobalDialogsProps {
    selectedUserProfile: any | null;
    setSelectedUserProfile: (profile: any | null) => void;
    selectedProfileForEmail: any | null;
    setSelectedProfileForEmail: (profile: any | null) => void;
    selectedDateForEmail: any | null;
    setSelectedDateForEmail: (date: any | null) => void;
    viewingDateId: string | null;
    setViewingDateId: (id: string | null) => void;
    viewingAsUserId: string | null;
    setViewingAsUserId: (id: string | null) => void;
}

export const AdminGlobalDialogs = ({
    selectedUserProfile,
    setSelectedUserProfile,
    selectedProfileForEmail,
    setSelectedProfileForEmail,
    selectedDateForEmail,
    setSelectedDateForEmail,
    viewingDateId,
    setViewingDateId,
    viewingAsUserId,
    setViewingAsUserId
}: AdminGlobalDialogsProps) => {
    const { toast } = useToast();
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [activeDatesCount, setActiveDatesCount] = useState(0);
    const [isLoadingDates, setIsLoadingDates] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // These hooks will fetch data when this component mounts (i.e. when a dialog opens)
    const { profiles } = useAdminProfiles();
    const { dateMap } = useAdminDates();

    const handleOpenDeleteDialog = async () => {
        if (!selectedUserProfile?.id) return;
        setDeleteDialogOpen(true);
        setActiveDatesCount(0);
        setIsLoadingDates(true);

        try {
            const { count, error } = await supabase
                .from("dates")
                .select("id", { count: "exact", head: true })
                .or(`user1_id.eq.${selectedUserProfile.id},user2_id.eq.${selectedUserProfile.id}`)
                .in("status", ["pending", "confirmed"]);

            if (error) throw error;
            setActiveDatesCount(count || 0);
        } catch (error) {
            console.error("Error loading active dates for user:", error);
        } finally {
            setIsLoadingDates(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!selectedUserProfile?.id) return;
        setIsDeleting(true);

        try {
            const { error } = await supabase.functions.invoke("delete-account", {
                body: { target_user_id: selectedUserProfile.id }
            });
            if (error) throw error;

            toast({
                title: "User Deleted",
                description: `${selectedUserProfile.first_name} ${selectedUserProfile.last_name} has been deleted.`,
            });
            setDeleteDialogOpen(false);
            setSelectedUserProfile(null);
        } catch (error: any) {
            toast({
                title: "Failed to delete user",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <ProfileViewDialog
                open={!!selectedUserProfile}
                onOpenChange={(open) => !open && setSelectedUserProfile(null)}
                profile={selectedUserProfile}
                showAdminDelete={!!selectedUserProfile}
                onAdminDelete={handleOpenDeleteDialog}
                adminDeleting={isDeleting}
                showAdminInfo
            />

            <AdminEmailDialog
                open={!!selectedProfileForEmail || !!selectedDateForEmail}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedProfileForEmail(null);
                        setSelectedDateForEmail(null);
                    }
                }}
                profile={selectedProfileForEmail}
                targetDate={selectedDateForEmail}
                dates={Array.from(dateMap.values()).filter(d =>
                    selectedProfileForEmail && (d.user1_id === selectedProfileForEmail.id || d.user2_id === selectedProfileForEmail.id)
                )}
                allProfiles={profiles}
            />

            <Dialog open={!!viewingDateId} onOpenChange={(open) => {
                if (!open) {
                    setViewingDateId(null);
                    setViewingAsUserId(null);
                }
            }}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    {viewingDateId && viewingAsUserId && (
                        <DateView dateId={viewingDateId} viewerId={viewingAsUserId} readOnly={true} />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-destructive flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" />
                            Delete User
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <strong>{selectedUserProfile?.first_name} {selectedUserProfile?.last_name}</strong>? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-2">
                        {isLoadingDates ? (
                            <div className="flex items-center justify-center py-3">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : activeDatesCount > 0 ? (
                            <p className="text-sm font-medium text-amber-700 bg-amber-50 p-3 rounded-md border border-amber-200">
                                Warning: this user has {activeDatesCount} active date(s). Partners will be notified of cancellation.
                            </p>
                        ) : (
                            <p className="text-sm text-green-700 bg-green-50 p-3 rounded-md border border-green-200">
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
        </>
    );
};
