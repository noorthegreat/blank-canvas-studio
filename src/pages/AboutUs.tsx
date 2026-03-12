import Navigation from "@/components/Navigation";
import { Link } from "react-router-dom";
import Noor from "@/assets/noor.avif";
import Shana from "@/assets/shana.avif";
import SPH from "@/assets/SPH_logo.avif";
import LinkedIn from "@/assets/LinkedIn.png";
import Footer from "./Footer";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import HowOrbiitWorksDialog from "@/components/HowOrbiitWorksDialog";

const AboutUs = () => {
  const [showIntroDialog, setShowIntroDialog] = useState(false);
  const teammates = [
    { name: "Noor Shaaban", photo: Noor, role: "Co-Founder", linkedIn: "https://www.linkedin.com/company/yourorbiit/" },
    { name: "Shana Stämpfli", photo: Shana, role: "Co-Founder", linkedIn: "https://www.linkedin.com/in/shana-s-61a492123/" },
  ]
  return (
    <div className="">
      <main className="container mx-auto px-4 py-8 max-w-dvw">

        <div className="flex flex-col items-center">

          <h1 className="text-4xl font-bold text-center text-white mb-8">About Us</h1>
          <p className="text-xl text-wrap text-muted text-center leading-relaxed">
            Orbiit is a modern matchmaking service designed to bridge the gap between impersonal dating apps and costly traditional matchmakers.
            <br /><br />
            We go beyond surface-level swipes with a compatibility survey that dives deep into personality, communication style, love languages, attachment type, lifestyle, and long-term goals.
            <br /><br />
            Using your responses, our algorithm curates thoughtful, high-quality matches. Once there’s mutual interest, Orbiit steps in to organize the first date, handling the details so you can focus on what really matters: connection and chemistry.
            Creating intentional, meaningful first encounters is at the heart of everything we do.

          </p>
          <div className="mt-8 flex justify-center">
            <Button
              onClick={() => setShowIntroDialog(true)}
              variant="outline"
              className="text-primary border-primary hover:bg-primary/10"
            >
              How Orbiit Works
            </Button>
          </div>


          <div className="md:ml-20 ">
            <h1 className="text-4xl font-bold text-center text-white mb-8 mt-12">Meet the Team</h1>
            <div className="flex flex-col md:flex-row gap-8 justify-center">

              {teammates.map((teammate) => {
                return (
                  <div className="bg-card p-8 rounded-3xl">
                    <img src={teammate.photo} alt="Noor" />
                    <div className="flex flex-row justify-between">
                      <div>
                        <h1 className="text-2xl font-bold">{teammate.name}</h1>
                        <h2 className="text-xl">{teammate.role}</h2>
                      </div>
                      <div>
                        <Link to={teammate.linkedIn}>
                          <img className="mt-2 w-10" src={LinkedIn} alt="LinkedIn" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );

              })}


            </div>
          </div>

          <div className="md:ml-20">
            <h1 className="text-4xl font-bold text-center text-white mb-8 mt-12">Our Collaborators</h1>
            <img src={SPH} alt="SPH" />
          </div>
        </div>

      </main>
      <HowOrbiitWorksDialog open={showIntroDialog} onOpenChange={setShowIntroDialog} />
    </div >
  );
};

export default AboutUs;
