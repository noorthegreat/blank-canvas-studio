import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { User as UserIcon, Calendar, Edit, Sparkles, MapPin, Phone } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User } from "@supabase/supabase-js";
import { getCityFromCoordinates } from "@/lib/geocoding";
import useAnswers from "@/hooks/use-answers";

type Profile = {
  id: string;
  first_name: string;
  age: number | null;
  bio: string | null;
  additional_photos: string[] | null;
  created_at: string;
  // private fields joined from private_profile_data
  last_name: string | null;
  latitude: number | null;
  longitude: number | null;
  phone_number: string | null;
};

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [city, setCity] = useState<string | null>(null);
  const { answersCustom } = useAnswers();
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      loadProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        loadProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadProfile = async (userId: string) => {
    setIsLoading(true);
    try {
      const [{ data, error }, { data: privateDataRaw }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase
          .from("private_profile_data" as any)
          .select("last_name, latitude, longitude, phone_number")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);
      const privateData = privateDataRaw as { last_name?: string | null; latitude?: number | null; longitude?: number | null; phone_number?: string | null } | null;

      if (error) throw error;

      if (!data) {
        toast({
          title: "No profile found!",
          description: "Please complete your profile setup :)",
        });
        navigate("/profile-setup");
        return;
      }

      setProfile({
        ...data,
        last_name: privateData?.last_name ?? null,
        latitude: privateData?.latitude ?? null,
        longitude: privateData?.longitude ?? null,
        phone_number: privateData?.phone_number ?? null,
      });

      if (privateData?.latitude && privateData?.longitude) {
        getCityFromCoordinates(privateData.latitude, privateData.longitude).then(setCity);
      }

    } catch (error: any) {
      toast({
        title: "Error loading profile",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-4">
            <Sparkles className="w-12 h-12 mx-auto text-white animate-pulse" />
            <p className="text-white">Loading Profile...</p>
          </div>
        </div>
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-muted-foreground">Profile not found</p>
        </div>
      </>
    );
  }

  const privateMessage = <span className="text-orbiitbright">(Private)</span>
  return (
    <>
      <div className="p-4 py-12">
        <div className="max-w-4xl mx-auto">
          <Card className="shadow-xl border-border/50">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div>
                    <CardTitle className="text-3xl font-bold bg-linear-to-r from-backgrounda to-backgroundc bg-clip-text text-transparent mb-2">
                      {profile.first_name}
                    </CardTitle>
                    <CardDescription>Your profile information</CardDescription>
                  </div>
                </div>
                <Button className="bg-linear-to-r from-backgrounda to-backgroundc " onClick={() => navigate("/profile-setup")}>
                  <Edit className="w-4 h-4" />
                  <div className="hidden md:block ml-2">Edit Profile</div>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <UserIcon className="w-5 h-5 text-orbiitbright mt-1" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">First Name</p>
                      <p className="text-lg">{profile.first_name}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <UserIcon className="w-5 h-5 text-orbiitbright mt-1" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Last Name {privateMessage}</p>
                      <p className="text-lg">{profile.last_name}</p>
                    </div>
                  </div>
                  {profile.age && (
                    <div className="flex items-start space-x-3">
                      <Calendar className="w-5 h-5 text-orbiitbright mt-1" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Age</p>
                        <p className="text-lg">{profile.age} years old</p>
                      </div>
                    </div>
                  )}

                  {city && (
                    <div className="flex items-start space-x-3">
                      <MapPin className="w-5 h-5 text-orbiitbright mt-1" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Location</p>
                        <p className="text-lg">{city}</p>
                      </div>
                    </div>
                  )}

                  {user && (
                    <div className="flex items-start space-x-3">
                      <UserIcon className="w-5 h-5 text-orbiitbright mt-1" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Email {privateMessage}</p>
                        <p className="text-lg">{user.email}</p>
                      </div>
                    </div>
                  )}

                  {profile.phone_number && (
                    <div className="flex items-start space-x-3">
                      <Phone className="w-5 h-5 text-orbiitbright mt-1" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Phone Number {privateMessage}</p>
                        <p className="text-lg">{profile.phone_number}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  {profile.bio && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Bio</p>
                      <Card className="bg-muted/50 border-border/50">
                        <CardContent className="pt-6">
                          <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                            {profile.bio}
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  <div className="mb-4">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Three words your friends use to describe you</p>
                    <Card className="bg-muted/50 border-border/50">
                      <CardContent className="pt-6">
                        <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                          {answersCustom[38]}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm font-medium text-muted-foreground mb-1">A fun fact about yourself</p>
                    <Card className="bg-muted/50 border-border/50">
                      <CardContent className="pt-6">
                        <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                          {answersCustom[39]}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                </div>
              </div>

              {profile.additional_photos && profile.additional_photos.length > 0 && (
                <div className="pt-6 border-t border-border">
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

              <div className="pt-6 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Member since {new Date(profile.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>


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
    </>
  );
};

export default Profile;
