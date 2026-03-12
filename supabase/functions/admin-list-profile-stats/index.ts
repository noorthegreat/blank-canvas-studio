import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authenticateEdgeRequest } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_SORT_COLUMNS = new Set([
  "first_name",
  "last_name",
  "total_matches",
  "likes_received",
  "likes_given",
  "total_dates",
  "completed_dates",
  "created_at",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await authenticateEdgeRequest(req, { requireAdmin: true });
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error.message }), {
        status: auth.error.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = auth.context!.supabase;
    const body = await req.json().catch(() => ({}));

    const page = Number.isInteger(body.page) && body.page >= 0 ? body.page : 0;
    const requestedPageSize = Number.isInteger(body.pageSize) ? body.pageSize : 50;
    const pageSize = Math.min(Math.max(requestedPageSize, 1), 100);
    const sortColumn = ALLOWED_SORT_COLUMNS.has(body.sortColumn) ? body.sortColumn : "first_name";
    const ascending = body.sortDirection === "asc";

    let query = supabase
      .from("admin_profile_stats")
      .select("*", { count: "exact" })
      .range(page * pageSize, ((page + 1) * pageSize) - 1)
      .order(sortColumn, { ascending });

    if (sortColumn === "first_name") {
      query = query.order("last_name", { ascending });
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({
      profiles: data ?? [],
      totalCount: count ?? 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
