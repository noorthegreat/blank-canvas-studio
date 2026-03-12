
import { useEffect, useState } from "react";
import { GripVertical } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
}

interface RankedOptionsSelectorProps {
  options: Option[];
  rankedValues: string[];
  onChange: (rankedValues: string[]) => void;
}

interface SortableItemProps {
  id: string;
  label: string;
}

const SortableItem = ({ id, label }: SortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 'auto',
    position: 'relative' as const,
    touchAction: 'none' as React.CSSProperties['touchAction']
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "p-4 cursor-grab active:cursor-grabbing touch-none transition-shadow hover:shadow-md mb-2 bg-background select-none",
        isDragging && "shadow-xl ring-2 ring-primary/20 opacity-90 z-20"
      )}
    >
      <div className="flex items-center gap-3">
        <GripVertical className="w-5 h-5 text-muted-foreground shrink-0" />
        <div className="flex-1">
          <div className="font-medium select-none">{label}</div>
        </div>
      </div>
    </Card>
  );
};

export const RankedOptionsSelector = ({
  options,
  rankedValues,
  onChange,
}: RankedOptionsSelectorProps) => {
  // If we have rankings provided, use them. Otherwise, default to the options in their defined order.
  const [items, setItems] = useState<string[]>([]);

  // Initialize state
  useEffect(() => {
    const currentRankings = rankedValues.length > 0
      ? rankedValues
      : options.map(o => o.value);
    setItems(currentRankings);
  }, [rankedValues, options]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = items.indexOf(active.id as string);
      const newIndex = items.indexOf(over?.id as string);

      const newItems = arrayMove(items, oldIndex, newIndex);

      // Update local state immediately for responsiveness
      setItems(newItems);
      // Propagate change
      onChange(newItems);
    }
  };

  const getOptionLabel = (value: string) => {
    return options.find(o => o.value === value)?.label || value;
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground mb-3">
        Drag to rank your preferences (1st choice at top)
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items}
          strategy={verticalListSortingStrategy}
        >
          {items.map((value) => (
            <SortableItem
              key={value}
              id={value}
              label={getOptionLabel(value)}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
};
