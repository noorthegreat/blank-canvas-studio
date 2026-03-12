import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";
import { Sparkles, Clock } from "lucide-react";
import ProfileViewDialog from "@/components/ProfileViewDialog";
import EventBanner from "@/components/EventBanner";
import DateCreatedDialog from "@/components/matches/DateCreatedDialog";
import MatchCard, { Match } from "@/components/matches/MatchCard";
import HowOrbiitWorksDialog from "@/components/HowOrbiitWorksDialog";
import { canAccessDating } from "@/lib/dating-eligibility";
import StudentEmailVerificationCard from "@/components/StudentEmailVerificationCard";
import { syncProfileEmailFromAuth } from "@/lib/profile-email";

// The one-time extension is now disabled and weekly decisions are back to Monday only.
const ONE_TIME_DECISION_EXTENSION_ENABLED = false;
const ONE_TIME_DECISION_EXTENSION_START_UTC_MS = Date.UTC(2026, 2, 9, 8, 0, 0, 0);
const ONE_TIME_DECISION_EXTENSION_END_UTC_MS = Date.UTC(2026, 2, 11, 0, 0, 0, 0);

const Matches = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [selectedMatchType, setSelectedMatchType] = useState<'relationship' | 'friendship'>('relationship');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isTestUser, setIsTestUser] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [timeProgress, setTimeProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState("");
  const [isDecisionWindow, setIsDecisionWindow] = useState(false);
  const [showDateDialog, setShowDateDialog] = useState(false);
  const [newDateMatch, setNewDateMatch] = useState<any>(null);
  const [isCreatingDate, setIsCreatingDate] = useState(false);
  const [isEnrolledInEvent, setIsEnrolledInEvent] = useState(false);
  const [showIntroDialog, setShowIntroDialog] = useState(false);
  const [canDate, setCanDate] = useState(true);
  const [pendingFeedbackCount, setPendingFeedbackCount] = useState(0);
  const getPendingFeedbackCount = async (currentUserId: string): Promise<number> => {
    const { data: completedDates, error: datesError } = await supabase
      .from("dates")
      .select("id, user1_id, user2_id, user1_followup_preference, user2_followup_preference")
      .eq("status", "completed")
      .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`);

    if (datesError) throw datesError;
    if (!completedDates || completedDates.length === 0) return 0;

    const completedDateIds = completedDates.map((d) => d.id);

    // @ts-ignore - Generated types can lag behind migrations in some environments
    const { data: answers, error: answersError } = await (supabase as any)
      .from("date_feedback_answers")
      .select("date_id")
      .eq("user_id", currentUserId)
      .in("date_id", completedDateIds);

    if (answersError) throw answersError;

    const answeredDateIds = new Set<string>((answers || []).map((a: { date_id: string }) => a.date_id));

    let pendingCount = 0;
    for (const date of completedDates) {
      const isUser1 = date.user1_id === currentUserId;
      const followupSet = isUser1 ? !!date.user1_followup_preference : !!date.user2_followup_preference;
      const hasAnswers = answeredDateIds.has(date.id);
      if (!followupSet || !hasAnswers) {
        pendingCount += 1;
      }
    }

    return pendingCount;
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      const { data: hasTestRole } = await supabase.rpc('has_role', {
        _user_id: session.user.id,
        _role: 'test'
      });

      if (hasTestRole) {
        setIsTestUser(true);
      }

      const { data: hasAdminRole } = await supabase.rpc('has_role', {
        _user_id: session.user.id,
        _role: 'admin'
      });

      if (hasAdminRole) {
        setIsAdmin(true);
      }
      setUser(session.user);
      await syncProfileEmailFromAuth(session.user.id, session.user.email);
      const userCanDate = canAccessDating(session.user);
      setCanDate(userCanDate);
      setPendingFeedbackCount(0);

      // Check pause status
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_paused")
        .eq("id", session.user.id)
        .single();

      if (profile?.is_paused) {
        // Create a patched user object with metadata including is_paused to pass to render
        const patchedUser = {
          ...session.user,
          user_metadata: {
            ...session.user.user_metadata,
            is_paused: true
          }
        };
        setUser(patchedUser as User);
      }

      if (!userCanDate) {
        setIsLoading(false);
        return;
      }

      try {
        const pending = await getPendingFeedbackCount(session.user.id);
        setPendingFeedbackCount(pending);
      } catch (error) {
        console.error("Error checking feedback completion gate:", error);
      }

      loadMatches(session.user.id);
      checkEventEnrollment(session.user.id);
      checkIntroDialog(session.user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        void syncProfileEmailFromAuth(session.user.id, session.user.email);
        setCanDate(canAccessDating(session.user));
        void (async () => {
          if (!canAccessDating(session.user)) {
            setPendingFeedbackCount(0);
            return;
          }
          try {
            const pending = await getPendingFeedbackCount(session.user.id);
            setPendingFeedbackCount(pending);
          } catch (error) {
            console.error("Error checking feedback completion gate:", error);
          }
        })();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const calculateWeeklyWindow = () => {
      const now = new Date();
      const nowMs = now.getTime();
      const daysSinceMonday = (now.getUTCDay() + 6) % 7;
      const thisMondayAt8UTC = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - daysSinceMonday,
        8,
        0,
        0,
        0
      );
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      const cycleStart = nowMs >= thisMondayAt8UTC ? thisMondayAt8UTC : thisMondayAt8UTC - weekMs;
      const nextDrop = cycleStart + weekMs;
      const mondayDecisionWindowEnd = cycleStart + (16 * 60 * 60 * 1000); // Monday 08:00 -> 24:00 UTC
      const isBaseDecisionWindowOpen = nowMs >= cycleStart && nowMs < mondayDecisionWindowEnd;
      const isOneTimeExtensionWindowOpen =
        ONE_TIME_DECISION_EXTENSION_ENABLED &&
        nowMs >= ONE_TIME_DECISION_EXTENSION_START_UTC_MS &&
        nowMs < ONE_TIME_DECISION_EXTENSION_END_UTC_MS;

      const progress = Math.min(100, Math.max(0, ((nowMs - cycleStart) / weekMs) * 100));
      const timeLeftMs = nextDrop - nowMs;
      const days = Math.floor(timeLeftMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeLeftMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeLeftMs % (1000 * 60)) / 1000);

      setTimeProgress(progress);
      setTimeRemaining(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      setIsDecisionWindow(isBaseDecisionWindowOpen || isOneTimeExtensionWindowOpen);
    };

    calculateWeeklyWindow();
    const interval = setInterval(calculateWeeklyWindow, 1000);

    return () => clearInterval(interval);
  }, []);

  const loadMatches = async (userId: string) => {
    setIsLoading(true);
    try {
      const { data: matchesData, error: matchesError } = await supabase
        .from("matches")
        .select("id, compatibility_score, matched_user_id, from_algorithm, match_type")
        .eq("user_id", userId)
        .order("compatibility_score", { ascending: false });

      if (matchesError) throw matchesError;

      if (!matchesData || matchesData.length === 0) {
        console.log("No matches to show")
        setMatches([]);
        setIsLoading(false);
        return;
      }
      const temp_disable_matches = false
      if (!isTestUser && temp_disable_matches) {
        console.log("Not a test user, and matches are temporarily disabled")
        setMatches([]);
        setIsLoading(false);
        return;
      }
      console.log(isTestUser, "Showing Matches")

      // Get profiles for matched users
      const matchedUserIds = matchesData.map((m) => m.matched_user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, bio, age, additional_photos, created_at")
        .in("id", matchedUserIds);

      if (profilesError) throw profilesError;

      // Get likes data
      const { data: myLikesData } = await supabase
        .from("likes")
        .select("liked_user_id")
        .eq("user_id", userId)
        .in("liked_user_id", matchedUserIds);

      const { data: theirLikesData } = await supabase
        .from("likes")
        .select("user_id")
        .eq("liked_user_id", userId)
        .in("user_id", matchedUserIds);

      const { data: myFriendLikesData } = await supabase
        .from("friendship_likes")
        .select("liked_user_id")
        .eq("user_id", userId)
        .in("liked_user_id", matchedUserIds);

      const { data: theirFriendLikesData } = await supabase
        .from("friendship_likes")
        .select("user_id")
        .eq("liked_user_id", userId)
        .in("user_id", matchedUserIds);

      // Check event enrollments for matched users
      const { data: enrollmentsData } = await supabase
        .from("event_enrollments")
        .select("user_id")
        .in("user_id", matchedUserIds);

      const enrolledUserIds = new Set(enrollmentsData?.map(e => e.user_id) || []);

      const myLikes = new Set(myLikesData?.map((l) => l.liked_user_id) || []);
      const theirLikes = new Set(theirLikesData?.map((l) => l.user_id) || []);
      const myFriendLikes = new Set(myFriendLikesData?.map((l) => l.liked_user_id) || []);
      const theirFriendLikes = new Set(theirFriendLikesData?.map((l) => l.user_id) || []);

      // Combine matches with profiles and likes
      const combinedMatches = matchesData
        .filter(match => {
          if (match.from_algorithm === 'event') {
            return enrolledUserIds.has(match.matched_user_id || "");
          }
          return true;
        })
        .map((match) => {
          const profile = profilesData?.find((p) => p.id === match.matched_user_id);
          const isFriendship = match.match_type === "friendship";
          const activeMyLikes = isFriendship ? myFriendLikes : myLikes;
          const activeTheirLikes = isFriendship ? theirFriendLikes : theirLikes;
          return {
            id: match.id,
            compatibility_score: match.compatibility_score,
            matched_user: profile || {
              id: match.matched_user_id,
              first_name: "Unknown User",
              last_name: "",
              bio: null,
              age: null,
              latitude: null,
              longitude: null,
            },
            isLikedByMe: activeMyLikes.has(match.matched_user_id),
            isLikedByThem: activeTheirLikes.has(match.matched_user_id),
            from_algorithm: match.from_algorithm,
            match_type: match.match_type
          };
        });

      setMatches(combinedMatches);
    } catch (error: any) {
      toast({
        title: "Error loading matches",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const checkEventEnrollment = async (userId: string) => {
    try {
      const { count, error } = await supabase
        .from("event_enrollments")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", userId);

      if (error) throw error;
      setIsEnrolledInEvent((count || 0) > 0);
    } catch (error) {
      console.error("Error checking event enrollment:", error);
    }
  };

  const checkIntroDialog = async (userId: string) => {
    try {
      // Check if user has seen the dialog in DB
      const { data, error } = await supabase
        .from("profiles")
        .select("has_seen_intro_dialog")
        .eq("id", userId)
        .single();

      if (error) {
        // Fallback to localStorage if column doesn't exist yet or other error
        console.log("Error checking intro dialog status, falling back to localStorage:", error);
        const hasSeenLocal = localStorage.getItem(`has_seen_intro_dialog_${userId}`);
        if (!hasSeenLocal) {
          setShowIntroDialog(true);
        }
        return;
      }

      // @ts-ignore - column might not exist in types yet
      if (!data?.has_seen_intro_dialog) {
        setShowIntroDialog(true);
      }
    } catch (error) {
      console.error("Error checking intro dialog:", error);
    }
  };

  const handleCloseIntroDialog = async (open: boolean) => {
    if (!open && user) {
      setShowIntroDialog(false);

      // Update DB
      try {
        const { error } = await supabase
          .from("profiles")
          // @ts-ignore - column might not exist in types yet
          .update({ has_seen_intro_dialog: true })
          .eq("id", user.id);

        if (error) throw error;
      } catch (error) {
        console.error("Error updating intro dialog status:", error);
        // Fallback to localStorage
        localStorage.setItem(`has_seen_intro_dialog_${user.id}`, "true");
      }
    } else {
      setShowIntroDialog(open);
    }
  };

  const handleLike = async (match: Match, event: React.MouseEvent) => {
    if (!user) return;
    event.stopPropagation();

    if (match.from_algorithm !== 'event' && !isDecisionWindow && !isAdmin && !isTestUser) {
      toast({
        title: "Decision window is closed",
        description: "You can like or pass weekly matches on Monday (08:00-24:00 UTC).",
        variant: "destructive",
      });
      return;
    }

    try {
      const likesTable = match.match_type === "friendship" ? "friendship_likes" : "likes";
      const { error } = await supabase
        .from(likesTable as any)
        .insert({ user_id: user.id, liked_user_id: match.matched_user.id });

      if (error) throw error;

      if (match.match_type !== "friendship" && match.isLikedByThem && match.from_algorithm !== 'event') {
        // It's a match! Show dialog and create date
        setNewDateMatch(match.matched_user);
        setShowDateDialog(true);
        setIsCreatingDate(true);

        // Call edge function to create date and send email
        const { error: funcError } = await supabase.functions.invoke('check-match-and-create-date', {
          body: { userId: user.id, matchedUserId: match.matched_user.id }
        });

        if (funcError) {
          console.error("Error creating date:", funcError);
          // We don't show an error to the user here to keep the flow positive,
          // but we log it. The date might have been created by the other user already
        }
        setIsCreatingDate(false);
      } else {
        toast({
          title: "Liked!",
          description: match.match_type === "friendship"
            ? (match.isLikedByThem
              ? "You both want to connect as friends."
              : "If they wave back, you'll be connected as friends.")
            : match.from_algorithm === 'event'
            ? "Thanks! Dates will be setup a couple days before the event."
            : "If they like you back, a date will be created.",
        });
      }
    } catch (error: any) {
      setIsCreatingDate(false);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDislike = async (matchId: string, matchedUserId: string, event: React.MouseEvent) => {
    if (!user) return;
    event.stopPropagation();

    const targetMatch = matches.find((m) => m.id === matchId);
    if (targetMatch && targetMatch.from_algorithm !== 'event' && !isDecisionWindow && !isAdmin && !isTestUser) {
      toast({
        title: "Decision window is closed",
        description: "You can like or pass weekly matches on Monday (08:00-24:00 UTC).",
        variant: "destructive",
      });
      return;
    }

    try {
      // Remove matches for both users
      const { error: deleteError } = await supabase
        .from("matches")
        .delete()
        .or(`and(user_id.eq.${user.id},matched_user_id.eq.${matchedUserId}),and(user_id.eq.${matchedUserId},matched_user_id.eq.${user.id})`);

      if (deleteError) throw deleteError;

      const dislikesTable = targetMatch?.match_type === "friendship" ? "friendship_dislikes" : "dislikes";
      // Add dislike entry
      const { error: dislikeError } = await supabase
        .from(dislikesTable as any)
        .insert({ user_id: user.id, disliked_user_id: matchedUserId });

      if (dislikeError) throw dislikeError;

      toast({
        title: "Match removed",
        description: "You won't see this person again.",
      });

      loadMatches(user.id);
    } catch (error: any) {
      const isEdgeReachabilityError =
        typeof error?.message === "string" &&
        error.message.includes("Failed to send a request to the Edge Function");

      toast({
        title: "Error",
        description: isEdgeReachabilityError
          ? "Debug function is not reachable. Deploy `debug-seed-date-flow` (or run local functions) and try again."
          : error.message,
        variant: "destructive",
      });
    }
  };

  const handleRecalculate = async () => {
    if (!user) return;

    setIsLoading(true);
    try {

      toast({
        title: "Matches updated!",
        description: "Your current weekly matches are being fetched.",
      });

      loadMatches(user.id);
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

  const handleDebugMatch = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.functions.invoke("debug-seed-date-flow", {
        body: { count: 5 }
      });
      if (error) throw error;
      const payload = typeof data === "string" ? JSON.parse(data) : data;
      if (!payload?.success) throw new Error(payload?.error || "Failed to create debug data");

      toast({
        title: "Debug Match Created",
        description: `Created ${payload.matchesCreated} debug matches. One pair is confirmed for ~10 minutes from now.`,
      });
      loadMatches(user.id);
    } catch (error: any) {
      let message = error?.message || "Unknown error";
      if (typeof error?.context?.json === "function") {
        try {
          const details = await error.context.json();
          if (details?.error) message = details.error;
        } catch {
          // keep existing message
        }
      }
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleViewProfile = async (matchedUserId: string, matchType: 'relationship' | 'friendship' = 'relationship') => {
    try {
      const [{ data, error }, { data: promptAnswers, error: promptError }] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", matchedUserId)
          .single(),
        supabase
          .from("personality_answers")
          .select("question_number, answer, answer_custom")
          .eq("user_id", matchedUserId)
          .in("question_number", [38, 39]),
      ]);

      if (error) throw error;
      if (promptError) throw promptError;

      const answerByQuestion = new Map<number, any>(
        (promptAnswers || []).map((a: any) => [a.question_number, a])
      );
      const threeWords = answerByQuestion.get(38)?.answer_custom || answerByQuestion.get(38)?.answer || null;
      const funFact = answerByQuestion.get(39)?.answer_custom || answerByQuestion.get(39)?.answer || null;

      setSelectedProfile({
        ...data,
        three_words_friends_describe: threeWords,
        fun_fact: funFact,
      });
      setSelectedMatchType(matchType);
      setIsProfileOpen(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Sparkles className="w-12 h-12 mx-auto text-white animate-pulse" />
          <p className="text-white">Finding your perfect matches...</p>
        </div>
      </div>
    );
  }

  const canSeeWeeklyMatches = isDecisionWindow || isAdmin || isTestUser;
  const weeklyMatches = canSeeWeeklyMatches
    ? matches.filter((match) => match.from_algorithm !== "event")
    : [];

  return (
    <>
      <div className="p-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold text-white bg-clip-text text-transparent mb-2">
                Your Matches
              </h1>
              <p className="text-white">
                Every Monday at 08:00 UTC you'll be shown up to 5 of the best matches we could find for you.
                <br />
                You must decide on Monday (like/pass). If both like each other, you'll have 1 week to schedule a date.
              </p>
            </div>
            <div className="flex gap-2">
              {isAdmin && (
                <Button variant="outline" onClick={handleDebugMatch} className="border-primary text-primary hover:bg-primary/10">
                  Debug Match
                </Button>
              )}
            </div>
          </div>

          {/* Event Banner */}
          {/* <EventBanner onEnrollmentChange={setIsEnrolledInEvent} /> */}

          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Next matches in: {timeRemaining}</span>
                </div>
                <span className="text-xs text-muted-foreground">Mondays 08:00 UTC</span>
              </div>
              <Progress value={timeProgress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {isDecisionWindow
                  ? "Decision window is open now (Monday 08:00-24:00 UTC)."
                  : "Decision window is closed. Likes and passes reopen next Monday at 08:00 UTC."}
              </p>
            </CardContent>
          </Card>

          {user && (
            <div className="mb-6">
              {/* @ts-ignore - is_paused might be missing in older types */}
              {user.user_metadata?.is_paused && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 mb-4">
                  <div className="flex">
                    <div className="shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700 dark:text-yellow-200">
                        Your account is currently paused. You won't receive new matches until you unpause it in your <a href="/profile-setup" className="font-medium underline hover:text-yellow-600 dark:hover:text-yellow-100">profile settings</a>.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {pendingFeedbackCount > 0 && (canDate || isAdmin) && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-indigo-400 p-4 mb-4">
                  <div className="flex">
                    <div className="shrink-0">
                      <Sparkles className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-indigo-800 dark:text-indigo-200">
                        Feedback required to unlock new weekly matches. You still need to submit feedback for{" "}
                        <span className="font-semibold">{pendingFeedbackCount}</span> completed{" "}
                        {pendingFeedbackCount === 1 ? "date" : "dates"}.
                      </p>
                      <Button
                        variant="outline"
                        className="mt-3 border-indigo-300 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-600 dark:text-indigo-200 dark:hover:bg-indigo-900/40"
                        onClick={() => navigate("/dates")}
                      >
                        Open Dates
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {!canDate && !isAdmin && (
            <StudentEmailVerificationCard
              currentEmail={user?.email}
              onOpenProfile={() => navigate("/profile-setup")}
            />
          )}

          {(canDate || isAdmin) && (
          <div className="space-y-12">

            {/* Event Matches Section */}
            {isEnrolledInEvent && (
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white">Event Matches</h2>
                </div>
                {matches.filter(m => m.from_algorithm === 'event').length === 0 ? (
                  <Card className="p-8 text-center bg-purple-900/10 border-purple-500/20">
                    <p className="text-purple-200">Thanks for signing up! Matches are calculated each day, so be sure to check back tomorrow :)</p>
                  </Card>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {matches.filter(m => m.from_algorithm === 'event').map((match) => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        onViewProfile={handleViewProfile}
                        onLike={handleLike}
                        onDislike={handleDislike}
                        variant="event"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Weekly Matches Section */}
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Weekly Matches</h2>

              {!canSeeWeeklyMatches ? (
                <Card className="text-center p-12 shadow-xl border-border/50">
                  <Sparkles className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <CardTitle className="mb-2">Decision window is closed</CardTitle>
                  <CardDescription className="mb-6">
                    Weekly match cards are hidden once Monday ends. Your next set appears next Monday at 08:00 UTC.
                  </CardDescription>
                </Card>
              ) : weeklyMatches.length === 0 ? (
                <Card className="text-center p-12 shadow-xl border-border/50">
                  <Sparkles className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <CardTitle className="mb-2">No matches found yet</CardTitle>
                  <CardDescription className="mb-6">
                    New users are joining each week! We'll email you if we find a match :)
                  </CardDescription>
                  <div className="flex gap-3 justify-center">
                    <Button className="bg-linear-to-r from-backgrounda to-backgroundc" onClick={() => navigate("/questionnaire-intro")}>Update Compatibility Survey</Button>
                    <Button variant="outline" onClick={() => navigate("/profile-setup")}>
                      Edit Profile
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {weeklyMatches.map((match) => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        onViewProfile={handleViewProfile}
                        onLike={handleLike}
                        onDislike={handleDislike}
                        variant="default"
                        canRespond={isDecisionWindow || isAdmin || isTestUser}
                      />
                    ))}
                  </div>
              )}
            </div>

          </div>
          )}
        </div>

      </div >

      <ProfileViewDialog
        profile={selectedProfile}
        open={isProfileOpen}
        onOpenChange={setIsProfileOpen}
        matchType={selectedMatchType}
      />


      <DateCreatedDialog
        open={showDateDialog}
        onOpenChange={setShowDateDialog}
        matchedUser={newDateMatch}
        isCreatingDate={isCreatingDate}
      />

      <HowOrbiitWorksDialog
        open={showIntroDialog}
        onOpenChange={handleCloseIntroDialog}
      />
    </>
  );
};

export default Matches;
