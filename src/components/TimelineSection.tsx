import React from 'react';
import { cn } from "@/lib/utils";

const TimelineSection = () => {
    const steps = [
        {
            number: "01",
            title: "Tell us your type",
            description: "Let us know what matters with our survey.",
            emoji: "📝"
        },
        {
            number: "02",
            title: "Let us know when",
            description: "No matter how busy your schedule is, we can find a time that works.",
            emoji: "🗓️"
        },
        {
            number: "03",
            title: "Start dating",
            description: "Once a week, we'll setup a date at a safe venue with someone you're compatible with. No texting required.",
            emoji: "🥂"
        }
    ];

    const observer = React.useRef<IntersectionObserver | null>(null);

    React.useEffect(() => {
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

        const elements = document.querySelectorAll('.timeline-card');
        elements.forEach((el) => observer.current?.observe(el));

        return () => observer.current?.disconnect();
    }, []);

    return (
        <div className="relative py-20 container mx-auto px-4 max-w-4xl">
            <div className="space-y-12 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-linear-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                {steps.map((step, index) => (
                    <div
                        key={index}
                        className="timeline-card relative flex items-center justify-between group is-active opacity-0 translate-y-10 transition-all duration-700 ease-out"
                        style={{ transitionDelay: `${index * 200}ms` }}
                    >

                        {/* Icon/Number */}
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white/20 bg-slate-900/50 shadow shrink-0 z-10 backdrop-blur-md">
                            <span className="text-white font-bold text-sm">{step.number}</span>
                        </div>

                        {/* Card */}
                        <div className="w-[calc(100%-4rem)] p-6 rounded-3xl glass-border shadow-xl hover:bg-white/10 transition-colors duration-300">
                            <div className="flex items-center justify-between space-x-2 mb-1">
                                <h3 className="font-bold text-white text-xl">{step.title}</h3>
                            </div>
                            <p className="text-slate-300 mb-4">{step.description}</p>
                            <div className="text-5xl text-center select-none pt-2">{step.emoji}</div>
                        </div>

                    </div>
                ))}
            </div>
        </div>
    );
};

export default TimelineSection;
