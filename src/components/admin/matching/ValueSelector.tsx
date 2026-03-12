import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ValueSelectorProps {
    value: string;
    onChange: (value: string) => void;
    type: string;
    reference: string | null;
    algorithm?: string;
    placeholder?: string;
    className?: string;
}

export const ValueSelector = ({ value, onChange, type, reference, algorithm, placeholder, className }: ValueSelectorProps) => {
    const [options, setOptions] = useState<{ label: string; value: string }[] | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchOptions = async () => {
            if (type !== 'question' || !reference) {
                setOptions(null);
                return;
            }

            setLoading(true);
            try {
                let table = 'questionnaire_questions';
                // Use friendship_questions table if algorithm is explicitly friendship,
                // OR if we are just looking up a question and the context implies friendship. 
                // However, the prompt says "event and relationship share questions/answers" and "friendship uses friendship_answers".
                // We should rely on the passed algorithm prop or default logic.
                if (algorithm === 'friendship') table = 'friendship_questions';

                const { data, error } = await supabase
                    .from(table as any)
                    .select('options')
                    .eq('id', reference)
                    .single();

                if (error) throw error;

                if (data) {
                    const row = data as any;
                    if (row.options) {
                        // Options are stored as JSON: [{label: "X", value: "Y"}, ...] or just ["A", "B"]
                        const opts = row.options as any[];
                        if (Array.isArray(opts)) {
                            const formatted = opts.map((o: any) => {
                                if (typeof o === 'string') return { label: o, value: o };
                                return { label: o.label || o.value, value: o.value };
                            });
                            setOptions(formatted);
                        } else {
                            setOptions(null);
                        }
                    } else {
                        setOptions(null);
                    }
                }
            } catch (error) {
                console.error("Error fetching options:", error);
                setOptions(null);
            } finally {
                setLoading(false);
            }
        };

        fetchOptions();
    }, [type, reference, algorithm]);

    if (loading) {
        return <div className="relative"><Input disabled placeholder="Loading options..." className={className} /><Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground" /></div>;
    }

    if (options && options.length > 0) {
        return (
            <Select value={value || ''} onValueChange={onChange}>
                <SelectTrigger className={className}>
                    <SelectValue placeholder={placeholder || "Select value..."} />
                </SelectTrigger>
                <SelectContent>
                    {options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                            {opt.label} ({opt.value})
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        );
    }

    return (
        <Input
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || "Value..."}
            className={className}
        />
    );
};
