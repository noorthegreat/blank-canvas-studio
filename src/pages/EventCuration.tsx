import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Sparkles, Users, PartyPopper } from "lucide-react";

const EventCuration = () => {
  return (
    <div className="relative z-10 container mx-auto px-4 py-12 md:py-16 text-white">
        <section className="max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-4xl md:text-6xl font-bold leading-tight text-white [text-shadow:0_3px_16px_rgba(0,0,0,0.75)]">
          Compatibility-Powered Event Curation
          </h1>
          <p className="text-lg md:text-xl text-white/95 leading-relaxed [text-shadow:0_2px_10px_rgba(0,0,0,0.55)]">
          If you are hosting an event, running a party label, or organizing a social gathering, Orbiit can layer
          curated introductions on top of your event.
          </p>
          <Button
            size="lg"
            onClick={() => {
              window.location.href = "mailto:contact@yourorbiit.com?subject=Event%20Curation%20Inquiry";
            }}
          >
            Contact Us for Event Curation
          </Button>
        </section>

        <section className="max-w-5xl mx-auto mt-12 md:mt-16 grid gap-5 md:grid-cols-3">
          <Card className="bg-black/30 border border-white/30 text-white backdrop-blur-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-white">
                <Users className="w-5 h-5" />
                The Problem
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-white/95">
              <p>People stay in existing circles.</p>
              <p>Starting conversations feels awkward.</p>
              <p>Connections often remain surface-level.</p>
            </CardContent>
          </Card>

          <Card className="bg-black/30 border border-white/30 text-white backdrop-blur-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-white">
                <Sparkles className="w-5 h-5" />
                The Solution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-white/95">
              <p>Attendees opt in and take a short compatibility survey.</p>
              <p>They receive 1-3 curated matches before or during the event.</p>
              <p>Conversation starts with clear shared traits and intentions.</p>
            </CardContent>
          </Card>

          <Card className="bg-black/30 border border-white/30 text-white backdrop-blur-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-white">
                <PartyPopper className="w-5 h-5" />
                Formats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-white/95">
              <p>Event Matching Layer</p>
              <p>Curated Speed Dating</p>
              <p>Home Party Curation</p>
            </CardContent>
          </Card>
        </section>

        <section className="max-w-5xl mx-auto mt-12 md:mt-16 grid gap-5 md:grid-cols-2">
          <Card className="bg-black/30 border border-white/30 text-white backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-white">How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-white/95">
              <p className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-1" /> You share an Orbiit opt-in link with attendees.</p>
              <p className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-1" /> Attendees complete the survey.</p>
              <p className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-1" /> Orbiit delivers curated intros and optional mingle activation.</p>
            </CardContent>
          </Card>

          <Card className="bg-black/30 border border-white/30 text-white backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-white">Outcomes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-white/95">
              <p>Higher attendee engagement.</p>
              <p>More meaningful conversations.</p>
              <p>A differentiated event experience with stronger community outcomes.</p>
            </CardContent>
          </Card>
        </section>
    </div>
  );
};

export default EventCuration;
