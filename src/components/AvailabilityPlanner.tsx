import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RotateCcw, Save, Coffee, Martini } from "lucide-react";
import { format, addDays, parseISO } from "date-fns";
import { useBlocker } from "react-router-dom";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { VenueCard } from "@/components/VenueCard";

export type Availability = Record<string, number[]>; // day index (0-6) -> slot indices (0-47)

export interface Venue {
    id: string;
    name: string;
    address: string;
    website: string;
    type: string;
    hours: Record<string, { start: number; end: number } | null>;
    image: string;
    latitude?: number | null;
    longitude?: number | null;
    timezone?: string | null;
};

interface AvailabilityPlannerProps {
    initialAvailability?: Availability;
    matchedUserAvailability?: Availability;
    onSave: (availability: Availability, overlap: { startDay: number; startSlot: number; endSlot: number; venue: "coffee" | "bar" } | null) => void;
    isLoading?: boolean;
    venues: Record<string, Venue>;
    readOnly?: boolean;
    firstPossibleDay?: string | null;
}

const START_HOUR = 7;
const END_HOUR = 23;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const SLOTS_PER_HOUR = 2;
const VISIBLE_SLOTS_COUNT = HOURS.length * SLOTS_PER_HOUR;

type GridCell = { day: number; slot: number };

const DEFAULT_AVAILABILITY: Availability = {};

export type Overlap = { startDay: number; startSlot: number; endSlot: number; venue: "coffee" | "bar" };

export const calculateLargestOverlap = (userAvail: Availability, matchedAvail: Availability, venues: Record<string, Venue>): Overlap | null => {
    let maxOverlap = 0;
    let bestOverlap: Overlap | null = null;

    for (let d = 0; d < 7; d++) {
        const dayStr = d.toString();
        const userSlots = userAvail[dayStr] || [];
        const matchedSlots = matchedAvail[dayStr] || [];

        // Find common slots
        const commonSlots = userSlots.filter(slot => matchedSlots.includes(slot)).sort((a, b) => a - b);

        if (commonSlots.length === 0) continue;

        // Find contiguous blocks
        let currentBlockStart = commonSlots[0];
        let currentBlockEnd = commonSlots[0];

        for (let i = 1; i <= commonSlots.length; i++) {
            const slot = commonSlots[i];

            if (slot === currentBlockEnd + 1) {
                currentBlockEnd = slot;
            } else {
                // End of a block, check its length and validity
                const length = currentBlockEnd - currentBlockStart + 1;

                let validVenue: "coffee" | "bar" | null = null;

                // Check Coffee
                const coffeeHours = venues.coffee?.hours?.[dayStr];
                if (coffeeHours && currentBlockStart >= coffeeHours.start && currentBlockEnd < coffeeHours.end) {
                    validVenue = "coffee";
                }

                // Check Bar
                const barHours = venues.bar?.hours?.[dayStr];
                if (barHours && currentBlockStart >= barHours.start && currentBlockEnd < barHours.end) {
                    validVenue = "bar";
                }

                if (validVenue && length > maxOverlap) {
                    maxOverlap = length;
                    bestOverlap = {
                        startDay: d,
                        startSlot: currentBlockStart,
                        endSlot: currentBlockEnd,
                        venue: validVenue
                    };
                }

                // Start new block
                if (i < commonSlots.length) {
                    currentBlockStart = slot;
                    currentBlockEnd = slot;
                }
            }
        }
    }
    return bestOverlap;
};

export interface AvailabilityPlannerHandle {
    reset: () => void;
}

