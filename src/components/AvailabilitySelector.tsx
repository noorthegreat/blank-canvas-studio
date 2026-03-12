import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface AvailabilitySelectorProps {
  availability: Record<string, number[]>;
  onChange: (availability: Record<string, number[]>) => void;
  readOnly?: boolean;
}

export function AvailabilitySelector({ availability, onChange, readOnly = false }: AvailabilitySelectorProps) {
  const [selectedDay, setSelectedDay] = useState<number>(0);

  const toggleHour = (day: number, hour: number) => {
    if (readOnly) return;
    
    const dayKey = day.toString();
    const currentHours = availability[dayKey] || [];
    const newHours = currentHours.includes(hour)
      ? currentHours.filter(h => h !== hour)
      : [...currentHours, hour].sort((a, b) => a - b);
    
    onChange({
      ...availability,
      [dayKey]: newHours,
    });
  };

  const isHourSelected = (day: number, hour: number) => {
    const dayKey = day.toString();
    return (availability[dayKey] || []).includes(hour);
  };

  const formatHour = (hour: number) => {
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}${period}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {readOnly ? "Their Availability" : "Your Availability"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          {DAYS.map((day, index) => (
            <Button
              key={day}
              variant={selectedDay === index ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedDay(index)}
              className="flex-1 min-w-[80px]"
            >
              {day.slice(0, 3)}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-6 gap-2">
          {HOURS.map((hour) => (
            <button
              key={hour}
              onClick={() => toggleHour(selectedDay, hour)}
              disabled={readOnly}
              className={cn(
                "p-2 text-xs rounded border transition-colors",
                isHourSelected(selectedDay, hour)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-accent border-border",
                readOnly && "cursor-default opacity-60"
              )}
            >
              {formatHour(hour)}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}