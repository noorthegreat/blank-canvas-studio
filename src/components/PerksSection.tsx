import React, { useEffect, useRef } from 'react';
import perkCampus from '../assets/perk_campus.png';
import perkSafe from '../assets/perk_safe.png';
import perkId from '../assets/perk_id.png';

const PerksSection = () => {
    const perks = [
        {
            icon: perkId,
            title: "Student Email Verified",
            description: "Users can only sign in with a verified university email address.",
            rotation: "rotate-2"
        },
        {
            icon: perkCampus,
            title: "Dates on Campus",
            description: "Locations are chosen on or nearby campus.",
            rotation: "rotate-1"
        },
        {
            icon: perkSafe,
            title: "Data Security",
            description: "Your data is never sold or shared with third parties.",
            rotation: "-rotate-2"
        },
    ];

    const observer = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        observer.current = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('opacity-100', 'translate-y-0');
                    entry.target.classList.remove('opacity-0', 'translate-y-10');
                    observer.current?.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        const elements = document.querySelectorAll('.perk-card');
        elements.forEach((el) => observer.current?.observe(el));

        return () => observer.current?.disconnect();
    }, []);

    return (
        <div className="relative z-10 w-full py-12 pb-24">
            <div className="container mx-auto px-4">
                {/* Adjusted header margin */}
                <h2 className="text-3xl md:text-5xl font-bold text-center text-white mb-12 text-shadow-lg">
                    Safety First
                </h2>

                {/* Reduced max-width and grid gap */}
                <div className="flex flex-col items-center gap-20">
                    {perks.map((perk, index) => (
                        <div
                            key={index}
                            className={`perk-card opacity-0 translate-y-10 transition-all duration-700 ease-out`}
                            style={{ transitionDelay: `${index * 200}ms` }}
                        >
                            <div
                                className={`max-w-70 group p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xs
                hover:bg-white/10 transition-all duration-300 hover:-translate-y-1 
                ${perk.rotation} hover:rotate-0`}
                            >
                                <div className="flex flex-col items-center text-center">
                                    {/* Replaced Icon with Value, scaled down container */}
                                    <div className="group-hover:scale-110 transition-transform duration-300 drop-shadow-md">
                                        <img src={perk.icon} alt={perk.title} className={`animate-bounce delay-${index * 100} w-24 h-24 object-contain`} />
                                    </div>

                                    {/* Reduced font sizes */}
                                    <h3 className="text-lg md:text-xl font-bold text-white mb-2">
                                        {perk.title}
                                    </h3>
                                    <p className="text-white/70 text-sm md:text-base leading-relaxed">
                                        {perk.description}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PerksSection;
