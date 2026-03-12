import { Venue } from "@/components/AvailabilityPlanner";
import { cn } from "@/lib/utils";
import { Coffee, Martini } from "lucide-react";

interface VenueCardProps {
    venue: Venue;
    type?: "coffee" | "bar" | string;
    className?: string;
    onClick?: () => void;
}

export const VenueCard = ({ venue, type, className, onClick }: VenueCardProps) => {
    // Determine style based on type if provided, or try to infer from venue data if possible
    // For now, defaulting to purple/bar style if not "coffee"
    const isCoffee = type === "coffee" || venue.type === "coffee";

    return (
        <a
            href={venue.website}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
                "relative overflow-hidden rounded-xl border-2 border-dashed p-4 transition-all hover:scale-[1.02] cursor-pointer block",
                isCoffee
                    ? "bg-orange-50/50 border-orange-300/50 hover:bg-orange-50/80"
                    : "bg-purple-50/50 border-purple-300/50 hover:bg-purple-50/80",
                className
            )}
            onClick={onClick}
        >
            <div className="flex flex-rows justify-between">
                <div className="flex items-start gap-4">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border/50">
                        <img
                            src={venue.image}
                            alt={venue.name}
                            className="h-full w-full object-cover"
                        />
                    </div>
                    <div className="space-y-1">
                        <h4 className={cn(
                            "font-semibold leading-none tracking-tight",
                            isCoffee ? "text-orange-900" : "text-purple-900"
                        )}>
                            {venue.name}
                        </h4>
                        <div className="text-sm text-muted-foreground flex flex-col gap-1">
                            <span>{venue.address}</span>
                        </div>
                    </div>
                </div>
                {isCoffee ? <Coffee className="text-orange-400/20 w-16 h-16 shrink-0" /> : <Martini className="text-purple-400/20 w-16 h-16 shrink-0" />}
            </div>
        </a>
    );
};
