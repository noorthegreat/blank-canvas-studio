import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Mail, UserPen } from "lucide-react";
import { getCityFromCoordinates } from "@/lib/geocoding";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SearchedProfileCardProps {
    profile: any;
    selectedForMatch: any[];
    onToggleSelectForMatch: (profile: any) => void;
    onViewProfile: (profile: any) => void;
    onEmailProfile: (profile: any) => void;
    dateCount?: number;
}

export const SearchedProfileCard = ({
    profile,
    selectedForMatch,
    onToggleSelectForMatch,
    onViewProfile,
    onEmailProfile,
    dateCount
}: SearchedProfileCardProps) => {
    const [city, setCity] = useState<string | null>(null);
    const { toast } = useToast();
    const [isUpdateEmailOpen, setIsUpdateEmailOpen] = useState(false);
    const [newEmail, setNewEmail] = useState("");
    const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);

    const handleUpdateEmail = async () => {
        if (!newEmail || !newEmail.includes('@')) {
            toast({
                title: "Invalid Email",
                description: "Please enter a valid email address.",
                variant: "destructive",
            });
            return;
        }

        setIsUpdatingEmail(true);
        try {
            const { data, error } = await supabase.functions.invoke('update-user-email', {
                body: { target_user_id: profile.id, new_email: newEmail }
            });

            if (error) {
                console.error("Function error:", error);
                throw error;
            }
            if (data.error) throw new Error(data.error);

            toast({
                title: "Success",
                description: `Successfully updated email for ${profile.first_name}.`,
            });

            // Optimistically update the local view
            profile.email = newEmail;
            setIsUpdateEmailOpen(false);
            setNewEmail("");
        } catch (error: any) {
            toast({
                title: "Error",
                description: "Failed to update email: " + (error.message || "Unknown error"),
                variant: "destructive",
            });
        } finally {
            setIsUpdatingEmail(false);
        }
    };

    useEffect(() => {
        if (profile.latitude && profile.longitude) {
            getCityFromCoordinates(profile.latitude, profile.longitude).then(setCity);
        }
    }, [profile.latitude, profile.longitude]);

    return (
        <Card
            className="overflow-hidden cursor-pointer hover:shadow-md transition-all"
            onClick={() => onViewProfile(profile)}
        >
            <div className="absolute top-2 right-2 z-10">
                <div
                    className={`h-6 w-6 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${selectedForMatch.find(p => p.id === profile.id)
                        ? "bg-primary border-primary text-white"
                        : "bg-white/80 border-gray-400 hover:border-primary"
                        }`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelectForMatch(profile);
                    }}
                >
                    {selectedForMatch.find(p => p.id === profile.id) && <Users className="h-3 w-3" />}
                </div>
            </div>
            <div className="h-48 w-full relative bg-muted">
                <img
                    src={profile.photo_url ||
                        (profile.additional_photos && profile.additional_photos.length > 0 ? profile.additional_photos[0] : null) ||
                        "/placeholder.svg"}
                    alt={profile.first_name}
                    className="w-full h-full object-cover"
                />
            </div>
            <CardHeader className="pb-2">
                <CardTitle className="text-xl">{profile.first_name} {profile.last_name}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
                <p className="text-muted-foreground break-all">{profile.email}</p>
                <p className="font-mono text-xs text-muted-foreground truncate" title={profile.id}>ID: {profile.id}</p>
                {profile.age && <p>Age: {profile.age}</p>}
                {city && <p>Location: {city}</p>}
                <div className="text-xs text-muted-foreground mt-2">
                    {profile.completed_questionnaire ? "✅ Love Survey Done" : "❌ No Love Survey"}
                    <br />
                    {profile.completed_friendship_questionnaire ? "✅ Friend Survey Done" : "❌ No Friend Survey"}
                    <br />
                    <span>📅 Dates Completed: {dateCount ?? 0}</span>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                        onClick={(e) => {
                            e.stopPropagation();
                            onEmailProfile(profile);
                        }}
                    >
                        <Mail className="mr-2 h-4 w-4" />
                        Email
                    </Button>
                    <Dialog open={isUpdateEmailOpen} onOpenChange={setIsUpdateEmailOpen}>
                        <DialogTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full mt-2"
                                onClick={(e) => {
                                    e.stopPropagation();
                                }}
                            >
                                <UserPen className="mr-2 h-4 w-4" />
                                Edit Email
                            </Button>
                        </DialogTrigger>
                        <DialogContent onClick={(e) => e.stopPropagation()}>
                            <DialogHeader>
                                <DialogTitle>Update User Email</DialogTitle>
                                <DialogDescription>
                                    Change the email address for {profile.first_name} {profile.last_name}. The user will need to log in with this new email.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="email">New Email Address</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder={profile.email}
                                        value={newEmail}
                                        onChange={(e) => setNewEmail(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateEmail()}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsUpdateEmailOpen(false)}>Cancel</Button>
                                <Button onClick={handleUpdateEmail} disabled={isUpdatingEmail || !newEmail}>
                                    {isUpdatingEmail ? "Updating..." : "Update Email"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardContent>
        </Card>
    );
};