export const AvailabilityPlanner = forwardRef<AvailabilityPlannerHandle, AvailabilityPlannerProps>(({
    initialAvailability = DEFAULT_AVAILABILITY,
    matchedUserAvailability = DEFAULT_AVAILABILITY,
    onSave,
    isLoading = false,
    venues,
    readOnly = false,
    firstPossibleDay
}: AvailabilityPlannerProps, ref) => {
    const [availability, setAvailability] = useState<Availability>(initialAvailability);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<GridCell | null>(null);
    const [dragCurrent, setDragCurrent] = useState<GridCell | null>(null);
    const [isSelecting, setIsSelecting] = useState(true); // true = selecting, false = deselecting
    const [isDirty, setIsDirty] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setAvailability(initialAvailability);
        setIsDirty(false);
    }, [initialAvailability]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    // Calculate dates for columns
    const startDate = firstPossibleDay ? parseISO(firstPossibleDay) : new Date();
    const weekDates = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));

    // Handle React Router Navigation Blocking
    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            isDirty &&
            !readOnly &&
            currentLocation.pathname !== nextLocation.pathname
    );

    // Map visual column index (0-6) to actual day of week index (0-6, Sun-Sat)
    const getDayOfWeekIndex = (columnIndex: number) => {
        return weekDates[columnIndex].getDay();
    };

    const getVenueStatus = (day: number, slot: number) => {
        // Check Coffee
        const coffeeHours = venues.coffee?.hours?.[day.toString()];
        if (coffeeHours && slot >= coffeeHours.start && slot < coffeeHours.end) {
            return "coffee";
        }

        // Check Bar
        const barHours = venues.bar?.hours?.[day.toString()];
        if (barHours && slot >= barHours.start && slot < barHours.end) {
            return "bar";
        }

        return "closed";
    };

    const handleMouseDown = (colIndex: number, slotIndex: number) => {
        if (readOnly) return;
        const dayIndex = getDayOfWeekIndex(colIndex);
        if (getVenueStatus(dayIndex, slotIndex) === "closed") return;

        setIsDragging(true);
        setDragStart({ day: colIndex, slot: slotIndex });
        setDragCurrent({ day: colIndex, slot: slotIndex });

        const currentDaySlots = availability[dayIndex.toString()] || [];
        const isSelected = currentDaySlots.includes(slotIndex);

        // If clicking on a selected slot, we start removing. Otherwise adding.
        setIsSelecting(!isSelected);
    };

    const handleMouseEnter = (colIndex: number, slotIndex: number) => {
        if (isDragging) {
            setDragCurrent({ day: colIndex, slot: slotIndex });
        }
    };

    const handleTouchMove = (e: React.PointerEvent) => {
        if (!isDragging) return;
        const element = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
        if (element) {
            const col = element.getAttribute('data-col');
            const slot = element.getAttribute('data-slot');
            if (col != null && slot != null) {
                handleMouseEnter(parseInt(col, 10), parseInt(slot, 10));
            }
        }
    };

    const handleMouseUp = () => {
        if (isDragging && dragStart && dragCurrent) {
            applySelection(dragStart, dragCurrent);
        }
        setIsDragging(false);
        setDragStart(null);
        setDragCurrent(null);
    };

    const applySelection = (start: GridCell, end: GridCell) => {
        const minCol = Math.min(start.day, end.day);
        const maxCol = Math.max(start.day, end.day);
        const minSlot = Math.min(start.slot, end.slot);
        const maxSlot = Math.max(start.slot, end.slot);

        setAvailability((prev) => {
            const next = { ...prev };
            setIsDirty(true);

            for (let col = minCol; col <= maxCol; col++) {
                const dayIndex = getDayOfWeekIndex(col);
                const dayStr = dayIndex.toString();
                const currentSlots = new Set(next[dayStr] || []);

                for (let slot = minSlot; slot <= maxSlot; slot++) {
                    if (getVenueStatus(dayIndex, slot) !== "closed") {
                        if (isSelecting) {
                            currentSlots.add(slot);
                        } else {
                            currentSlots.delete(slot);
                        }
                    }
                }
                next[dayStr] = Array.from(currentSlots).sort((a, b) => a - b);
            }
            return next;
        });
    };

    // Global mouse up handler to catch releases outside the grid
    useEffect(() => {
        const handleGlobalMouseUp = () => {
            if (isDragging && dragStart && dragCurrent) {
                applySelection(dragStart, dragCurrent);
            }
            setIsDragging(false);
            setDragStart(null);
            setDragCurrent(null);
        };
        window.addEventListener("mouseup", handleGlobalMouseUp);
        return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
    }, [isDragging, dragStart, dragCurrent, isSelecting]);

    const isCellInSelection = (colIndex: number, slotIndex: number) => {
        if (!isDragging || !dragStart || !dragCurrent) return false;

        const minCol = Math.min(dragStart.day, dragCurrent.day);
        const maxCol = Math.max(dragStart.day, dragCurrent.day);
        const minSlot = Math.min(dragStart.slot, dragCurrent.slot);
        const maxSlot = Math.max(dragStart.slot, dragCurrent.slot);

        return (
            colIndex >= minCol &&
            colIndex <= maxCol &&
            slotIndex >= minSlot &&
            slotIndex <= maxSlot
        );
    };

    const handleReset = () => {
        setAvailability(initialAvailability);
        setIsDirty(false);
    };

    useImperativeHandle(ref, () => ({
        reset: handleReset
    }));

    const handleSave = () => {
        const overlap = calculateLargestOverlap(availability, matchedUserAvailability, venues);
        onSave(availability, overlap);
    };

    const toRelativeSlot = (slot: number) => {
        const startSlot = START_HOUR * SLOTS_PER_HOUR;
        const endSlot = (END_HOUR + 1) * SLOTS_PER_HOUR; // End of the last visible hour
        if (slot < startSlot) return 0;
        if (slot >= endSlot) return VISIBLE_SLOTS_COUNT; // Use >= for slots that extend past the end
        return slot - startSlot;
    };

    const formatTime = (hour: number) => {
        return `${hour}:00`;
        const period = hour >= 12 ? "PM" : "AM";
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return `${displayHour}:00 ${period}`;
    };

    const renderVenueOverlay = (type: "coffee" | "bar") => {
        const config = venues[type]?.hours;
        if (!config) return null;

        // Find contiguous ranges of open columns
        const ranges: { start: number; end: number }[] = [];
        let currentRange: { start: number; end: number } | null = null;

        for (let i = 0; i < 7; i++) {
            const dayIndex = getDayOfWeekIndex(i);
            const dayConfig = config[dayIndex.toString()];

            if (dayConfig) {
                if (!currentRange) currentRange = { start: i, end: i };
                else currentRange.end = i;
            } else {
                if (currentRange) {
                    ranges.push(currentRange);
                    currentRange = null;
                }
            }
        }
        if (currentRange) ranges.push(currentRange);

        return ranges.map((range, i) => {
            let path = "";

            // Top edge (Left to Right)
            for (let c = range.start; c <= range.end; c++) {
                const dayIndex = getDayOfWeekIndex(c);
                const dayConfig = config[dayIndex.toString()];
                if (!dayConfig) continue;
                const y = toRelativeSlot(dayConfig.start);
                if (c === range.start) path += `M ${c} ${y} `;
                else path += `L ${c} ${y} `;
                path += `L ${c + 1} ${y} `;
            }

            // Bottom edge (Right to Left)
            for (let c = range.end; c >= range.start; c--) {
                const dayIndex = getDayOfWeekIndex(c);
                const dayConfig = config[dayIndex.toString()];
                if (!dayConfig) continue;
                const y = toRelativeSlot(dayConfig.end);
                path += `L ${c + 1} ${y} `;
                path += `L ${c} ${y} `;
            }

            path += "Z";

            return (
                <path
                    key={`${type}-${i}`}
                    d={path}
                    fill={type === "coffee" ? "rgba(255, 237, 213, 0.4)" : "rgba(233, 213, 255, 0.4)"}
                    stroke={type === "coffee" ? "rgba(253, 186, 116, 0.8)" : "rgba(216, 180, 254, 0.8)"}
                    strokeWidth="2"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                // strokeDasharray={"10 10"}
                />
            );
        });
    };

    const renderVenueIcons = (type: "coffee" | "bar") => {
        const config = venues[type]?.hours;
        if (!config) return null;
        const Icon = type === "coffee" ? Coffee : Martini;

        // Find contiguous ranges of open columns
        const ranges: { start: number; end: number }[] = [];
        let currentRange: { start: number; end: number } | null = null;

        for (let i = 0; i < 7; i++) {
            const dayIndex = getDayOfWeekIndex(i);
            const dayConfig = config[dayIndex.toString()];

            if (dayConfig) {
                if (!currentRange) currentRange = { start: i, end: i };
                else currentRange.end = i;
            } else {
                if (currentRange) {
                    ranges.push(currentRange);
                    currentRange = null;
                }
            }
        }
        if (currentRange) ranges.push(currentRange);

        return ranges.map((range, i) => {
            // Calculate bounding box for the icon
            let minY = Infinity, maxY = -Infinity;
            for (let c = range.start; c <= range.end; c++) {
                const dayIndex = getDayOfWeekIndex(c);
                const dayConfig = config[dayIndex.toString()];
                if (dayConfig) {
                    minY = Math.min(minY, toRelativeSlot(dayConfig.start));
                    maxY = Math.max(maxY, toRelativeSlot(dayConfig.end));
                }
            }

            const left = (range.start / 7) * 100;
            const width = ((range.end - range.start + 1) / 7) * 100;
            const top = (minY / VISIBLE_SLOTS_COUNT) * 100;
            const height = ((maxY - minY) / VISIBLE_SLOTS_COUNT) * 100;

            return (
                <div
                    key={`${type}-icon-${i}`}
                    className="absolute flex items-center justify-center pointer-events-none"
                    style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        top: `${top}%`,
                        height: `${height}%`
                    }}
                >
                    <Icon className={cn(
                        "w-24 h-24 opacity-50",
                        type === "coffee" ? "text-orange-400" : "text-purple-400"
                    )} />
                </div>
            );
        });
    };

    return (
        <div className="space-y-4 select-none mt-4">
            <div className="px-1 flex flex-wrap gap-2 text-sm text-muted-foreground justify-center">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-500/80 rounded"></div>
                    <span>Yours</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-400/50 rounded"></div>
                    <span>Match's</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-teal-500/90 rounded"></div>
                    <span>Both</span>
                </div>
                {venues.coffee && Object.keys(venues.coffee).length > 0 && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <div className="flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-80">
                                <div className="w-4 h-4 border-2 border-dashed border-orange-400 bg-orange-100/40 rounded"></div>
                                <span className="underline decoration-dashed underline-offset-4">Cafe</span>
                            </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0 border-0 shadow-lg" side="top" sideOffset={10}>
                            <VenueCard venue={venues.coffee} type="coffee" />
                        </PopoverContent>
                    </Popover>
                )}
                {venues.bar && Object.keys(venues.bar).length > 0 && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <div className="flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-80">
                                <div className="w-4 h-4 border-2 border-dashed border-purple-400 bg-purple-100/40 rounded"></div>
                                <span className="underline decoration-dashed underline-offset-4">Bar</span>
                            </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0 border-0 shadow-lg" side="top" sideOffset={10}>
                            <VenueCard venue={venues.bar} type="bar" />
                        </PopoverContent>
                    </Popover>
                )}
            </div>
            <div className="flex">
                {/* Time Labels Column - Outside */}
                <div className="flex flex-col pt-[67px] md:pr-2">
                    {HOURS.map((hour) => (
                        <div key={hour} className="h-12 relative">
                            <span className="absolute md:-top-2 md:-right-12 -top-3 -right-9 text-xs  whitespace-nowrap">
                                {formatTime(hour)}
                            </span>
                        </div>
                    ))}
                </div>

                <div
                    className="flex-1 max-w-2xl md:ml-12 border rounded-lg overflow-hidden bg-white"
                    ref={containerRef}
                >
                    {/* Header */}
                    <div className="flex border-b border-border/50">
                        <div className="flex-1 grid grid-cols-7">
                            {weekDates.map((date, i) => (
                                <div key={i} className={`py-2 text-center border-r border-border/50 last:border-r-0  ${i % 2 === 1 ? " bg-black/3 " : " bg-white"}`}>
                                    <div className="text-sm font-bold text-muted-foreground whitespace-pre-line">
                                        {format(date, "EEE")}
                                    </div>
                                    <div className="text-xs font-medium text-muted-foreground whitespace-pre-line">
                                        {format(date, "MMM d")}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                        <div className="flex relative min-h-[600px]">
                            {/* Columns */}
                            <div
                                className="flex-1 grid grid-cols-7 relative touch-none"
                                onPointerMove={handleTouchMove}
                            >
                                {/* Background Grid Lines */}
                                <div className="absolute inset-0 grid grid-rows-[repeat(17,3rem)] pointer-events-none0">
                                    {HOURS.map((_, i) => (
                                        <div key={i} className="border border-border/50 w-full" />
                                    ))}
                                </div>

                                {/* Venue Overlay (Background Shapes) */}
                                <div className="absolute inset-0 pointer-events-none z-0">
                                    <svg
                                        width="100%"
                                        height="100%"
                                        viewBox={`0 0 7 ${VISIBLE_SLOTS_COUNT}`}
                                        preserveAspectRatio="none"
                                    >
                                        {renderVenueOverlay("coffee")}
                                        {renderVenueOverlay("bar")}
                                    </svg>
                                </div>

                                {/* Venue Icons (HTML Overlay) */}
                                <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
                                    {renderVenueIcons("coffee")}
                                    {renderVenueIcons("bar")}
                                </div>

                                {weekDates.map((_, colIndex) => {
                                    const dayIndex = getDayOfWeekIndex(colIndex);
                                    const dayStr = dayIndex.toString();
                                    const userSlots = availability[dayStr] || [];
                                    const matchedSlots = matchedUserAvailability?.[dayStr] || [];

                                    return (
                                        <div key={colIndex} className={`relative border-r border-border/50 last:border-r-0 z-10 ${colIndex % 2 === 1 ? " bg-black/3 " : " "}`}>
                                            {/* Slots */}
                                            {Array.from({ length: VISIBLE_SLOTS_COUNT }).map((_, i) => {
                                                const slotIndex = i + (START_HOUR * SLOTS_PER_HOUR);
                                                const isSelected = userSlots.includes(slotIndex);
                                                const isMatched = matchedSlots.includes(slotIndex);
                                                const isDragSelected = isCellInSelection(colIndex, slotIndex);
                                                const venueStatus = getVenueStatus(dayIndex, slotIndex);

                                                // Determine visual state
                                                let visualSelected = isSelected;
                                                if (isDragSelected && venueStatus !== "closed") {
                                                    visualSelected = isSelecting;
                                                }

                                                return (
                                                    <div
                                                        key={slotIndex}
                                                        data-col={colIndex}
                                                        data-slot={slotIndex}
                                                        onPointerDown={() => handleMouseDown(colIndex, slotIndex)}
                                                        onPointerUp={handleMouseUp}
                                                        className={cn(
                                                            "h-6 border-none cursor-pointer",
                                                            venueStatus === "closed" ? "cursor-not-allowed" : "cursor-pointer hover:bg-primary/10",
                                                            visualSelected && !isMatched && "bg-green-500/50 hover:bg-green-600/50",
                                                            !visualSelected && isMatched && "bg-blue-300/50",
                                                            visualSelected && isMatched && "bg-teal-500/90 hover:bg-teal-600/90"
                                                        )}
                                                    />
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <p className="bg-white flex justify-end text-sm text-muted-foreground mt-0 mr-5">Timezone - {venues.coffee.timezone ?? "Unknown"}</p>
                </div>
            </div>
            <div className="flex justify-start gap-2 px-6">
                <Button variant="outline" size="sm" onClick={handleReset} disabled={isLoading || !isDirty || readOnly}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isLoading || !isDirty || readOnly}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                </Button>
            </div>

            {/* Unsaved Changes Confirmation Dialog for React Router Navigation */}
            <AlertDialog
                open={blocker.state === "blocked"}
                onOpenChange={(open) => {
                    if (!open && blocker.state === "blocked") {
                        blocker.reset();
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>You have unsaved changes</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to leave this page? Your availability changes will be lost.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => blocker.state === "blocked" && blocker.reset()}>
                            Stay
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => blocker.state === "blocked" && blocker.proceed()}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Leave
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
});

AvailabilityPlanner.displayName = "AvailabilityPlanner";
