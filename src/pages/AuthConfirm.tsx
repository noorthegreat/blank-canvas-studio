import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type EmailOtpType = "signup" | "invite" | "magiclink" | "recovery" | "email" | "email_change";

const supportedTypes = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email",
  "email_change",
]);

const getDefaultRedirect = (type: EmailOtpType) => {
  if (type === "recovery") {
    return "/change-password?type=recovery";
  }

  if (type === "email_change") {
    return "/profile";
  }

  return "/questionnaire-intro";
};

const AuthConfirm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const confirmLink = async () => {
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type");
      const next = searchParams.get("next");

      if (!tokenHash || !type || !supportedTypes.has(type as EmailOtpType)) {
        toast({
          title: "Error",
          description: "Invalid or expired link.",
          variant: "destructive",
        });
        navigate("/auth", { replace: true });
        return;
      }

      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as EmailOtpType,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        navigate("/auth", { replace: true });
        return;
      }

      const target = next?.startsWith("/") ? next : getDefaultRedirect(type as EmailOtpType);
      navigate(target, { replace: true });
    };

    void confirmLink();
  }, [navigate, searchParams, toast]);

  return (
    <div className="min-h-[60vh]">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Verifying link</CardTitle>
              <CardDescription>Please wait while we confirm your email link.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AuthConfirm;
