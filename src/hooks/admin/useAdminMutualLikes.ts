import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useAdminMutualLikes = () => {
    const { toast } = useToast();
    const [historicalMutualLikes, setHistoricalMutualLikes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadHistoricalMutualLikes = async () => {
        try {
            setLoading(true);
            const { data: likes, error: likesError } = await supabase
                .from("likes")
                .select("user_id, liked_user_id, created_at");

            if (likesError) throw likesError;

            const likedBy = new Map<string, Set<string>>();
            const likeDates = new Map<string, string>();

            likes?.forEach(like => {
                if (!likedBy.has(like.user_id)) {
                    likedBy.set(like.user_id, new Set());
                }
                likedBy.get(like.user_id)?.add(like.liked_user_id);
                likeDates.set(`${like.user_id}-${like.liked_user_id}`, like.created_at);
            });

            const mutualPairs = new Set<string>();
            const mutualList: { user_id: string; matched_user_id: string }[] = [];

            likes?.forEach(like => {
                const u1 = like.user_id;
                const u2 = like.liked_user_id;

                if (likedBy.get(u2)?.has(u1)) {
                    const key = [u1, u2].sort().join('-');
                    if (!mutualPairs.has(key)) {
                        mutualPairs.add(key);
                        mutualList.push({ user_id: u1, matched_user_id: u2 });
                    }
                }
            });

            const userIds = new Set<string>();
            mutualList.forEach(pair => {
                userIds.add(pair.user_id);
                userIds.add(pair.matched_user_id);
            });

            const ids = Array.from(userIds);
            if (ids.length === 0) {
                setHistoricalMutualLikes([]);
                return;
            }

            const [{ data: profilesData, error: profilesError }, { data: privateData, error: privateError }] = await Promise.all([
                supabase
                    .from("profiles")
                    .select("id, first_name, age, additional_photos, photo_url")
                    .in("id", ids),
                supabase
                    .from("private_profile_data" as any)
                    .select("user_id, last_name")
                    .in("user_id", ids),
            ]);

            if (profilesError) throw profilesError;
            if (privateError) throw privateError;

            const profilesMap = new Map();
            const privateByUser = new Map((privateData || []).map((row: any) => [row.user_id, row]));
            profilesData?.forEach(profile => {
                profilesMap.set(profile.id, {
                    ...profile,
                    last_name: privateByUser.get(profile.id)?.last_name ?? null,
                });
            });

            const enrichedMutuals = mutualList.map(pair => ({
                id: [pair.user_id, pair.matched_user_id].sort().join('-'),
                user_id: pair.user_id,
                matched_user_id: pair.matched_user_id,
                user_profile: profilesMap.get(pair.user_id),
                matched_user_profile: profilesMap.get(pair.matched_user_id),
                user1_like_date: likeDates.get(`${pair.user_id}-${pair.matched_user_id}`),
                user2_like_date: likeDates.get(`${pair.matched_user_id}-${pair.user_id}`),
            })).filter(item => item.user_profile && item.matched_user_profile);

            setHistoricalMutualLikes(enrichedMutuals);
        } catch (error: any) {
            console.error("Error loading historical likes:", error);
            toast({
                title: "Error",
                description: "Failed to load mutual likes history",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadHistoricalMutualLikes();
    }, []);

    return { historicalMutualLikes, loading, refreshMutualLikes: loadHistoricalMutualLikes };
};
