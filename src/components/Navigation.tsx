import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Heart, User, FileText, LogOut, Calendar, Menu, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import OrbiitLogo from "@/assets/OrbiitTextLogoWhite.svg";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useEffect, useState } from "react";
import useSession from "@/hooks/use-session";

interface NavigationProps {
  hideProfileItems?: boolean;
}

const Navigation = ({ hideProfileItems = false }: NavigationProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { session, sessionLoading } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminRole = async () => {
      if (session) {
        const { data: hasAdminRole } = await supabase.rpc('has_role', {
          _user_id: session.user.id,
          _role: 'admin'
        });
        setIsAdmin(!!hasAdminRole);
      }
    };
    checkAdminRole();
  }, [session]);

  if (!session) {
    hideProfileItems = true;
  }
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const navItems = [
    { profile_item: true, path: "/matches", label: "Matches", icon: Heart },
    { profile_item: true, path: "/dates", label: "Dates", icon: Calendar },
    { profile_item: true, path: "/questionnaire-intro", label: "Survey", icon: FileText },
    // { profile_item: true, path: "/event", label: "Event!", icon: Sparkles, special: true },
    { profile_item: true, path: "/profile", label: "Profile", icon: User },
    { profile_item: true, path: "/admin", label: "Admin", icon: Shield, admin_only: true },
    // { profile_item: false, path: "/ourstory", label: "Our Story", icon: BookOpenText },

  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed top-0 right-0 left-0 z-50 backdrop-blur-sm shadow-xs glass-border-bottom">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/">
            <img src={OrbiitLogo} alt="Orbiit" className="h-8" />
          </Link>

          {/* Desktop Navigation */}

          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              if (item.profile_item && hideProfileItems) {
                return;
              }
              if ((item as any).admin_only && !isAdmin) {
                return;
              }
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive(item.path)
                    ? "bg-white text-black"
                    : (item as any).special
                      ? "bg-linear-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90 ml-2"
                      : "text-white hover:bg-muted hover:text-foreground"
                    }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {item.label}
                </Link>
              );
            })}

          </div>
          {session ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="hidden md:flex text-white hover:text-foreground"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                size="default"
                variant="glass"
                onClick={() => navigate("/partner-venues")}
                className="flex text-xs md:text-sm px-2 md:px-4"
              >
                <span className="md:hidden">Venues</span>
                <span className="hidden md:inline">Partner Venues</span>
              </Button>
              <Button
                size="default"
                variant="glass"
                onClick={() => navigate("/event-curation")}
                className="flex text-xs md:text-sm px-2 md:px-4"
              >
                <span className="md:hidden">Events</span>
                <span className="hidden md:inline">Event Curation</span>
              </Button>
              <Button
                size="default"
                variant="glass"
                onClick={() => navigate("/auth", { state: { isSignIn: false } })}
                className="flex text-xs md:text-sm px-2 md:px-4"
              >
                Get Matched
              </Button>
            </div>
          )}

          {/* Mobile Navigation */}

          {session && (
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden [&_svg]:size-7">
                  <Menu className="h-10 w-10" color="white" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64 bg-[#17064a]/98 border-[#3a2a9c]/35 text-white backdrop-blur-xl">
                <div className="flex flex-col space-y-4 mt-8">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    if (item.profile_item && hideProfileItems) {
                      return;
                    }
                    if ((item as any).admin_only && !isAdmin) {
                      return;
                    }
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setOpen(false)}
                        className={`flex items-center px-4 py-3 rounded-md text-sm font-medium transition-colors ${isActive(item.path)
                          ? "bg-[#3a2a9c]/45 text-white"
                          : "text-white/80 hover:bg-[#3a2a9c]/30 hover:text-white"
                          }`}
                      >
                        <Icon className="w-4 h-4 mr-3" />
                        {item.label}
                      </Link>
                    );
                  })}
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setOpen(false);
                      handleSignOut();
                    }}
                    className="justify-start px-4 text-white/80 hover:bg-[#3a2a9c]/30 hover:text-white"
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    Sign Out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          )}


        </div>
      </div>
    </nav>
  );
};

export default Navigation;
