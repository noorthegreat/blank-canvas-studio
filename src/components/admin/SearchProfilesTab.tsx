import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SearchedProfileCard } from "./SearchedProfileCard";

interface SearchProfilesTabProps {
    selectedForMatch: any[];
    onToggleSelectForMatch: (profile: any) => void;
    onViewProfile: (profile: any) => void;
    onEmailProfile: (profile: any) => void;
    userDateCounts?: Record<string, number>;
}

export const SearchProfilesTab = ({
    selectedForMatch,
    onToggleSelectForMatch,
    onViewProfile,
    onEmailProfile,
    userDateCounts
}: SearchProfilesTabProps) => {
    const { toast } = useToast();
    const [profileQuery, setProfileQuery] = useState("");
    const [searchedProfiles, setSearchedProfiles] = useState<any[]>([]);
    const [isSearchingProfile, setIsSearchingProfile] = useState(false);

    const handleProfileSearch = async () => {
        if (!profileQuery) return;
        setIsSearchingProfile(true);
        try {
            const { data, error } = await supabase.functions.invoke('admin-search-users', {
                body: { query: profileQuery }
            });

            if (error) throw error;
            setSearchedProfiles(data.users || []);
        } catch (err: any) {
            toast({
                title: "Error",
                description: "Search failed: " + err.message,
                variant: "destructive"
            });
        } finally {
            setIsSearchingProfile(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Search Profiles</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4">
                        <input
                            type="text"
                            placeholder="Search by ID, Name, or Email"
                            className="flex-1 px-3 py-2 border rounded-md"
                            value={profileQuery}
                            onChange={(e) => setProfileQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleProfileSearch()}
                        />
                        <Button
                            onClick={handleProfileSearch}
                            disabled={isSearchingProfile || !profileQuery}
                        >
                            {isSearchingProfile ? "Searching..." : "Search"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {searchedProfiles.length > 0 ? (
                    searchedProfiles.map((profile) => (
                        <SearchedProfileCard
                            key={profile.id}
                            profile={profile}
                            selectedForMatch={selectedForMatch}
                            onToggleSelectForMatch={onToggleSelectForMatch}
                            onViewProfile={onViewProfile}
                            onEmailProfile={onEmailProfile}
                            dateCount={userDateCounts?.[profile.id]}
                        />
                    ))
                ) : (
                    <div className="col-span-full text-center text-muted-foreground py-12">
                        {profileQuery ? (isSearchingProfile ? "Searching..." : "No profiles found.") : "Enter a search query to find users."}
                    </div>
                )}
            </div>
        </div>
    );
};
