import { supabase } from "@/integrations/supabase/client";

export const syncProfileEmailFromAuth = async (userId: string, email?: string | null) => {
  if (!userId || !email) return;

  const { error } = await supabase
    .from("private_profile_data" as any)
    .upsert({ user_id: userId, email })
    .eq("user_id", userId);

  if (error) {
    // Non-fatal; profile might not exist yet for first-time users.
    console.warn("Failed to sync profile email from auth:", error.message);
  }
};
