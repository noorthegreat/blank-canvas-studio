import React, { useEffect, useRef } from "react";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

const FAQItem = ({
    value,
    trigger,
    children,
    delay
}: {
    value: string;
    trigger: string;
    children: React.ReactNode;
    delay: string;
}) => (
    <AccordionItem
        value={value}
        className="border-white/10 faq-item opacity-0 translate-y-10 transition-all duration-700 ease-out"
        style={{ transitionDelay: delay }}
    >
        <AccordionTrigger className=" text-black  text-lg font-medium text-left ">
            {trigger}
        </AccordionTrigger>
        <AccordionContent className="text-black text-base leading-relaxed">
            {children}
        </AccordionContent>
    </AccordionItem>
);

const FAQSection = () => {
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

        const elements = document.querySelectorAll('.faq-item');
        elements.forEach((el) => observer.current?.observe(el));

        return () => observer.current?.disconnect();
    }, []);

    return (
        <section className="container mx-auto px-4 py-16 max-w-3xl">
            <h2 className="text-3xl md:text-5xl font-bold text-black text-center mb-12">
                FAQ
            </h2>

            <Accordion type="single" collapsible className="w-full space-y-4 ">
                <FAQItem value="item-1" trigger="How does Orbiit pair people?" delay="0ms">
                    <p className="mb-4">We match people using our compatibility survey, not swiping behavior.</p>
                    <p className="mb-4">Your answers help us understand communication style, social energy, emotional expectations, and how you prefer to spend time with someone. The goal is not just shared interests but natural interaction.</p>
                    <p>You are paired with someone you are likely to feel comfortable talking to in real life.</p>
                </FAQItem>

                <FAQItem value="item-2" trigger="How does Orbiit work?" delay="100ms">
                    <ol className="list-decimal list-inside space-y-2 pl-2">
                        <li>Sign up and complete the compatibility survey</li>
                        <li>You receive up to 5 weekly matches every Monday at 08:00 UTC</li>
                        <li>Decide on Monday whether to like or pass</li>
                        <li>You receive a date invitation with your match’s photo and details</li>
                        <li>You meet in person</li>
                    </ol>
                </FAQItem>

                <FAQItem value="item-3" trigger="What will I know about my match before the date?" delay="200ms">
                    <p className="mb-2">You will see:</p>
                    <ul className="list-disc list-inside space-y-1 pl-2 mb-4">
                        <li>their photo</li>
                        <li>basic info such as age and university</li>
                        <li>a short compatibility summary</li>
                    </ul>
                    <p>You get enough information to feel prepared without overanalyzing before meeting.</p>
                </FAQItem>

                <FAQItem value="item-4" trigger="What if I don’t like my match or the date?" delay="300ms">
                    <p className="mb-4">That is completely okay.</p>
                    <p className="mb-4">Not every meeting becomes romantic. Some become friendships and some are simply one conversation. After the date you give feedback and future matches improve from it.</p>
                    <p>No awkward unmatching needed.</p>
                </FAQItem>

                <FAQItem value="item-5" trigger="Who is participating?" delay="400ms">
                    <p className="mb-4">Currently only students from UZH and ETH.</p>
                    <p>People who join usually want to meet others in person instead of spending weeks chatting online.</p>
                </FAQItem>

                <FAQItem value="item-6" trigger="What if I can’t make it last minute?" delay="500ms">
                    <p className="mb-4">Just click the reschedule button in your date confirmation and pick a new time.</p>
                    <p>No need to message us.</p>
                </FAQItem>

                <FAQItem value="item-7" trigger="How long does it usually take to get a date?" delay="600ms">
                    <p className="mb-4">Usually one to two matching cycles.</p>
                    <p>We wait for a strong pairing instead of sending random matches quickly.</p>
                </FAQItem>

                <FAQItem value="item-8" trigger="Where do the dates happen?" delay="700ms">
                    <p>At locations around campus and trendy venues across Zurich city. Cafés, casual bars, and relaxed spots where conversation feels natural.</p>
                </FAQItem>

                <FAQItem value="item-9" trigger="Why we don’t believe in chatting" delay="800ms">
                    <p className="mb-4">Most connections fade in the talking stage.</p>
                    <p>Texting creates expectations and overthinking. Meeting quickly keeps things simple and honest. You understand someone far better in one conversation than in days of messages.</p>
                </FAQItem>

                <FAQItem value="item-10" trigger="Data Privacy and Account Deletion" delay="900ms">
                    <p className="mb-4">We only collect information necessary for matching and safety.</p>
                    <p>Your data is not sold or used for advertising profiling. You can delete your account at any time and your information will be permanently removed.</p>
                </FAQItem>
            </Accordion>
        </section>
    );
};

export default FAQSection;
