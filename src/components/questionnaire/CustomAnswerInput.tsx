import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CustomAnswerInputProps {
    id: string; // Unique ID prefix (e.g. "q1-CUSTOM")
    isChecked: boolean;
    value: string;
    onToggle: () => void;
    onChange: (text: string) => void;
    inputType?: 'checkbox' | 'radio';
}

export const CustomAnswerInput = ({
    id,
    isChecked,
    value,
    onToggle,
    onChange,
    inputType = 'checkbox'
}: CustomAnswerInputProps) => {
    return (
        <div className="space-y-2">
            <div
                id={id}
                className={cn(
                    "flex items-center text-sm py-1 px-2 rounded-sm border transition-colors cursor-pointer",
                    isChecked
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-border hover:bg-muted/50 text-foreground"
                )}
                onClick={onToggle}
            >
                <span className="leading-relaxed">
                    Other
                </span>
            </div>
            {isChecked && (
                <Input
                    placeholder="Type your answer..."
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full"
                />
            )}
        </div>
    );
};
