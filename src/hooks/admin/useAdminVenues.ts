import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Venue } from "@/components/AvailabilityPlanner";
import { useToast } from "@/hooks/use-toast";

export const useAdminVenues = () => {
    const { toast } = useToast();
    const [venues, setVenues] = useState<Venue[]>([]);
    const [loading, setLoading] = useState(true);

    const loadVenues = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.from('venues').select('*');
            if (error) throw error;
            setVenues((data as unknown as Venue[]) || []);
        } catch (error: any) {
            console.error('Error loading venues:', error);
            toast({
                title: "Error",
                description: "Failed to load venues",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadVenues();
    }, []);

    return { venues, loading, refreshVenues: loadVenues };
};
