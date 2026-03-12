import React from 'react';
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel";

import AutoScroll from "embla-carousel-auto-scroll";

import CarouselImg1 from "@/assets/car1.webp";
import CarouselImg2 from "@/assets/car2.webp";
import CarouselImg3 from "@/assets/car3.webp";
import CarouselImg4 from "@/assets/car4.webp";
import CarouselImg5 from "@/assets/car5.webp";

import OverlayImg1 from "@/assets/test4.png";
import OverlayImg2 from "@/assets/test5.png";
import OverlayImg3 from "@/assets/test1.png";
import OverlayImg4 from "@/assets/test3.png";
import OverlayImg5 from "@/assets/test2.png";

import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";

const CarouselSection = () => {

    // Deterministic rotation values to avoid hydration mismatch
    const getRotation = (index: number) => {
        const rotations = [-3, 2, -4, 1, 3, -2, 4, -1];
        return rotations[index % rotations.length];
    };
    const displayItems = [
        { src: CarouselImg1, overlaySrc: OverlayImg1, alt: "Image from an orbiit date!", initials: "S + D", matchPercentage: "98.5%" },
        { src: CarouselImg3, overlaySrc: OverlayImg3, alt: "Image from an orbiit date!", initials: "M + K", matchPercentage: "89.7%" },
        { src: CarouselImg2, overlaySrc: OverlayImg2, alt: "Image from an orbiit date!", initials: "J + B", matchPercentage: "92.3%" },
        { src: CarouselImg4, overlaySrc: OverlayImg4, alt: "Image from an orbiit date!", initials: "S + F", matchPercentage: "95.1%" },
        { src: CarouselImg5, overlaySrc: OverlayImg5, alt: "Image from an orbiit date!", initials: "N + E", matchPercentage: "91.4%" },
    ];

    return (
        <div className="relative w-full py-24 overflow-hidden">
            {/* Static Background */}


            <div className="relative z-10 w-full">
                <div className="container mx-auto px-4">
                    <h2 className="text-4xl md:text-5xl font-bold text-center text-white mb-16 text-shadow-lg">
                        Share Incredible Experiences
                    </h2>
                </div>

                <Carousel
                    opts={{
                        align: "center",
                        loop: true,
                        dragFree: true,
                    }}
                    plugins={[
                        WheelGesturesPlugin(),
                        AutoScroll({
                            speed: 1,
                            stopOnInteraction: true,
                            stopOnMouseEnter: false,
                        }),
                    ]}
                    className="w-full"
                >
                    <CarouselContent className="-ml-4">
                        {displayItems.map((item, index) => (
                            <CarouselItem key={index} className="pl-4 basis-[85%] md:basis-[45%] lg:basis-[30%]">
                                <div className="p-1">
                                    <div className="overflow-hidden rounded-3xl border border-white/20 aspect-3/4 group relative">
                                        <img
                                            src={item.src}
                                            alt={item.alt}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        />

                                        {/* Overlay Image */}
                                        <div className="absolute bottom-4 left-0 right-0 px-1 flex justify-center z-20 pointer-events-none">
                                            <img
                                                src={item.overlaySrc}
                                                alt={item.alt}
                                                style={{
                                                    transform: `rotate(${getRotation(index)}deg)`,
                                                }}
                                                className={`w-auto h-auto max-w-full object-contain drop-shadow-xl rounded `}
                                            />
                                        </div>

                                        {/* Top Left Initials */}
                                        <div className="absolute top-4 left-4 z-20">
                                            <span className="text-white text-xl text-shadow-lg/10">{item.initials}</span>
                                        </div>

                                        {/* Top Right Percentage */}
                                        <div className="absolute top-4 right-4 z-20">
                                            <span className="text-white text-xl text-shadow-lg/10">{item.matchPercentage}</span>
                                        </div>
                                    </div>
                                </div>
                            </CarouselItem>
                        ))}
                    </CarouselContent>

                </Carousel>
            </div>
        </div>
    );
};

export default CarouselSection;
