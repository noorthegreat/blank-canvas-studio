import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";
import { z } from "zod";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, Trash2, Edit, AlertTriangle } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LongPressButton } from "@/components/ui/long-press-button";
import { Switch } from "@/components/ui/switch";

import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'
import useAnswers from "@/hooks/use-answers";
import { useQuestions } from "@/hooks/use-questions";

const CITY_FROM_LAT_LONG: Record<string, [number, number]> = {
  "Zurich": [47.3769, 8.5417],
  "St. Gallen": [47.42200, 9.37419],
  "Basel": [47.56279, 7.58960],
  "Bern": [46.95166, 7.41222]
};

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  lastName: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  birthday: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Birthday must be in MM/DD/YYYY format"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  bio: z.string().trim().max(1000, "Bio must be less than 1000 characters").optional(),
});

const ProfileSetup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationStatus, setLocationStatus] = useState<"pending" | "granted" | "denied">("pending");
  const [bio, setBio] = useState("");
  const [threeWords, setThreeWords] = useState("");
  const [funFact, setFunFact] = useState("");
  const [isPaused, setIsPaused] = useState(false);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [additionalPhotos, setAdditionalPhotos] = useState<string[]>([]);
  const [uploadingAdditional, setUploadingAdditional] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isTestUser, setIsTestUser] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [pendingDates, setPendingDates] = useState<any[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const photoLimit = 5;
  const minPhotos = 3;
  const { answers, answersCustom } = useAnswers();
  const { questions, isLoading: loadingQuestions } = useQuestions();

  useEffect(() => {
    if (!threeWords && answersCustom[38]) {
      setThreeWords(answersCustom[38]);
    }
    if (!funFact && answersCustom[39]) {
      setFunFact(answersCustom[39]);
    }
  }, [answersCustom, threeWords, funFact]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);

      // Check if user has test role from database
      const { data: hasTestRole } = await supabase.rpc('has_role', {
        _user_id: session.user.id,
        _role: 'test'
      });

      const { data: hasAdminRole } = await supabase.rpc('has_role', {
        _user_id: session.user.id,
        _role: 'admin'
      });

      if (hasTestRole || hasAdminRole) {
        setIsTestUser(true);
      }

      // Check if profile exists
      const profilePromise = supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      const privateDataPromise = supabase
        .from("private_profile_data" as any)
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

      Promise.all([profilePromise, privateDataPromise]).then(
        ([{ data }, { data: privateData }]) => {
          if (data) {
            setFirstName(data.first_name || "");
            setLastName(privateData?.last_name || "");
            if (privateData?.birthday) {
              const date = new Date(privateData.birthday);
              const month = String(date.getUTCMonth() + 1).padStart(2, '0');
              const day = String(date.getUTCDate()).padStart(2, '0');
              const year = date.getUTCFullYear();
              setBirthday(`${month}/${day}/${year}`);
            }
            setLatitude(privateData?.latitude ?? null);
            setLongitude(privateData?.longitude ?? null);
            if (privateData?.latitude && privateData?.longitude) {
              setLocationStatus("granted");
            }
            setBio(data.bio || "");
            setIsPaused(data.is_paused || false);
            setAdditionalPhotos(data.additional_photos || []);
            setPhoneNumber(privateData?.phone_number || "");
            setIsFirstTimeSetup(false);
          } else {
            // Check if phone number was provided during signup
            const phoneFromMeta = session.user.user_metadata?.phone_number;
            if (phoneFromMeta) {
              setPhoneNumber(phoneFromMeta);
            }
          }
        }
      );
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleRequestLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation not supported",
        description: "Your browser doesn't support location services",
        variant: "destructive",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setLocationStatus("granted");
        toast({
          title: "Location captured",
          description: "Don't forget to save your profile changes!",
        });
      },
      (error) => {
        setLocationStatus("denied");
        toast({
          title: "Location access denied",
          description: "Please choose a city from the dropdown below",
          variant: "destructive",
        });
      },
      { timeout: 2000 }
    );
  };

  const handleCitySelect = (city: string) => {
    setSelectedCity(city);
    const [lat, long] = CITY_FROM_LAT_LONG[city];
    setLatitude(lat);
    setLongitude(long);
    setLocationStatus("granted");
    toast({
      title: "Location set",
      description: `Your location has been set to ${city}. Don't forget to save your profile changes!`,
    });
  };

  const handlePhotoUpload = async (e) => {
    console.log("generic running")
    if (!user || !isTestUser) return;
    if (additionalPhotos.length >= photoLimit) {
      toast({
        title: "Photo limit reached",
        description: `You can only upload up to ${photoLimit} photos`,
        variant: "destructive",
      });
      return;
    }
    setUploadingPhoto(true);

    try {
      const genericFiles = ["generic1.jpg", "generic2.jpg", "generic3.jpg"]; //TODO fix RLS policy on this
      const randomElement = genericFiles[Math.floor(Math.random() * genericFiles.length)];
      const { data: { publicUrl } } = supabase.storage
        .from("generic-profile-photos")
        .getPublicUrl(randomElement);

      setAdditionalPhotos([...additionalPhotos, publicUrl]);

    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleAdditionalPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Check if already at limit
    if (additionalPhotos.length >= photoLimit) {
      toast({
        title: "Photo limit reached",
        description: `You can only upload up to ${photoLimit} photos`,
        variant: "destructive",
      });
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploadingAdditional(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/additional_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("profile-photos")
        .getPublicUrl(fileName);

      setAdditionalPhotos([...additionalPhotos, publicUrl]);

      toast({
        title: "Photo added",
        description: "Photo has been uploaded",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingAdditional(false);
    }
  };

  const handleRemoveAdditionalPhoto = async (index: number) => {
    const photoUrl = additionalPhotos[index];
    const photoPath = photoUrl.split("/").slice(-2).join("/");

    try {
      await supabase.storage.from("profile-photos").remove([photoPath]);
      const newPhotos = additionalPhotos.filter((_, i) => i !== index);
      setAdditionalPhotos(newPhotos);

      toast({
        title: "Photo removed",
        description: "Photo has been deleted",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (latitude === null || longitude === null) {
      toast({
        title: "Location required",
        description: "Please allow location access to continue",
        variant: "destructive",
      });
      return;
    }
    if (isTestUser) {
      if (additionalPhotos.length < minPhotos) {
        toast({
          title: "(TEST MODE) Photos required but skipped!",
          description: `Test mode active`,
        });
      }
    }
    else {
      if (additionalPhotos.length < minPhotos) {
        toast({
          title: "Photos required",
          description: `Please upload at least ${minPhotos} photos of yourself :)`,
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);

    try {
      // Validate input
      const validation = profileSchema.safeParse({
        firstName,
        lastName,
        birthday,
        latitude,
        longitude,
        bio,
      });

      if (!validation.success) {
        const errors = validation.error.errors.map(e => e.message).join(", ");
        throw new Error(errors);
      }

      // Parse birthday and calculate age
      const [month, day, year] = birthday.split('/').map(Number);
      const birthdayDate = new Date(year, month - 1, day);
      const today = new Date();
      let calculatedAge = today.getUTCFullYear() - birthdayDate.getUTCFullYear();
      const monthDiff = today.getUTCMonth() - birthdayDate.getUTCMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birthdayDate.getUTCDate())) {
        calculatedAge--;
      }

      // Validate age
      if (calculatedAge < 18) {
        throw new Error("Must be at least 18 years old");
      }
      if (calculatedAge > 120) {
        throw new Error("Please enter a valid birthday");
      }

      // Check if questionnaire is completed
      let questionnaireCompleted = true;
      for (const q of questions) {
        // only check the combined questions
        if (!q.combined) continue;
        // Skip if skippable
        if (q.minResponses === 0) continue;

        // Skip if hidden
        if (q.showIf) {
          const dependentAnswer = answers[q.showIf.questionId];
          if (dependentAnswer !== q.showIf.answer) continue;
        }

        // Check if answered
        const userAnswer = answers[q.id];
        if (!userAnswer || userAnswer.trim() === "") {
          questionnaireCompleted = false;
          break;
        }
      }

      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          first_name: validation.data.firstName,
          age: calculatedAge,
          bio: validation.data.bio || null,
          is_paused: isPaused,
          completed_questionnaire: questionnaireCompleted,
          additional_photos: additionalPhotos,
        });

      if (error) throw error;

      const { error: privateError } = await supabase
        .from("private_profile_data" as any)
        .upsert({
          user_id: user.id,
          email: user.email,
          last_name: validation.data.lastName,
          birthday: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          latitude: validation.data.latitude,
          longitude: validation.data.longitude,
          phone_number: phoneNumber || null,
        });

      if (privateError) throw privateError;

      const profilePromptAnswers = [
        {
          user_id: user.id,
          question_number: 38,
          question_id: 38,
          answer: (threeWords || "").trim(),
          answer_custom: (threeWords || "").trim() || null,
        },
        {
          user_id: user.id,
          question_number: 39,
          question_id: 39,
          answer: (funFact || "").trim(),
          answer_custom: (funFact || "").trim() || null,
        },
      ];
      const { error: promptAnswersError } = await supabase
        .from("personality_answers")
        .upsert(profilePromptAnswers, { onConflict: "user_id,question_number" });
      if (promptAnswersError) throw promptAnswersError;

      if (isFirstTimeSetup) {
        toast({
          title: "Profile setup complete!",
          description: "Welcome aboard!",
        });


      } else {
        toast({
          title: "Profile saved!",
          description: "Your changes have been updated.",
        });
      }
      navigate("/matches")
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
  const privateMessage = <span className="text-muted-foreground">(Private)</span>
  return (
    <>
      <div className="p-4 py-12">
        <Card className="max-w-2xl mx-auto shadow-xl border-border/50">
          <CardHeader>
            <CardTitle className="text-3xl font-bold bg-linear-to-r from-backgrounda to-backgroundc bg-clip-text text-transparent">
              {isFirstTimeSetup ? "Create Your Profile" : "Edit Your Profile"}
            </CardTitle>
            <CardDescription>Tell us about yourself to find your perfect match</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  {isTestUser && (<>
                    <Label>Upload Generic Photos</Label>
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-yellow-200"
                      size="sm"
                      disabled={uploadingPhoto}
                      onClick={(e) => { handlePhotoUpload(e) }}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingPhoto ? "Uploading..." : "Add generic Photo"}
                    </Button>
                  </>
                  )}
                  <Label>Upload Photos ({additionalPhotos.length}/{photoLimit})</Label>
                  {additionalPhotos.length < photoLimit && (
                    <>
                      <Input
                        id="additional-photo"
                        type="file"
                        accept="image/*"
                        onChange={handleAdditionalPhotoUpload}
                        disabled={uploadingAdditional}
                        className="hidden"
                      />
                      <Label htmlFor="additional-photo">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploadingAdditional}
                          onClick={() => document.getElementById("additional-photo")?.click()}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {uploadingAdditional ? "Uploading..." : "Add Photo"}
                        </Button>
                      </Label>
                    </>
                  )}
                </div>
                {additionalPhotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-4">
                    {additionalPhotos.map((photo, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={photo}
                          alt={`Photo ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg cursor-pointer"
                          onClick={() => setSelectedPhotoUrl(photo)}
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveAdditionalPhoto(index);
                          }}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <span className="text-sm text-muted-foreground">Tip: recent (last 6 months), at least 1 head-and-shoulders portrait, good lighting, no group shots.</span>
              <div className="space-y-2">

                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  required
                />
              </div>
              <div className="space-y-2">

                <Label htmlFor="lastName">Last Name {privateMessage}</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number {privateMessage}</Label>
                <div id="phoneNumber">
                  <PhoneInput
                    country={"ch"}
                    preferredCountries={['ch', 'de', 'us']}
                    placeholder="+1234567890"
                    value={phoneNumber}
                    onChange={(phone) => setPhoneNumber(phone)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="birthday">Birthday</Label>
                  <Input
                    id="birthday"
                    type="text"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    placeholder="MM/DD/YYYY"
                    required
                    maxLength={10}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Location</Label>
                  {locationStatus === "granted" && latitude && longitude ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 rounded-md border border-border bg-muted text-sm">
                        Location set ✓
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRequestLocation}
                      >
                        Update
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={handleRequestLocation}
                      >
                        {locationStatus === "denied" ? "Retry Location Access" : "Get My Location"}
                      </Button>
                      {locationStatus === "denied" && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Or choose a city:</Label>
                          <Select value={selectedCity} onValueChange={handleCitySelect}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select a city" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.keys(CITY_FROM_LAT_LONG).map((city) => (
                                <SelectItem key={city} value={city}>
                                  {city}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  className="min-h-[120px]"
                />
              </div>
              <div >
                <div className="pt-6 border-t border-border"></div>
                <p className="text-sm font-bold text-orbiit mb-4">Profile prompts shown to your matches:</p>
                <div className="mb-4">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Three words your friends use to describe you:</p>
                  <Textarea
                    value={threeWords}
                    onChange={(e) => setThreeWords(e.target.value)}
                    placeholder="e.g. Warm, curious, reliable"
                    className="min-h-[80px]"
                  />
                </div>

                <div className="mb-4">
                  <p className="text-sm font-medium text-muted-foreground mb-1">A fun fact about yourself:</p>
                  <Textarea
                    value={funFact}
                    onChange={(e) => setFunFact(e.target.value)}
                    placeholder="Share a fun fact about yourself"
                    className="min-h-[80px]"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-linear-to-r from-backgrounda to-backgroundc hover:opacity-90 transition-opacity"
                disabled={isLoading || loadingQuestions}
              >
                {isLoading ? "Saving..." : isFirstTimeSetup ? "Finish Profile Setup" : "Save Profile"}
              </Button>

              <div className="pt-6 border-t border-border space-y-2 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => navigate("/change-password")}
                >
                  <Edit className="w-4 h-4 mr-2" />Change Password
                </Button>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/20"
                    onClick={() => setPauseDialogOpen(true)}
                  >
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-2 ${isPaused ? "bg-amber-500" : "bg-gray-300"}`} />
                      {isPaused ? "Profile Paused" : "Pause Profile"}
                    </div>
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      // Check for pending dates before opening dialog
                      if (user) {
                        supabase
                          .from('dates')
                          .select('*')
                          .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
                          .in('status', ['pending', 'confirmed'])
                          .then(({ data }) => {
                            if (data) setPendingDates(data);
                            setDeleteDialogOpen(true);
                          });
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />Delete
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <Dialog open={pauseDialogOpen} onOpenChange={setPauseDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Pause Account</DialogTitle>
              <DialogDescription>
                Temporarily hide your profile from new matches. You'll keep your existing matches and dates.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6">
              <div className="flex items-center justify-between space-x-4 rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Pause Status</Label>
                  <div className="text-sm text-muted-foreground">
                    {isPaused ? "Your account is currently paused" : "Your account is active"}
                  </div>
                </div>
                <Switch
                  checked={isPaused}
                  onCheckedChange={async (checked) => {
                    if (!user) return;
                    setIsPaused(checked); // Optimistic update

                    try {
                      const { error } = await supabase
                        .from('profiles')
                        .update({
                          is_paused: checked
                        })
                        .eq('id', user.id);

                      if (error) throw error;

                      toast({
                        title: checked ? "Account Paused" : "Account Active",
                        description: checked
                          ? "You won't receive new matches until you unpause."
                          : "You are back in the pool for new matches!",
                      });
                    } catch (error: any) {
                      setIsPaused(!checked); // Revert on error
                      toast({
                        title: "Error",
                        description: error.message,
                        variant: "destructive",
                      });
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setPauseDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Delete Account
              </DialogTitle>
              <DialogDescription className="pt-4 space-y-4">
                <p>
                  Are you sure you want to delete your account? This action is permanent and cannot be undone.
                  All your data, including matches and messages, will be permanently removed.
                </p>

                {pendingDates.length > 0 && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-md border border-yellow-200 dark:border-yellow-800">
                    <p className="text-yellow-800 dark:text-yellow-200 font-medium mb-2">
                      Warning: You have upcoming dates!
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      Deleting your account will cancel these dates. Your matches will be notified that the date is cancelled.
                    </p>
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-center pt-4">
              <div className="w-full space-y-4">
                <LongPressButton
                  onLongPress={async () => {
                    if (!user) return;
                    setIsDeleting(true);
                    try {
                      // 1. Delete account via edge function (which handles notifications)
                      const { error } = await supabase.functions.invoke('delete-account');
                      if (error) throw error;

                      // 4. Sign out and redirect
                      await supabase.auth.signOut();
                      toast({
                        title: "Account deleted",
                        description: "Your account has been permanently deleted.",
                      });
                      navigate("/");
                    } catch (error: any) {
                      toast({
                        title: "Error deleting account",
                        description: error.message,
                        variant: "destructive",
                      });
                      setIsDeleting(false);
                    }
                  }}
                  variant="destructive"
                  className="w-full"
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Hold to Delete Account"}
                </LongPressButton>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setDeleteDialogOpen(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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

      </div >
    </>);
};

export default ProfileSetup;
