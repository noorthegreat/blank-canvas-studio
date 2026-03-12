import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateTestUserTab } from "./CreateTestUserTab";
import { SearchProfilesTab } from "./SearchProfilesTab";
import { AllProfilesTab } from "./AllProfilesTab";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAdminMutualLikes } from "@/hooks/admin/useAdminMutualLikes";
import { useAdminDates } from "@/hooks/admin/useAdminDates";

interface AdminProfilesTabProps {
    onViewProfile: (profile: any) => void;
    onEmailProfile: (profile: any) => void;
}

export const AdminProfilesTab = ({
    onViewProfile,
    onEmailProfile,
}: AdminProfilesTabProps) => {
    const { toast } = useToast();
    const [selectedForMatch, setSelectedForMatch] = useState<any[]>([]);
    const [isCreatingMatch, setIsCreatingMatch] = useState(false);
    const { refreshMutualLikes } = useAdminMutualLikes();
    const { userDateCounts } = useAdminDates();

    const onToggleSelectForMatch = (profile: any) => {
        if (selectedForMatch.find(p => p.id === profile.id)) {
            setSelectedForMatch(prev => prev.filter(p => p.id !== profile.id));
        } else {
            if (selectedForMatch.length >= 2) {
                toast({
                    title: "Limit Reached",
                    description: "You can only select 2 users for a match.",
                    variant: "destructive",
                });
                return;
            }
            setSelectedForMatch(prev => [...prev, profile]);
        }
    };

    const onCreateMatch = async () => {
        if (selectedForMatch.length !== 2) return;

        setIsCreatingMatch(true);
        const [user1, user2] = selectedForMatch;

        try {
            const { data: roleRows, error: roleError } = await supabase
                .from("user_roles")
                .select("user_id, role")
                .in("user_id", [user1.id, user2.id])
                .in("role", ["admin", "test"]);
            if (roleError) throw roleError;

            const privilegedIds = new Set((roleRows || []).map((r: { user_id: string }) => r.user_id));
            const user1Privileged = privilegedIds.has(user1.id);
            const user2Privileged = privilegedIds.has(user2.id);
            if (user1Privileged !== user2Privileged) {
                toast({
                    title: "Blocked",
                    description: "Test/admin users cannot be matched with regular users.",
                    variant: "destructive",
                });
                return;
            }

            const { data: existingMatch, error: matchCheckError } = await supabase
                .from('matches')
                .select('id')
                .or(`and(user_id.eq.${user1.id},matched_user_id.eq.${user2.id}),and(user_id.eq.${user2.id},matched_user_id.eq.${user1.id})`)
                .maybeSingle();

            if (matchCheckError) throw matchCheckError;

            if (!existingMatch) {
                const { error: matchInsertError } = await supabase
                    .from('matches')
                    .insert({
                        user_id: user1.id,
                        matched_user_id: user2.id,
                        compatibility_score: 99
                    });
                if (matchInsertError) throw matchInsertError;
                const { error: match2InsertError } = await supabase
                    .from('matches')
                    .insert({
                        user_id: user2.id,
                        matched_user_id: user1.id,
                        compatibility_score: 99
                    });
                if (match2InsertError) throw match2InsertError;
            }

            toast({
                title: "Success",
                description: `Match created between ${user1.first_name} and ${user2.first_name}!`,
            });

            setSelectedForMatch([]);
            refreshMutualLikes();

        } catch (error: any) {
            toast({
                title: "Error",
                description: "Failed to create match: " + error.message,
                variant: "destructive",
            });
        } finally {
            setIsCreatingMatch(false);
        }
    };

    return (
        <div className="space-y-6">
            {selectedForMatch.length > 0 && (
                <Card className="bg-primary/5 border-primary/20 sticky top-4 z-20">
                    <CardContent className="py-4 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-4">
                            <span className="font-semibold text-primary">Selected for Match:</span>
                            <div className="flex gap-2">
                                {selectedForMatch.map(p => (
                                    <div key={p.id} className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border shadow-xs">
                                        <img src={p.photo_url || "/placeholder.svg"} className="w-6 h-6 rounded-full object-cover" />
                                        <span className="text-sm">{p.first_name}</span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-4 w-4 ml-1 hover:text-primary"
                                            onClick={() => onToggleSelectForMatch(p)}
                                        >
                                            <Users className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setSelectedForMatch([])}>
                                Clear
                            </Button>
                            <Button
                                size="sm"
                                disabled={selectedForMatch.length !== 2 || isCreatingMatch}
                                onClick={onCreateMatch}
                            >
                                {isCreatingMatch ? "Creating..." : "Create Match"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Tabs defaultValue="search" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="create">Create Test User</TabsTrigger>
                    <TabsTrigger value="search">Search Profiles</TabsTrigger>
                    <TabsTrigger value="list">All Profiles</TabsTrigger>
                </TabsList>

                <TabsContent value="create" className="mt-4">
                    <CreateTestUserTab />
                </TabsContent>

                <TabsContent value="search" className="mt-4">
                    <SearchProfilesTab
                        selectedForMatch={selectedForMatch}
                        onToggleSelectForMatch={onToggleSelectForMatch}
                        onViewProfile={onViewProfile}
                        onEmailProfile={onEmailProfile}
                        userDateCounts={userDateCounts}
                    />
                </TabsContent>

                <TabsContent value="list" className="mt-4">
                    <AllProfilesTab
                        selectedForMatch={selectedForMatch}
                        onToggleSelectForMatch={onToggleSelectForMatch}
                        onViewProfile={onViewProfile}
                        onEmailProfile={onEmailProfile}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
};
