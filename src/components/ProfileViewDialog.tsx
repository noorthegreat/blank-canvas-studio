import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Sparkles, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import ReportProfileDialog from "@/components/ReportProfileDialog";
import { Trash2 } from "lucide-react";

type Profile = {
  id: string;
  first_name: string;
  age: number | null;
  bio: string | null;
  three_words_friends_describe?: string | null;
  fun_fact?: string | null;
  additional_photos: string[] | null;
  created_at: string;
};

type ProfileViewDialogProps = {
  profile: Profile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showAdminDelete?: boolean;
  onAdminDelete?: () => void;
  adminDeleting?: boolean;
  showAdminInfo?: boolean;
  compatibilityWithUserId?: string | null;
  matchType?: 'relationship' | 'friendship';
};

const ProfileViewDialog = ({
  profile,
  open,
  onOpenChange,
  showAdminDelete = false,
  onAdminDelete,
  adminDeleting = false,
  showAdminInfo = false,
  compatibilityWithUserId = null,
  matchType = 'relationship',
}: ProfileViewDialogProps) => {
  const [compatibility, setCompatibility] = useState<string | null>(null);
  const [loadingCompatibility, setLoadingCompatibility] = useState(false);
  const [regeneratingCompatibility, setRegeneratingCompatibility] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);


  useEffect(() => {
    const fetchCompatibility = async () => {
      if (!profile || !open) return;
      if (showAdminInfo && !compatibilityWithUserId) {
        setCompatibility(null);
        setLoadingCompatibility(false);
        return;
      }

      setLoadingCompatibility(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const compatibilityUserId1 = compatibilityWithUserId || user.id;
        const compatibilityUserId2 = profile.id;

        // First, try to get compatibility from database
        const { data: existingCompatibility, error: dbError } = await supabase
          .from('compatibility_insights')
          .select('compatibility_text')
          .or(`and(user1_id.eq.${compatibilityUserId1},user2_id.eq.${compatibilityUserId2}),and(user1_id.eq.${compatibilityUserId2},user2_id.eq.${compatibilityUserId1})`)
          .maybeSingle();

        if (dbError) {
          console.error('Error fetching compatibility from DB:', dbError);
        }

        if (existingCompatibility) {
          setCompatibility(existingCompatibility.compatibility_text);
        } else {
          // If no cached compatibility, generate it
          const { data, error } = await supabase.functions.invoke('generate-compatibility', {
            body: { userId1: compatibilityUserId1, userId2: compatibilityUserId2, match_type: matchType }
          });

          if (error) {
            const response = (error as any)?.context as Response | undefined;
            if (response?.status === 403) {
              let reason = "";
              try {
                const text = await response.text();
                const payload = text ? JSON.parse(text) : null;
                reason = payload?.error || "";
              } catch {
                // Ignore body parse errors and use fallback message.
              }
              if (reason === "Not authorized to view this compatibility") {
                setCompatibility("Compatibility is only available to the two matched users.");
              } else {
                setCompatibility("Compatibility is available once both users are an active match.");
              }
              return;
            }
            console.error('Error generating compatibility:', error);
            return;
          }

          const payload = typeof data === "string" ? JSON.parse(data) : data;
          setCompatibility(payload?.compatibility || null);
        }
      } catch (error) {
        console.error('Error fetching compatibility:', error);
      } finally {
        setLoadingCompatibility(false);
      }
    };

    fetchCompatibility();
  }, [profile, open, showAdminInfo, compatibilityWithUserId, matchType]);

  if (!profile) return null;

  const handleRegenerateCompatibility = async () => {
    if (!profile || !compatibilityWithUserId) return;
    setRegeneratingCompatibility(true);
    setLoadingCompatibility(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-compatibility', {
        body: {
          userId1: compatibilityWithUserId,
          userId2: profile.id,
          force_regenerate: true,
          match_type: matchType,
        }
      });
      if (error) throw error;
      const payload = typeof data === "string" ? JSON.parse(data) : data;
      setCompatibility(payload?.compatibility || null);
    } catch (error) {
      console.error("Error regenerating compatibility:", error);
    } finally {
      setLoadingCompatibility(false);
      setRegeneratingCompatibility(false);
    }
  };

  const memberSinceDate = profile.created_at ? new Date(profile.created_at) : null;
  const memberSinceLabel = memberSinceDate && !Number.isNaN(memberSinceDate.getTime())
    ? memberSinceDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    : "Unknown";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">
            {profile.first_name}
          </DialogTitle>
          {profile.age && (
            <p className="text-sm text-muted-foreground">{profile.age} years old</p>
          )}
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {(loadingCompatibility || compatibility) && (
            <Card className="bg-linear-to-r from-primary/10 to-secondary/10 border-primary/20">
              <CardContent className="pt-4">
                <div className="flex items-start space-x-3">
                  <Sparkles className="w-5 h-5 text-primary mt-1 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Why You Might Click</p>
                    {loadingCompatibility ? (
                      <><p className="text-sm">Loading Compatibility (May take ~30 seconds)</p><Skeleton className="h-16 w-full" /></>
                    ) : (
                      <p className="text-sm leading-relaxed">{compatibility}</p>
                    )}
                    {showAdminInfo && compatibilityWithUserId && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={handleRegenerateCompatibility}
                        disabled={regeneratingCompatibility}
                      >
                        {regeneratingCompatibility ? "Regenerating..." : "Regenerate compatibility"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">

              {showAdminInfo && (
                <div className="flex items-start space-x-3">
                  <Calendar className="w-5 h-5 text-primary mt-1" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Member since</p>
                    <p className="text-base">{memberSinceLabel}</p>
                  </div>
                </div>
              )}
            </div>

            <div>
              {profile.bio && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Bio</p>
                  <Card className="bg-muted/50 border-border/50">
                    <CardContent className="pt-4">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {profile.bio}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {profile.three_words_friends_describe && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Three words friends use to describe you</p>
                  <Card className="bg-muted/50 border-border/50">
                    <CardContent className="pt-4">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {profile.three_words_friends_describe}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {profile.fun_fact && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Fun fact</p>
                  <Card className="bg-muted/50 border-border/50">
                    <CardContent className="pt-4">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {profile.fun_fact}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>

          {profile.additional_photos && profile.additional_photos.length > 0 && (
            <div className="pt-4 border-t border-border">
              <p className="text-sm font-medium text-muted-foreground mb-4">Photos</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {profile.additional_photos.map((photo, index) => (
                  <img
                    key={index}
                    src={photo}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-48 object-cover rounded-lg shadow-md cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setSelectedPhotoUrl(photo)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-center items-center gap-2 mt-6 mb-2">
          {showAdminDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onAdminDelete}
              disabled={adminDeleting}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {adminDeleting ? "Deleting..." : "Delete User"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setReportOpen(true)}
          >
            <Flag className="w-4 h-4 mr-2" />
            Report Profile
          </Button>
        </div>
      </DialogContent>

      <Dialog open={!!selectedPhotoUrl} onOpenChange={() => setSelectedPhotoUrl(null)}>
        <DialogContent className="max-w-4xl p-0 border-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Profile photo preview</DialogTitle>
          </DialogHeader>
          {selectedPhotoUrl && (
            <img
              src={selectedPhotoUrl}
              alt="Full size"
              className="w-full h-auto max-h-[90vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      <ReportProfileDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        reportedUserId={profile.id}
        reportedUserName={profile.first_name}
      />
    </Dialog >
  );
};

export default ProfileViewDialog;
