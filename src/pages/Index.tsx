import React, { useEffect } from "react";
import Navigation from "@/components/Navigation";
import useSession from "@/hooks/use-session";
import Footer from "./Footer";
import CarouselSection from "@/components/CarouselSection";
import FAQSection from "@/components/FAQSection";
import PerksSection from "@/components/PerksSection";
import IndexMainSection from "@/components/IndexMainSection";
// assets
import NightSkyVideoMp4 from "@/assets/nightsky.mp4";
import NightSkyVideoWebM from "@/assets/nightsky.webm";
import ForegroundImage from "@/assets/index-foreground.webp";
import StarsImage from "@/assets/index-stars.webp";
import CloudsImage from "@/assets/index-clouds.webp";
import SkyImage from "@/assets/index-sky.webp";

const BackgroundWrapper = ({
  children,
  bgImage,
  firstOne,
  className = "",
  mask = "linear-gradient(to top, black, black 70%, transparent)"
}: {
  children: React.ReactNode,
  bgImage: string,
  firstOne?: boolean,
  className?: string,
  mask?: string
}) => {
  const toggle = true
  if (!toggle) {
    return <>{children}</>
  }
  return (
    <section className={`relative min-h-dvh w-full ${className}`} >

      <div className={`z-4 sticky -top-[30%] overflow-clip w-full ${firstOne ? "-mb-[120dvh] top-0 " : "-mb-[100dvh]"} min-h-[calc(100dvh+200px)] `} style={{
        maskImage: firstOne ? null : mask,
        WebkitMaskImage: firstOne ? null : mask
      }}>

        <div className="z-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/5 w-[300vmax] h-[300vmax]">
          <div className="w-full h-full grid grid-cols-2 grid-rows-2 animate-[spin_360s_linear_infinite]">
            <div
              className="w-full h-full bg-cover bg-center -scale-x-100 -scale-y-100"
              style={{ backgroundImage: `url(${bgImage})` }}
            />
            <div
              className="w-full h-full bg-cover bg-center -rotate-90 "
              style={{ backgroundImage: `url(${bgImage})` }}
            />
            <div
              className="w-full h-full bg-cover bg-center rotate-90 "
              style={{ backgroundImage: `url(${bgImage})` }}
            />
            <div
              className="w-full h-full bg-cover bg-center rotate-180  -scale-x-100 -scale-y-100"
              style={{ backgroundImage: `url(${bgImage})` }}
            />
          </div>
        </div>
      </div>


      {firstOne && <>
        <video
          autoPlay
          muted
          playsInline
          className="z-8 fixed top-1/2 left-1/2 w-full h-full object-cover -translate-x-1/2 -translate-y-1/2"
        >
          <source src={NightSkyVideoMp4} type='video/mp4; codecs="hvc1"' />
          <source src={NightSkyVideoWebM} type="video/webm" />
        </video>
        <div
          className="z-7 fixed inset-0 bg-cover bg-center bg-no-repeat min-h-dvh"
          style={{
            backgroundImage: `url(${ForegroundImage})`,
          }}
        />
      </>}
      <div className="z-10 relative h-full">
        {children}
      </div>
    </section>
  )
};

const Index = () => {
  const { session, sessionLoading } = useSession();


  const observer = React.useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observer.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("opacity-100", "translate-y-0");
          entry.target.classList.remove("opacity-0", "translate-y-10");
          observer.current?.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: "0px"
    });

    const elements = document.querySelectorAll(".animate-on-scroll");
    elements.forEach((el) => observer.current?.observe(el));

    return () => observer.current?.disconnect();
  }, []);

  return (
    <div className="absolute min-h-dvh bg-black">


      {/* Scrollable Content */}
      <Navigation />
      <BackgroundWrapper
        bgImage={StarsImage}
        // mask=""
        firstOne={true}
      >
        <IndexMainSection />
      </BackgroundWrapper>


      {/* Sections with separated fixed backgrounds */}
      <BackgroundWrapper
        bgImage={SkyImage}
      >
        <CarouselSection />
        <PerksSection />
      </BackgroundWrapper>

      <BackgroundWrapper
        bgImage={CloudsImage}
      >
        <FAQSection />
        <div className="h-[80dvh] flex items-center justify-center">
          from orbiit with ❤️
        </div>
        <div className="container mx-auto px-4">
          <Footer />
        </div>
      </BackgroundWrapper>
    </div>
  );
};

export default Index;
