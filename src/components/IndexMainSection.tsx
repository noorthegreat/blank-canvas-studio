
import TimelineSection from "@/components/TimelineSection";
import Countdown from "@/components/Countdown";

import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const IndexMainSection = () => {
    const navigate = useNavigate();
    return (
        <div className="container mx-auto px-4 py-20 pb-0">
            <div className="text-center max-w-3xl mx-auto space-y-8">

                <div className="relative">
                    <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mt-[2em] text-shadow-lg/50 mb-16">Get a date every Monday</h1>
                    <p className="absolute right-0 md:translate-x-10 -translate-y-15 -rotate-15 text-3xl text-white leading-tight bg-black z-10">@ UZH & ETH</p>
                </div>
                <Countdown />

                <p className="text-xl text-white leading-relaxed text-shadow-lg/50">
                    We schedule the date. You show up.
                </p>

                <div className="flex flex-row gap-4 justify-center pt-8 mb-36">
                    <Button
                        size="lg"
                        variant="glass"
                        onClick={() => navigate("/auth", { state: { isSignIn: false } })}
                    >
                        Get Matched
                    </Button>
                </div>
            </div>

            <h2 className="animate-on-scroll opacity-0 translate-y-10 transition-all duration-700 ease-out text-3xl md:text-5xl font-bold text-white text-center mb-0 mt-8 text-shadow-lg/50">How it works</h2>
            <TimelineSection />
        </div>
    );
};

export default IndexMainSection;
