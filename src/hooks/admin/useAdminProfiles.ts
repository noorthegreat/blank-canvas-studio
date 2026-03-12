import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useAdminProfiles = () => {
    const { toast } = useToast();
    const [profiles, setProfiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadAllProfiles = async () => {
        try {
            setLoading(true);
            const [{ data, error }, { data: privateRows }] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('id, first_name, photo_url, additional_photos, age, completed_questionnaire'),
                supabase
                    .from('private_profile_data' as any)
                    .select('user_id, last_name, latitude, longitude, phone_number, email'),
            ]);

            if (error) throw error;

            const privateByUser = new Map(
                (privateRows || []).map((r: any) => [r.user_id, r])
            );
            const merged = (data || []).map((p: any) => ({
                ...p,
                ...(privateByUser.get(p.id) || {}),
            }));
            setProfiles(merged);
        } catch (error: any) {
            console.error('Error loading profiles:', error);
            toast({
                title: "Error",
                description: "Failed to load profiles",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAllProfiles();
    }, []);

    return { profiles, loading, refreshProfiles: loadAllProfiles };
};
