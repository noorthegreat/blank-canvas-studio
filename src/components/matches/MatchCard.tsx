import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, X } from "lucide-react";

export interface MatchProfile {
    id: string;
    first_name: string;
    last_name: string;
    bio: string | null;
    age: number | null;
    latitude: number | null;
    longitude: number | null;
    additional_photos?: string[] | null;
}

export interface Match {
    id: string;
    compatibility_score: number;
    matched_user: MatchProfile;
    isLikedByMe: boolean;
    isLikedByThem: boolean;
    match_type: 'relationship' | 'friendship';
    from_algorithm?: 'relationship' | 'friendship' | 'event' | 'legacy_algorithm';
}

interface MatchCardProps {
    match: Match;
    onViewProfile: (id: string, matchType: 'relationship' | 'friendship') => void;
    onLike: (match: Match, event: React.MouseEvent) => void;
    onDislike: (matchId: string, matchedUserId: string, event: React.MouseEvent) => void;
    variant?: 'default' | 'event';
    canRespond?: boolean;
}

const MatchCard = ({ match, onViewProfile, onLike, onDislike, variant = 'default', canRespond = true }: MatchCardProps) => {
    const isEvent = variant === 'event';
    const backgroundImage = match.matched_user.additional_photos?.[0];

    const cardClasses = isEvent
        ? "bg-transparent border-purple-500/50 border h-144 shadow-purple-500/20 shadow-lg hover:shadow-lg hover:shadow-purple-500/50 transition-shadow relative overflow-hidden"
        : "bg-transparent border-none h-144 shadow-white/15 shadow-lg hover:shadow-lg hover:shadow-white/50 transition-shadow relative overflow-hidden";

    const vignetteClasses = isEvent
        ? "rounded-lg hover:border-purple-400 hover:border-2 absolute inset-0 bg-linear-to-b from-purple-900/50 via-background/0 to-purple-900/50 mix-blend-multiply"
        : "rounded-lg hover:border-white hover:border-2 absolute inset-0 bg-linear-to-b from-background/50 via-background/0 to-background/50";

    const titleClasses = isEvent ? "text-xl mb-1 text-white" : "text-xl mb-1";
    const ageClasses = isEvent ? "text-sm text-purple-200" : "text-sm text-muted-foreground";
    const bioClasses = isEvent ? "text-sm leading-relaxed line-clamp-3 text-white/90" : "text-sm leading-relaxed line-clamp-3";
    const likeBtnClasses = isEvent ? "flex-1 bg-green-300 hover:bg-green-400 border-none" : "flex-1 bg-green-300";
    const dislikeBtnClasses = isEvent ? "bg-red-400 hover:bg-red-500 flex-1 z-20" : "bg-red-400 flex-1 z-20";

    return (
        <Card
            className={cardClasses}
            onClick={() => onViewProfile(match.matched_user.id, match.match_type)}
            style={backgroundImage ? {
                backgroundImage: `url(${backgroundImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            } : undefined}
        >
            {backgroundImage ? (
                <div className={vignetteClasses} />
            ) : (
                <div className="rounded-lg absolute inset-0 bg-white" />
            )}

            <div className="relative z-10 h-full flex flex-col justify-between">
                <CardHeader>
                    <div className="flex justify-between">
                        <div className="flex flex-col">
                            <CardTitle className={titleClasses}>{match.matched_user.first_name}</CardTitle>
                            {match.matched_user.age && (
                                <p className={ageClasses}>{match.matched_user.age} years old</p>
                            )}
                            {match.match_type === 'friendship' && (
                                <span className="text-xs bg-blue-500/80 text-white px-2 py-0.5 rounded-full mt-1 w-fit">
                                    Friendship Match!
                                </span>
                            )}
                        </div>
                        <div className="flex flex-col items-end">
                            {match.isLikedByThem && !isEvent && (
                                <div className="w-24 bg-linear-to-r from-violet-500 to-indigo-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                                    Likes you!
                                </div>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {match.matched_user.bio && (
                        <p className={bioClasses}>{match.matched_user.bio}</p>
                    )}

                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            className={likeBtnClasses}
                            onClick={(event) => onLike(match, event)}
                            disabled={match.isLikedByMe || !canRespond}
                        >
                            {match.match_type === 'friendship' ? (
                                <span className="mr-2 text-lg">👋</span>
                            ) : (
                                <Heart className={`w-4 h-4 mr-2 ${match.isLikedByMe ? "fill-violet-500 text-violet-500" : ""}`} />
                            )}
                            {match.match_type === 'friendship' ? "Friends!" : "Match"}
                        </Button>
                        <Button
                            variant="destructive"
                            className={dislikeBtnClasses}
                            onClick={(event) => onDislike(match.id, match.matched_user.id, event)}
                            disabled={!canRespond}
                        >
                            <X className="w-4 h-4 mr-2" />
                            Pass
                        </Button>
                    </div>
                </CardContent>
            </div>
        </Card>
    );
};

export default MatchCard;
