import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Store, UtensilsCrossed, Coffee, Martini, Gamepad2 } from "lucide-react";

const PartnerVenues = () => {
  return (
    <div className="relative z-10 container mx-auto px-4 py-12 md:py-16 text-white">
        <section className="max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-4xl md:text-6xl font-bold leading-tight text-white [text-shadow:0_3px_16px_rgba(0,0,0,0.75)]">
          Become an Official Orbiit Partner Venue
          </h1>
          <p className="text-lg md:text-xl text-white/95 leading-relaxed [text-shadow:0_2px_10px_rgba(0,0,0,0.55)]">
          If you run a restaurant, cafe, bar, or activity venue, partner with Orbiit and become a recommended
          place for our users to connect in real life.
          </p>
          <Button
            size="lg"
            onClick={() => {
              window.location.href = "mailto:contact@yourorbiit.com?subject=Official%20Partner%20Venue%20Inquiry";
            }}
          >
            Contact Us to Partner
          </Button>
        </section>

        <section className="max-w-5xl mx-auto mt-12 md:mt-16 grid gap-5 md:grid-cols-2">
          <Card className="bg-black/30 border border-white/30 text-white backdrop-blur-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Store className="w-5 h-5" />
                Who This Is For
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-white/95">
              <p className="flex items-center gap-2"><UtensilsCrossed className="w-4 h-4" /> Restaurants</p>
              <p className="flex items-center gap-2"><Coffee className="w-4 h-4" /> Cafes</p>
              <p className="flex items-center gap-2"><Martini className="w-4 h-4" /> Bars</p>
              <p className="flex items-center gap-2"><Gamepad2 className="w-4 h-4" /> Activity spots</p>
            </CardContent>
          </Card>

          <Card className="bg-black/30 border border-white/30 text-white backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-white">Why Partner with Orbiit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-white/95">
              <p className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-1" /> Become an official destination for Orbiit dates and meetups.</p>
              <p className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-1" /> Get consistent visibility to a student audience.</p>
              <p className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-1" /> Build repeat traffic from high-intent social visits.</p>
            </CardContent>
          </Card>
        </section>
    </div>
  );
};

export default PartnerVenues;
