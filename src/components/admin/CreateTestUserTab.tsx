import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const CreateTestUserTab = () => {
    const { toast } = useToast();
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleCreate = async () => {
        if (!email) return;
        setIsLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { data, error } = await supabase.functions.invoke('create-test-user', {
                body: {
                    email,
                    admin_user_id: user.id
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            toast({
                title: "Success",
                description: "Test user created successfully! Matches have been generated.",
            });
            setEmail("");
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Create Test User
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex gap-4">
                    <input
                        type="email"
                        placeholder="New User Email"
                        className="flex-1 px-3 py-2 border rounded-md"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <Button
                        onClick={handleCreate}
                        disabled={isLoading || !email}
                    >
                        {isLoading ? "Creating..." : "Create User"}
                    </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                    Creates a user with password 'password', replicates your profile, survey answers (including friendship) and event enrollments, and matches with you.
                </p>
            </CardContent>
        </Card>
    );
};
