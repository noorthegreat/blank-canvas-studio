import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const passwordSchema = z.object({
  // oldPassword: z.string().min(6, "Password must be at least 6 characters"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const ChangePassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecoveryFlow, setIsRecoveryFlow] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    let resolved = false;

    const finish = (recoveryFlow: boolean) => {
      if (resolved) return;
      resolved = true;
      setIsRecoveryFlow(recoveryFlow);
      setAuthChecking(false);
    };

    const fail = (title: string, description: string) => {
      if (resolved) return;
      resolved = true;
      toast({
        title,
        description,
        variant: "destructive",
      });
      setAuthChecking(false);
      navigate("/auth");
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (resolved) return;

      if (event === "PASSWORD_RECOVERY") {
        finish(true);
        return;
      }

      if (event === "SIGNED_IN" && session) {
        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const typeHint = searchParams.get("type") ?? hashParams.get("type");
        finish(typeHint === "recovery");
      }
    });

    const verifyToken = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const tokenHash = searchParams.get("token_hash");
      const linkType = searchParams.get("type");
      const code = searchParams.get("code");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const hashType = hashParams.get("type");
      const recoveryHint = linkType === "recovery" || hashType === "recovery" || !!tokenHash || !!accessToken || !!code;

      if (accessToken && refreshToken) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!setSessionError) {
          finish(recoveryHint);
          return;
        }
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (!exchangeError) {
          finish(recoveryHint);
          return;
        }
      }

      if (tokenHash) {
        const candidateTypes = [linkType, "recovery", "magiclink", "email"]
          .filter(Boolean)
          .filter((value, index, arr) => arr.indexOf(value) === index) as Array<"recovery" | "magiclink" | "email">;

        for (const candidateType of candidateTypes) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: candidateType,
          });
          if (!error) {
            finish(recoveryHint);
            return;
          }
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        finish(recoveryHint);
        return;
      }

      if (recoveryHint) {
        // Give the client a moment to process the redirect and emit auth events.
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 800));
        const { data: { session: delayedSession } } = await supabase.auth.getSession();
        if (delayedSession) {
          finish(true);
          return;
        }

        fail("Error", "Invalid or expired password reset link.");
      } else {
        fail("Please log in", "You need to be logged in to change your password.");
      }
    };

    verifyToken();

    return () => subscription.unsubscribe();
  }, [navigate, toast])

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate inputs
      const validation = passwordSchema.safeParse({
        oldPassword,
        newPassword,
        confirmPassword,
      });

      if (!validation.success) {
        toast({
          title: "Validation Error",
          description: validation.error.errors[0].message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast({
          title: "Error",
          description: "No user found. Please log in again.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      if (!isRecoveryFlow) {
        // Verify old password by attempting to sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: oldPassword,
        });

        if (signInError) {
          toast({
            title: "Error",
            description: "Current password is incorrect",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        toast({
          title: "Error",
          description: updateError.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      toast({
        title: "Success",
        description: isRecoveryFlow ? "Password reset successfully" : "Password changed successfully",
      });

      // Reset form and navigate back to profile
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      navigate("/profile");
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-[60vh]">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Checking your session...</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh]">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                {isRecoveryFlow
                  ? "Choose a new password for your account"
                  : "Enter your current password and choose a new one"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                {isRecoveryFlow ? null : (
                  <div className="space-y-2">
                    <Label htmlFor="oldPassword">Current Password</Label>
                    <Input
                      id="oldPassword"
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? "Changing..." : "Change Password"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/profile")}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div >
  );
};

export default ChangePassword;
