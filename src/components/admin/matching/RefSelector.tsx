import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface RefSelectorProps {
    type: string;
    value: string | null;
    onChange: (value: string) => void;
    placeholder?: string;
    algorithm?: "relationship" | "friendship" | "event";
}

export const RefSelector = ({ type, value, onChange, placeholder, algorithm }: RefSelectorProps) => {
    const [options, setOptions] = useState<{ label: string; value: string }[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchOptions = async () => {
            setLoading(true);
            try {
                if (type === 'question') {
                    // Decide which table to query based on algorithm
                    // Default to questionnaire_questions for relationship, friendship_questions for friendship
                    // Event might use a mix or specific ones? For now let's load based on algo.

                    let table = 'questionnaire_questions';
                    if (algorithm === 'friendship') table = 'friendship_questions';
                    // For 'event', it might be different, but let's default to questionnaire for now or load both?
                    // Let's stick to the main ones.

                    const { data, error } = await supabase
                        .from(table as any)
                        .select('id, question')
                        .order('id');

                    if (error) throw error;

                    if (data) {
                        setOptions(data.map((q: any) => ({
                            label: `${q.id}. ${q.question.substring(0, 50)}${q.question.length > 50 ? '...' : ''}`,
                            value: q.id.toString()
                        })));
                    }
                } else if (type === 'profile') {
                    // Hardcoded list of useful profile columns for matching
                    const profileColumns = [
                        { label: "Age", value: "age" },
                        { label: "First Name", value: "first_name" },
                        { label: "Last Name", value: "last_name" },
                        { label: "Email", value: "email" },
                        { label: "Phone Number", value: "phone_number" },
                        { label: "Bio", value: "bio" },
                        { label: "Birthday", value: "birthday" },
                        { label: "Latitude", value: "latitude" },
                        { label: "Longitude", value: "longitude" },
                        { label: "Completed Questionnaire", value: "completed_questionnaire" },
                        { label: "Is Paused", value: "is_paused" },
                        { label: "Created At", value: "created_at" },
                        { label: "Updated At", value: "updated_at" }
                    ];
                    setOptions(profileColumns);
                } else {
                    setOptions([]);
                }
            } catch (error) {
                console.error("Error fetching options:", error);
            } finally {
                setLoading(false);
            }
        };

        if (type === 'question' || type === 'profile') {
            fetchOptions();
        }
    }, [type, algorithm]);

    if (type === 'constant' || type === 'computed') {
        return (
            <Input
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder || "Value..."}
            />
        );
    }

    return (
        <div className="relative">
            <Select value={value || ''} onValueChange={onChange}>
                <SelectTrigger>
                    <SelectValue placeholder={loading ? "Loading..." : (placeholder || "Select reference...")} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                    {options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                        </SelectItem>
                    ))}
                    {options.length === 0 && !loading && (
                        <div className="p-2 text-sm text-muted-foreground text-center">No options found</div>
                    )}
                </SelectContent>
            </Select>
            {loading && <Loader2 className="h-4 w-4 animate-spin absolute right-8 top-3 text-muted-foreground" />}
        </div>
    );
};
