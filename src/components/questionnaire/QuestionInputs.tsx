import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { RankedOptionsSelector } from "@/components/RankedOptionsSelector";
import { CustomAnswerInput } from "./CustomAnswerInput";
import { Question } from "@/hooks/use-questions";
import { cn } from "@/lib/utils";
import { useState } from "react";

// --- Range Slider ---
interface RangeSliderQuestionProps {
    question: Question;
    currentAnswer: string;
    onChange: (values: number[]) => void;
}

export const RangeSliderQuestion = ({ question, currentAnswer, onChange }: RangeSliderQuestionProps) => {
    const values = currentAnswer ? currentAnswer.split(':').map(Number) : question.defaultRange || [question.minValue || 0, question.maxValue || 100];

    return (
        <div className="space-y-6 px-2">
            <div className="flex justify-between text-sm font-medium">
                <span>Min: {values[0]} years</span>
                <span>Max: {values[1]} years</span>
            </div>
            <Slider
                min={question.minValue}
                max={question.maxValue}
                step={1}
                value={values}
                onValueChange={onChange}
                className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
                <span>{question.minValue} years</span>
                <span>{question.maxValue} years</span>
            </div>
        </div>
    );
};

// --- Dropdown ---
interface DropdownQuestionProps {
    question: Question;
    currentAnswer: string;
    onChange: (value: string) => void;
    customAnswerText: string;
    onCustomChange: (text: string) => void;
    hasCustomAnswer: boolean;
}

export const DropdownQuestion = ({
    question,
    currentAnswer,
    onChange,
    customAnswerText,
    onCustomChange,
    hasCustomAnswer
}: DropdownQuestionProps) => {
    const [open, setOpen] = useState(false);

    return (
        <div className="space-y-4">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between h-auto min-h-12 text-left"
                    >
                        {currentAnswer && !currentAnswer.startsWith('CUSTOM:')
                            ? question.options.find((option) => option.value === currentAnswer)?.label
                            : currentAnswer.startsWith('CUSTOM:')
                                ? currentAnswer.replace('CUSTOM:', '')
                                : "Select occupation..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 popover-content" align="start">
                    <Command>
                        <CommandInput placeholder="Search occupation..." />
                        <CommandList>
                            <CommandEmpty>No occupation found.</CommandEmpty>
                            <CommandGroup>
                                {question.options.map((option) => (
                                    <CommandItem
                                        key={option.value}
                                        value={option.label}
                                        onSelect={() => {
                                            onChange(option.value);
                                            setOpen(false);
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                currentAnswer === option.value ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {option.label}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            {question.allowCustom && (
                <CustomAnswerInput
                    id={`${question.id}-CUSTOM`}
                    isChecked={hasCustomAnswer}
                    value={customAnswerText}
                    onToggle={() => onChange('CUSTOM')}
                    onChange={onCustomChange}
                />
            )}
        </div>
    );
};


// --- Multi Select ---
interface MultiSelectQuestionProps {
    question: Question;
    currentAnswerArray: string[];
    onChange: (value: string) => void;
    customAnswerText: string;
    onCustomChange: (text: string) => void;
    hasCustomAnswer: boolean;
}

export const MultiSelectQuestion = ({
    question,
    currentAnswerArray,
    onChange,
    customAnswerText,
    onCustomChange,
    hasCustomAnswer
}: MultiSelectQuestionProps) => {
    return (
        <div className={cn(question.combined ? "flex flex-wrap gap-2" : "space-y-3")}>
            {question.options.map((option) => {
                const isSelected = currentAnswerArray.includes(option.value);
                return (
                    <div
                        key={option.value}
                        className={cn(
                            "flex items-center text-sm py-1 px-2 rounded-sm border transition-colors cursor-pointer",
                            isSelected
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-border hover:bg-muted/50 text-foreground",
                            question.combined ? "justify-center text-center" : ""
                        )}
                        onClick={() => onChange(option.value)}
                    >
                        <span className="leading-relaxed">
                            {option.label}
                        </span>
                    </div>
                );
            })}

            {question.allowCustom && (
                <div className={cn(question.combined ? "col-span-full" : "")}>
                    <CustomAnswerInput
                        id={`${question.id}-CUSTOM`}
                        isChecked={hasCustomAnswer}
                        value={customAnswerText}
                        onToggle={() => onChange('CUSTOM')}
                        onChange={onCustomChange}
                    />
                </div>
            )}
        </div>
    );
};


// --- Single Select ---
interface SingleSelectQuestionProps {
    question: Question;
    currentAnswer: string;
    onChange: (value: string) => void;
    customAnswerText: string;
    onCustomChange: (text: string) => void;
    showInputBox: boolean;
}

export const SingleSelectQuestion = ({
    question,
    currentAnswer,
    onChange,
    customAnswerText,
    onCustomChange,
    showInputBox
}: SingleSelectQuestionProps) => {
    // Determine the value for RadioGroup. If it's a custom answer (starts with CUSTOM or is exactly CUSTOM), the group value should be 'CUSTOM'
    const radioValue = currentAnswer.startsWith('CUSTOM') || currentAnswer === 'CUSTOM' ? 'CUSTOM' : currentAnswer;
    const customOnlyQuestion = question.allowCustom && (question.options?.length || 0) === 0;

    return (
        <div className={cn(question.combined ? "flex flex-wrap gap-2" : "space-y-3")}>
            {question.options.map((option) => {
                const isSelected = radioValue === option.value;
                return (
                    <div
                        key={option.value}
                        className={cn(
                            "flex items-center text-sm py-1 px-2 rounded-sm border transition-colors cursor-pointer",
                            isSelected
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-border hover:bg-muted/50 text-foreground",
                            question.combined ? "justify-center text-center" : ""
                        )}
                        onClick={() => onChange(option.value)}
                    >
                        <span className="leading-relaxed">
                            {option.label}
                        </span>
                    </div>
                );
            })}

            {question.allowCustom && (
                <div className={cn("space-y-2", question.combined ? "col-span-full mt-2" : "")}>
                    {question.options?.length > 0 && (
                        <div
                            className={cn(
                                "flex items-center text-sm py-1 px-2 rounded-sm border transition-colors cursor-pointer",
                                radioValue === 'CUSTOM'
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : "border-border hover:bg-muted/50 text-foreground",
                                question.combined ? "justify-center text-center" : ""
                            )}
                            onClick={() => onChange('CUSTOM')}
                        >
                            <span className="leading-relaxed">
                                Other
                            </span>
                        </div>
                    )}

                    {(customOnlyQuestion || showInputBox) && (
                        <Input
                            placeholder="Type your answer..."
                            value={customAnswerText}
                            onChange={(e) => {
                                if (radioValue !== 'CUSTOM') onChange('CUSTOM');
                                onCustomChange(e.target.value);
                            }}
                            className="w-full ml-0"
                        />
                    )}
                </div>
            )}
        </div>
    );
};

// --- Ranked ---
interface RankedQuestionProps {
    question: Question;
    currentAnswer: string;
    onChange: (rankedValues: string[]) => void;
}

export const RankedQuestion = ({ question, currentAnswer, onChange }: RankedQuestionProps) => {
    return (
        <RankedOptionsSelector
            options={question.options}
            rankedValues={currentAnswer ? currentAnswer.split(',') : []}
            onChange={onChange}
        />
    );
};
