import { useState, useRef } from "react";
import { GripVertical } from "lucide-react";
import { Card } from "@/components/ui/card";

type Activity = "coffee" | "food" | "bar";

const ACTIVITIES: { id: Activity; label: string; emoji: string }[] = [
  { id: "coffee", label: "Coffee", emoji: "☕" },
  { id: "food", label: "Food", emoji: "🍽️" },
  { id: "bar", label: "Bar", emoji: "🍸" },
];

interface RankedActivitySelectorProps {
  preferences: Activity[];
  onChange: (preferences: Activity[]) => void;
}

export const RankedActivitySelector = ({
  preferences,
  onChange,
}: RankedActivitySelectorProps) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [touchY, setTouchY] = useState<number | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Initialize preferences if empty
  const currentPreferences = preferences.length > 0 
    ? preferences 
    : ACTIVITIES.map(a => a.id);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newPreferences = [...currentPreferences];
    const draggedItem = newPreferences[draggedIndex];
    newPreferences.splice(draggedIndex, 1);
    newPreferences.splice(index, 0, draggedItem);
    
    onChange(newPreferences);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleTouchStart = (index: number, e: React.TouchEvent) => {
    setDraggedIndex(index);
    setTouchY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (draggedIndex === null || touchY === null) return;
    
    e.preventDefault();
    const currentY = e.touches[0].clientY;
    
    // Find which card we're over
    for (let i = 0; i < cardRefs.current.length; i++) {
      const card = cardRefs.current[i];
      if (!card) continue;
      
      const rect = card.getBoundingClientRect();
      if (currentY >= rect.top && currentY <= rect.bottom && i !== draggedIndex) {
        const newPreferences = [...currentPreferences];
        const draggedItem = newPreferences[draggedIndex];
        newPreferences.splice(draggedIndex, 1);
        newPreferences.splice(i, 0, draggedItem);
        
        onChange(newPreferences);
        setDraggedIndex(i);
        setTouchY(currentY);
        break;
      }
    }
  };

  const handleTouchEnd = () => {
    setDraggedIndex(null);
    setTouchY(null);
  };

  const getActivityLabel = (id: Activity) => {
    return ACTIVITIES.find(a => a.id === id);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground mb-3">
        Drag to rank your activity preferences (1st choice at top)
      </p>
      {currentPreferences.map((activityId, index) => {
        const activity = getActivityLabel(activityId);
        if (!activity) return null;

        return (
          <Card
            key={activityId}
            ref={(el) => (cardRefs.current[index] = el)}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            onTouchStart={(e) => handleTouchStart(index, e)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={`p-4 cursor-move touch-none transition-all ${
              draggedIndex === index ? "opacity-50" : ""
            } hover:shadow-md`}
          >
            <div className="flex items-center gap-3">
              <GripVertical className="w-5 h-5 text-muted-foreground" />
              <span className="text-2xl">{activity.emoji}</span>
              <div className="flex-1">
                <div className="font-medium">{activity.label}</div>
                <div className="text-sm text-muted-foreground">
                  Choice #{index + 1}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
