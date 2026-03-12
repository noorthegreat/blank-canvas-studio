import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Scissors, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Venue } from "@/components/AvailabilityPlanner";
import { useToast } from "@/hooks/use-toast";

import { useAdminVenues } from "@/hooks/admin/useAdminVenues";

export const AdminVenuesTab = () => {
    const { venues, refreshVenues: onVenuesChange, loading } = useAdminVenues();
    const { toast } = useToast();
    const [importQuery, setImportQuery] = useState("");
    const [isImporting, setIsImporting] = useState(false);
    // ... other hooks (if any) should be here

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading venues...</div>;
    }

    const handleImportVenue = async () => {
        if (!importQuery) return;

        setIsImporting(true);
        try {
            const { data, error } = await supabase.functions.invoke('add-venue-places', {
                body: { query: importQuery }
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);

            toast({
                title: "Success",
                description: "Venue added successfully",
            });

            setImportQuery("");
            onVenuesChange();
        } catch (error: any) {
            toast({
                title: "Error",
                description: "Failed to add venue: " + error.message,
                variant: "destructive",
            });
        } finally {
            setIsImporting(false);
        }
    };

    const handleDeleteVenue = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this venue?")) return;

        try {
            const { error } = await supabase.from('venues').delete().eq('id', id);
            if (error) throw error;

            toast({
                title: "Success",
                description: "Venue deleted successfully",
            });

            onVenuesChange();
        } catch (error: any) {
            toast({
                title: "Error",
                description: "Failed to delete venue: " + error.message,
                variant: "destructive",
            });
        }
    };

    const handleSplitVenue = async (venue: Venue) => {
        if (!window.confirm(`Split "${venue.name}" into separate Coffee and Bar venues? (Splits at 4PM)`)) return;

        const truncateHours = (hours: any, type: "coffee" | "bar") => {
            const newHours: any = {};
            Object.keys(hours).forEach(day => {
                const slot = hours[day];
                if (!slot) {
                    newHours[day] = null;
                    return;
                }

                if (type === "coffee") {
                    const newEnd = Math.min(slot.end, 32);
                    if (slot.start >= newEnd) {
                        newHours[day] = null;
                    } else {
                        newHours[day] = { start: slot.start, end: newEnd };
                    }
                } else {
                    const newStart = Math.max(slot.start, 34);
                    if (newStart >= slot.end) {
                        newHours[day] = null;
                    } else {
                        newHours[day] = { start: newStart, end: slot.end };
                    }
                }
            });
            return newHours;
        };

        const coffeeVenue = {
            ...venue,
            id: undefined,
            name: `${venue.name} (Coffee)`,
            type: "coffee",
            hours: truncateHours(venue.hours, "coffee"),
            created_at: new Date().toISOString()
        };

        const cleanVenue = (v: any) => {
            const { id, created_at, ...rest } = v;
            return { ...rest, created_at: new Date().toISOString() };
        };

        const barVenue = {
            ...venue,
            id: undefined,
            name: `${venue.name} (Bar)`,
            type: "bar",
            hours: truncateHours(venue.hours, "bar"),
            created_at: new Date().toISOString()
        };

        try {
            const { error: error1 } = await supabase.from('venues').insert(cleanVenue(coffeeVenue));
            if (error1) throw error1;

            const { error: error2 } = await supabase.from('venues').insert(cleanVenue(barVenue));
            if (error2) throw error2;

            toast({
                title: "Success",
                description: "Venue split successfully",
            });

            onVenuesChange();
        } catch (error: any) {
            toast({
                title: "Error",
                description: "Failed to split venue: " + error.message,
                variant: "destructive",
            });
        }
    };

    const handleTruncateAllVenues = async () => {
        if (!window.confirm("Are you sure you want to TRUNCATE hours for ALL venues? This cannot be undone.")) return;

        try {
            const updates = venues.map(venue => {
                if (!venue.hours) return null;

                const newHours: any = {};
                let hasChanges = false;
                const isCoffee = venue.type === 'coffee';
                const isBar = venue.type === 'bar';

                if (!isCoffee && !isBar) return null;

                Object.keys(venue.hours).forEach(day => {
                    const slot = venue.hours[day];
                    if (!slot) {
                        newHours[day] = null;
                        return;
                    }

                    if (isCoffee) {
                        const limit = 33;
                        if (slot.end > limit) {
                            const newEnd = limit;
                            if (slot.start >= newEnd) {
                                newHours[day] = null;
                            } else {
                                newHours[day] = { start: slot.start, end: newEnd };
                            }
                            hasChanges = true;
                        } else {
                            newHours[day] = slot;
                        }
                    } else if (isBar) {
                        const limit = 34;
                        if (slot.start < limit) {
                            const newStart = limit;
                            if (newStart >= slot.end) {
                                newHours[day] = null;
                            } else {
                                newHours[day] = { start: newStart, end: slot.end };
                            }
                            hasChanges = true;
                        } else {
                            newHours[day] = slot;
                        }
                    }
                });

                if (hasChanges) {
                    return {
                        id: venue.id,
                        hours: newHours
                    };
                }
                return null;
            }).filter(Boolean);

            if (updates.length === 0) {
                toast({
                    title: "No changes needed",
                    description: "All venues already meet the criteria.",
                });
                return;
            }

            // @ts-ignore
            await Promise.all(updates.map(update =>
                supabase.from('venues').update({ hours: update!.hours }).eq('id', update!.id)
            ));

            toast({
                title: "Success",
                description: `Updated hours for ${updates.length} venues.`,
            });

            onVenuesChange();
        } catch (error: any) {
            toast({
                title: "Error",
                description: "Failed to truncate venues: " + error.message,
                variant: "destructive",
            });
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Add New Venue</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4">
                        <input
                            type="text"
                            placeholder="Search for Venue (Name or Address)"
                            className="flex-1 px-3 py-2 border rounded-md"
                            value={importQuery}
                            onChange={(e) => setImportQuery(e.target.value)}
                        />
                        <Button
                            onClick={handleImportVenue}
                            disabled={isImporting || !importQuery}
                        >
                            {isImporting ? "Searching..." : "Search & Add"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Bulk Actions</CardTitle>
                </CardHeader>
                <CardContent>
                    <Button
                        variant="destructive"
                        onClick={handleTruncateAllVenues}
                        className="w-full"
                    >
                        <Scissors className="mr-2 h-4 w-4" />
                        Truncate All Hours (Coffee &lt; 4:30PM, Bar &gt; 5PM)
                    </Button>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {venues.map((venue) => (
                    <Card key={venue.id} className="overflow-hidden">
                        <div className="h-48 w-full relative">
                            <img
                                src={venue.image}
                                alt={venue.name}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded text-xs font-bold uppercase">
                                {venue.type}
                            </div>
                        </div>
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start gap-2">
                                <div className="flex-1 min-w-0">
                                    <CardTitle className="text-lg truncate">{venue.name}</CardTitle>
                                    <a href={venue.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate block">
                                        {venue.website}
                                    </a>
                                </div>
                                <div className="flex gap-1 -mt-1 -mr-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                                        onClick={() => handleSplitVenue(venue)}
                                        title="Split into Coffee/Bar"
                                    >
                                        <Scissors className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                        onClick={() => handleDeleteVenue(venue.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                            <p className="text-muted-foreground">{venue.address}</p>

                            {venue.latitude && venue.longitude && (
                                <div className="flex gap-2 text-xs font-mono bg-muted p-2 rounded">
                                    <div>Lat: {venue.latitude.toFixed(4)}</div>
                                    <div>Lng: {venue.longitude.toFixed(4)}</div>
                                </div>
                            )}

                            {venue.timezone && (
                                <div className="text-xs text-muted-foreground">
                                    Timezone: <span className="font-semibold">{venue.timezone}</span>
                                </div>
                            )}

                            <div className="pt-2 border-t mt-2">
                                <p className="font-semibold mb-1">Hours:</p>
                                <div className="grid grid-cols-2 gap-1 text-xs">
                                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => {
                                        const slots = venue.hours?.[i.toString()];
                                        if (!slots) return <div key={day}><span className="w-8 inline-block">{day}:</span> Closed</div>;

                                        const formatSlot = (slot: number) => {
                                            const totalMinutes = slot * 30;
                                            const h = Math.floor(totalMinutes / 60) % 24;
                                            const m = totalMinutes % 60;
                                            const ampm = h >= 12 ? 'PM' : 'AM';
                                            const h12 = h % 12 || 12;
                                            return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
                                        };

                                        return (
                                            <div key={day}>
                                                <span className="w-8 inline-block font-medium">{day}:</span> {formatSlot(slots.start)} - {formatSlot(slots.end)}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};
