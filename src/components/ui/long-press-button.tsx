import React, { useState, useEffect, useRef } from "react";
import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LongPressButtonProps extends ButtonProps {
    onLongPress: () => void;
    duration?: number; // Duration in milliseconds, default 3000
    progressColor?: string;
}

export const LongPressButton = ({
    onLongPress,
    duration = 3000,
    className,
    progressColor = "bg-primary/40",
    children,
    ...props
}: LongPressButtonProps) => {
    const [isPressing, setIsPressing] = useState(false);
    const [progress, setProgress] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number | null>(null);

    const onLongPressRef = useRef(onLongPress);

    useEffect(() => {
        onLongPressRef.current = onLongPress;
    }, [onLongPress]);

    useEffect(() => {
        if (isPressing) {
            startTimeRef.current = Date.now();
            intervalRef.current = setInterval(() => {
                const elapsed = Date.now() - (startTimeRef.current || 0);
                const newProgress = Math.min((elapsed / duration) * 100, 100);
                setProgress(newProgress);

                if (newProgress >= 100) {
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    setIsPressing(false);
                    setProgress(0);
                    onLongPressRef.current();
                }
            }, 10);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setProgress(0);
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isPressing, duration]);

    const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (props.disabled) return;
        setIsPressing(true);
        props.onMouseDown?.(e);
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLButtonElement>) => {
        setIsPressing(false);
        props.onMouseUp?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
        setIsPressing(false);
        props.onMouseLeave?.(e);
    };

    const handleTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
        if (props.disabled) return;
        setIsPressing(true);
        props.onTouchStart?.(e);
    };

    const handleTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
        setIsPressing(false);
        props.onTouchEnd?.(e);
    };

    return (
        <div className="relative inline-block w-full">
            <Button
                className={cn("w-full relative overflow-hidden", className)}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                {...props}
            >
                {children}
                <div
                    className={cn("absolute left-0 top-0 h-full z-0", progressColor)}
                    style={{ width: `${progress}%` }}
                />
            </Button>
        </div>
    );
};
