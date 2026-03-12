import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useAdminDates = () => {
    const { toast } = useToast();
    const [dates, setDates] = useState<any[]>([]);
    const [dateMap, setDateMap] = useState<Map<string, any>>(new Map());
    const [userDateCounts, setUserDateCounts] = useState<Record<string, number>>({});
    const [completedDatesCount, setCompletedDatesCount] = useState(0);
    const [totalDatesCount, setTotalDatesCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const loadAllDates = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('dates')
                .select('*');

            if (error) throw error;

            const map = new Map();
            const counts: Record<string, number> = {};

            const userIds = Array.from(
                new Set(
                    (data || [])
                        .flatMap((date) => [date.user1_id, date.user2_id])
                        .filter(Boolean)
                )
            );

            let profilesById = new Map<string, any>();
            if (userIds.length > 0) {
                const [{ data: profilesData, error: profilesError }, { data: privateRows }] = await Promise.all([
                    supabase
                        .from("profiles")
                        .select("id, first_name, photo_url")
                        .in("id", userIds),
                    supabase
                        .from("private_profile_data" as any)
                        .select("user_id, last_name")
                        .in("user_id", userIds),
                ]);
                if (profilesError) throw profilesError;
                const privateByUser = new Map((privateRows || []).map((r: any) => [r.user_id, r]));
                profilesById = new Map(
                    (profilesData || []).map((profile) => [
                        profile.id,
                        { ...profile, last_name: privateByUser.get(profile.id)?.last_name ?? null },
                    ])
                );
            }

            const enrichedDates = (data || []).map((date) => ({
                ...date,
                user1_profile: profilesById.get(date.user1_id) || null,
                user2_profile: profilesById.get(date.user2_id) || null,
            }));

            enrichedDates.forEach(date => {
                const key = [date.user1_id, date.user2_id].sort().join('-');
                map.set(key, date);

                if (date.status === 'completed') {
                    counts[date.user1_id] = (counts[date.user1_id] || 0) + 1;
                    counts[date.user2_id] = (counts[date.user2_id] || 0) + 1;
                }
            });
            setDates(enrichedDates);
            setDateMap(map);
            setUserDateCounts(counts);
            setTotalDatesCount(enrichedDates.length);
            setCompletedDatesCount(enrichedDates.filter((date) => date.status === "completed").length);
        } catch (error: any) {
            console.error('Error loading dates:', error);
            toast({
                title: "Error",
                description: "Failed to load dates",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAllDates();
    }, []);

    return { dates, dateMap, userDateCounts, completedDatesCount, totalDatesCount, loading, refreshDates: loadAllDates };
};
