import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Sparkles } from "lucide-react";
import Navigation from "@/components/Navigation";
import DateView from "@/components/DateView";
import Footer from "./Footer";
import { canAccessDating } from "@/lib/dating-eligibility";
import StudentEmailVerificationCard from "@/components/StudentEmailVerificationCard";
import { syncProfileEmailFromAuth } from "@/lib/profile-email";

const Dates = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [canDate, setCanDate] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTestUser, setIsTestUser] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUserId(session.user.id);
      setUserEmail(session.user.email ?? null);
      void syncProfileEmailFromAuth(session.user.id, session.user.email);
      setCanDate(canAccessDating(session.user));

      const [{ data: hasAdminRole }, { data: hasTestRole }] = await Promise.all([
        supabase.rpc('has_role', {
          _user_id: session.user.id,
          _role: 'admin'
        }),
        supabase.rpc('has_role', {
          _user_id: session.user.id,
          _role: 'test'
        })
      ]);
      setIsAdmin(!!hasAdminRole);
      setIsTestUser(!!hasTestRole);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      void (async () => {
        setUserId(session.user.id);
        setUserEmail(session.user.email ?? null);
        await syncProfileEmailFromAuth(session.user.id, session.user.email);
        setCanDate(canAccessDating(session.user));

        const [{ data: hasAdminRole }, { data: hasTestRole }] = await Promise.all([
          supabase.rpc('has_role', {
            _user_id: session.user.id,
            _role: 'admin'
          }),
          supabase.rpc('has_role', {
            _user_id: session.user.id,
            _role: 'test'
          })
        ]);
        setIsAdmin(!!hasAdminRole);
        setIsTestUser(!!hasTestRole);
      })();
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (isLoading || !id) {
    return (
      <>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-4">
            <Sparkles className="w-12 h-12 mx-auto text-white animate-pulse" />
            <p className="text-white">Loading...</p>
          </div>
        </div>
      </>
    );
  }

  if (!canDate && !isAdmin && !isTestUser) {
    return (
      <div className="p-4 py-12">
        <div className="max-w-4xl mx-auto">
          <StudentEmailVerificationCard currentEmail={userEmail} />
        </div>
      </div>
    );
  }

  if (!userId) return null;

  return (
    <>
      <div className="">
        <div className="md:p-4 pr-8 pl-1 py-6">
          <div className="max-w-4xl mx-auto">
            <Button variant="ghost" className="text-white hover:text-white/80 hover:bg-white/10 mb-4 pl-0" onClick={() => navigate("/dates")}>
              <ArrowLeft className="w-4 h-4 ml-2" />
              Back to Dates
            </Button>

            <DateView dateId={id} viewerId={userId} />

          </div>
        </div>
      </div >
    </>
  );
};

export default Dates;
