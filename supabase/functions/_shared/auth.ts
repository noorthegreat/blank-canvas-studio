import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.75.0";

export type EdgeAuthContext = {
  supabase: SupabaseClient;
  user: User | null;
  isAdmin: boolean;
  isInternal: boolean;
};

type EdgeAuthOptions = {
  allowCronSecret?: boolean;
  allowServiceRole?: boolean;
  requireAdmin?: boolean;
};

type EdgeAuthError = {
  status: number;
  message: string;
};

type EdgeAuthResult = {
  context?: EdgeAuthContext;
  error?: EdgeAuthError;
};

export function createServiceRoleClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  return authHeader.replace(/^Bearer\s+/i, "").trim() || null;
}

async function isAdminUser(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (error) {
    console.error("Failed to check admin role:", error);
    return false;
  }

  return !!data;
}

export async function authenticateEdgeRequest(
  req: Request,
  options: EdgeAuthOptions = {},
): Promise<EdgeAuthResult> {
  const {
    allowCronSecret = false,
    allowServiceRole = true,
    requireAdmin = false,
  } = options;

  const supabase = createServiceRoleClient();
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("X-Cron-Secret");

  if (allowCronSecret && cronSecret && providedSecret === cronSecret) {
    return {
      context: {
        supabase,
        user: null,
        isAdmin: true,
        isInternal: true,
      },
    };
  }

  const authHeader = req.headers.get("Authorization");
  const token = extractBearerToken(authHeader);
  const apiKey = req.headers.get("apikey");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (allowServiceRole && (token === serviceRoleKey || apiKey === serviceRoleKey)) {
    return {
      context: {
        supabase,
        user: null,
        isAdmin: true,
        isInternal: true,
      },
    };
  }

  if (!token) {
    return { error: { status: 401, message: "Unauthorized" } };
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return { error: { status: 401, message: "Unauthorized" } };
  }

  const isAdmin = await isAdminUser(supabase, user.id);

  if (requireAdmin && !isAdmin) {
    return { error: { status: 403, message: "Forbidden" } };
  }

  return {
    context: {
      supabase,
      user,
      isAdmin,
      isInternal: false,
    },
  };
}
