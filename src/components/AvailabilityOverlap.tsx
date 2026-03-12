import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface AvailabilityOverlapProps {
  userAvailability: Record<string, number[]>;
  matchAvailability: Record<string, number[]>;
}

export function AvailabilityOverlap({ userAvailability, matchAvailability }: AvailabilityOverlapProps) {
  const getOverlappingTimes = () => {
    const overlaps: Record<string, number[]> = {};
    
    for (let day = 0; day < 7; day++) {
      const dayKey = day.toString();
      const userHours = userAvailability[dayKey] || [];
      const matchHours = matchAvailability[dayKey] || [];
      const overlap = userHours.filter(hour => matchHours.includes(hour));
      
      if (overlap.length > 0) {
        overlaps[dayKey] = overlap;
      }
    }
    
    return overlaps;
  };

  const formatTimeRanges = (hours: number[]) => {
    if (hours.length === 0) return "";
    
    const ranges: string[] = [];
    let start = hours[0];
    let end = hours[0];
    
    for (let i = 1; i <= hours.length; i++) {
      if (i < hours.length && hours[i] === end + 1) {
        end = hours[i];
      } else {
        ranges.push(formatRange(start, end));
        if (i < hours.length) {
          start = hours[i];
          end = hours[i];
        }
      }
    }
    
    return ranges.join(", ");
  };

  const formatRange = (start: number, end: number) => {
    const formatHour = (hour: number) => {
      const period = hour >= 12 ? "PM" : "AM";
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${displayHour}${period}`;
    };
    
    if (start === end) {
      return formatHour(start);
    }
    return `${formatHour(start)}-${formatHour(end + 1)}`;
  };

  const overlaps = getOverlappingTimes();
  const hasOverlap = Object.keys(overlaps).length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Overlapping Availability
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasOverlap ? (
          <p className="text-muted-foreground text-sm">
            No overlapping times yet. Both of you need to set your availability.
          </p>
        ) : (
          <div className="space-y-3">
            {Object.entries(overlaps).map(([day, hours]) => (
              <div key={day} className="flex items-start gap-3">
                <span className="font-medium text-sm min-w-[80px]">
                  {DAYS[parseInt(day)]}:
                </span>
                <span className="text-sm text-muted-foreground">
                  {formatTimeRanges(hours)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}