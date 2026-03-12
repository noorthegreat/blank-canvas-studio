import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RefSelector } from "./RefSelector";
import { ValueSelector } from "./ValueSelector";

interface ConditionEditorProps {
    condition: any;
    onChange: (condition: any) => void;
    algorithm?: "relationship" | "friendship" | "event";
}

export const ConditionEditor = ({ condition, onChange, algorithm }: ConditionEditorProps) => {
    // Default empty condition if null/undefined, or ensure it's an object
    // Enforce source_type='question' and operator='equals'
    const cond = {
        ...condition,
        source_type: 'question',
        operator: 'equals'
    };

    const handleChange = (field: string, value: any) => {
        const newCondition = { ...cond, [field]: value };
        onChange(newCondition);
    };

    return (
        <div className="space-y-4 p-4 border rounded-md bg-muted/20">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-xs">If this question...</Label>
                    <div className="h-8">
                        <RefSelector
                            type="question"
                            value={cond.source_ref}
                            onChange={(v) => handleChange('source_ref', v)}
                            algorithm={algorithm}
                            placeholder="Select Question..."
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs">Has this answer</Label>
                    <ValueSelector
                        className="h-8 text-xs"
                        value={cond.value}
                        onChange={(v) => handleChange('value', v)}
                        placeholder="Value to check..."
                        type="question"
                        reference={cond.source_ref}
                        algorithm={algorithm}
                    />
                </div>
            </div>
            <p className="text-[0.8rem] text-muted-foreground">
                Condition: Returns true if the selected question's answer equals the required value.
            </p>
        </div>
    );
};
