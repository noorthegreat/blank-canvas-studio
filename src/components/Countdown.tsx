import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

const Countdown = () => {
    const [timeLeft, setTimeLeft] = useState<{
        days: number;
        hours: number;
        minutes: number;
        seconds: number;
    } | null>(null);
    const [targetDate, setTargetDate] = useState<Date | null>(null);
    const [totalUsers, setTotalUsers] = useState<number | null>(null);

    useEffect(() => {
        const fetchTotalUsers = async () => {
            const { data, error } = await supabase.rpc('get_total_users_joined');
            if (!error && data !== null) {
                setTotalUsers(data);
            }
        };
        fetchTotalUsers();
    }, []);

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date();

            // Find next Monday 08:00 UTC
            const target = new Date(now);
            const currentDay = now.getUTCDay(); // 0=Sun, 1=Mon, ... 6=Sat
            let daysToAdd = (1 - currentDay + 7) % 7;

            target.setUTCHours(8, 0, 0, 0);
            target.setUTCDate(target.getUTCDate() + daysToAdd);

            // If we're already past this Monday 08:00 UTC, move to next week.
            if (target <= now) {
                target.setUTCDate(target.getUTCDate() + 7);
            }

            setTargetDate(prev => {
                if (!prev || prev.getTime() !== target.getTime()) {
                    return target;
                }
                return prev;
            });

            const diff = target.getTime() - now.getTime();

            if (diff < 0) return null;

            return {
                days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
                seconds: Math.floor((diff % (1000 * 60)) / 1000)
            };
        };

        // Initial calculation
        setTimeLeft(calculateTimeLeft());

        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    if (!timeLeft) return null;

    return (
        <div className="flex flex-col items-center justify-center gap-2 mt-6 animate-in fade-in duration-700">
            <div className="flex gap-2 justify-center items-center">
                <span className="text-4xl md:text-5xl font-mono font-bold tracking-widest text-white drop-shadow-md tabular-nums">
                    {String(timeLeft.days).padStart(2, '0')}:
                    {String(timeLeft.hours).padStart(2, '0')}:
                    {String(timeLeft.minutes).padStart(2, '0')}:
                    {String(timeLeft.seconds).padStart(2, '0')}
                </span>
            </div>
            {targetDate && (
                <span className="text-sm md:text-base font-light tracking-wider text-white/80 uppercase">
                    Next weekly drop: {format(targetDate, "MMMM do, yyyy")} at 08:00 UTC
                </span>
            )}
            {totalUsers !== null && (
                <span className="text-xs md:text-sm font-light tracking-wider text-white/60 uppercase">
                    Total users joined: {totalUsers}
                </span>
            )}
        </div>
    );
};

export default Countdown;
