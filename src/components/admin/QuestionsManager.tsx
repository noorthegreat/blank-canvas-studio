
import { useState, useEffect } from "react";
import { useQuestions, Question } from "@/hooks/use-questions";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable Row Component
const SortableQuestionRow = ({
    question,
    index,
    updatingId,
    handleToggleDisabled,
    onRowClick
}: {
    question: Question;
    index: number;
    updatingId: number | null;
    handleToggleDisabled: (q: Question) => void;
    onRowClick: (q: Question) => void;
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: question.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 'auto',
        position: 'relative' as const,
    };

    return (
        <TableRow
            ref={setNodeRef}
            style={style}
            className={`
                ${question.disabled ? "opacity-60 bg-muted/50" : ""}
                hover:bg-muted/50 cursor-pointer transition-colors
            `}
            {...attributes}
            onClick={(e) => {
                // Prevent opening if clicking on specific controls
                // The drag handle and switch have their own handlers or stop propagation
                onRowClick(question);
            }}
        >
            <TableCell>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="cursor-grab hover:bg-muted"
                        onClick={(e) => e.stopPropagation()}
                        {...listeners}
                    >
                        <GripVertical className="h-4 w-4" />
                    </Button>
                </div>
            </TableCell>
            <TableCell>{question.id}</TableCell>
            <TableCell className="font-medium">
                {question.question}
                {question.showIf && <span className="ml-2 text-xs text-muted-foreground">(Conditional)</span>}
            </TableCell>
            <TableCell>
                <div className="flex flex-wrap gap-1">
                    {question.multiSelect && <Badge variant="outline">Multi</Badge>}
                    {question.rangeSlider && <Badge variant="outline">Range</Badge>}
                    {question.ranked && <Badge variant="outline">Ranked</Badge>}
                    {!question.multiSelect && !question.rangeSlider && !question.ranked && <Badge variant="secondary">Single</Badge>}
                </div>
            </TableCell>
            <TableCell>
                <div onClick={(e) => e.stopPropagation()}>
                    <Switch
                        checked={!question.disabled}
                        onCheckedChange={() => handleToggleDisabled(question)}
                        disabled={updatingId === question.id}
                    />
                </div>
            </TableCell>
        </TableRow>
    );
};

export const QuestionsManager = () => {
    const { allQuestions, isLoading, refreshQuestions } = useQuestions();
    const [updatingId, setUpdatingId] = useState<number | null>(null);
    const { toast } = useToast();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [viewingQuestion, setViewingQuestion] = useState<Question | null>(null);

    // Local state for sorting
    const [items, setItems] = useState<Question[]>([]);

    useEffect(() => {
        setItems(allQuestions);
    }, [allQuestions]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const [newQuestion, setNewQuestion] = useState<Partial<Question> & { optionsStr: string }>({
        question: "",
        optionsStr: "[]",
        multiSelect: false,
        rangeSlider: false,
    });

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            setItems((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over?.id);
                const newItems = arrayMove(items, oldIndex, newIndex);

                // Calculate and trigger updates
                // We map the new order to the items. We use the index in the array as the new order_index.
                const updates = newItems.map((item, index) => ({
                    id: item.id,
                    order_index: index
                }));

                // Perform the update
                (async () => {
                    try {
                        const promises = updates.map(u =>
                            supabase.from('questionnaire_questions').update({ order_index: u.order_index }).eq('id', u.id)
                        );
                        await Promise.all(promises);
                        toast({ title: "Order updated" });
                        // We refresh questions to ensure sync, but only after updates are done
                        refreshQuestions();
                    } catch (err: any) {
                        toast({ title: "Error reordering", description: err.message, variant: "destructive" });
                        refreshQuestions();
                    }
                })();

                return newItems;
            });
        }
    };

    const handleAddQuestion = async () => {
        try {
            let optionsJson = [];
            try {
                optionsJson = JSON.parse(newQuestion.optionsStr);
            } catch (e) {
                throw new Error("Invalid JSON for Options");
            }

            // Calculate auto order index
            // We find the max order index in the current list and add 1
            const maxOrder = items.length > 0 ? Math.max(...items.map(q => q.orderIndex || 0)) : 0;
            const nextOrder = items.length > 0 ? maxOrder + 1 : 0;

            const payload = {
                question: newQuestion.question,
                options: optionsJson,
                multi_select: newQuestion.multiSelect,
                range_slider: newQuestion.rangeSlider,
                order_index: nextOrder,
                min_responses: newQuestion.multiSelect ? newQuestion.minResponses : null,
                max_responses: newQuestion.multiSelect ? newQuestion.maxResponses : null,
                allow_custom: newQuestion.allowCustom,
                has_dropdown: newQuestion.hasDropdown,
                ranked: newQuestion.ranked,
                min_value: newQuestion.rangeSlider ? newQuestion.minValue : null,
                max_value: newQuestion.rangeSlider ? newQuestion.maxValue : null,
                default_range: newQuestion.rangeSlider ? newQuestion.defaultRange : null,
                show_if: newQuestion.showIf ? newQuestion.showIf : null,
                disabled: !!newQuestion.disabled
            };

            const { error } = await supabase
                .from('questionnaire_questions')
                .insert({
                    ...payload,
                    options: payload.options as any,
                    show_if: payload.show_if as any
                });

            if (error) throw error;

            toast({ title: "Success", description: "Question added successfully" });
            setIsAddOpen(false);
            setNewQuestion({
                question: "",
                optionsStr: "[]",
                multiSelect: false,
                rangeSlider: false,
            });
            refreshQuestions();
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    const handleToggleDisabled = async (question: Question) => {
        setUpdatingId(question.id);
        try {
            const { error } = await supabase
                .from('questionnaire_questions')
                .update({ disabled: !question.disabled })
                .eq('id', question.id);

            if (error) throw error;

            refreshQuestions();
            toast({ title: "Success", description: "Question status updated" });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setUpdatingId(null);
        }
    };

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="space-y-4">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                <div className="flex">
                    <div className="ml-3">
                        <p className="text-sm text-yellow-700">
                            <strong>Note:</strong> Questions cannot be edited once created to ensure historical answers remain accurate.
                            If you need to edit a question, please disable the old one and create a new question.
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Manage Questions</h2>
                <Button onClick={() => setIsAddOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Add Question
                </Button>
            </div>

            {/* Read-Only Answer Viewer Dialog */}
            <Dialog open={!!viewingQuestion} onOpenChange={(open) => !open && setViewingQuestion(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="pr-4">{viewingQuestion?.question}</DialogTitle>
                    </DialogHeader>

                    {viewingQuestion && (
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                            <div className="flex flex-wrap gap-2 text-xs">
                                {viewingQuestion.multiSelect && <Badge variant="outline">Multi-Select</Badge>}
                                {viewingQuestion.rangeSlider && <Badge variant="outline">Range Slider</Badge>}
                                {viewingQuestion.ranked && <Badge variant="outline">Ranked</Badge>}
                                {viewingQuestion.allowCustom && <Badge variant="secondary">Allows Custom</Badge>}
                                {viewingQuestion.disabled ? <Badge variant="destructive">Disabled</Badge> : <Badge className="bg-green-600">Active</Badge>}
                            </div>

                            <div className="border rounded-md p-4 bg-muted/10 space-y-2">
                                <h3 className="text-sm font-semibold mb-3">Possible Answers:</h3>

                                {viewingQuestion.rangeSlider ? (
                                    <div className="p-4 bg-background border rounded-md text-center space-y-2">
                                        <div className="text-sm text-muted-foreground">Range configuration</div>
                                        <div className="font-mono font-bold text-lg flex justify-center items-center gap-2">
                                            <span>{viewingQuestion.minValue ?? 0}</span>
                                            <span className="h-1 w-8 bg-border"></span>
                                            <span>{viewingQuestion.maxValue ?? 100}</span>
                                        </div>
                                        {(viewingQuestion.defaultRange && viewingQuestion.defaultRange.length > 0) && (
                                            <div className="text-xs text-muted-foreground mt-2">
                                                Default: {viewingQuestion.defaultRange.join(" - ")}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        {viewingQuestion.options && viewingQuestion.options.length > 0 ? (
                                            <ul className="space-y-2">
                                                {viewingQuestion.options.map((opt, idx) => (
                                                    <li key={idx} className="flex gap-2 items-center bg-background p-2 rounded border">
                                                        <div className="w-6 h-6 flex items-center justify-center bg-muted rounded font-bold text-[10px] text-muted-foreground">
                                                            {opt.value}
                                                        </div>
                                                        <span className="text-sm">{opt.label}</span>
                                                    </li>
                                                ))}

                                                {viewingQuestion.allowCustom && (
                                                    <li className="flex gap-2 items-center bg-muted/40 p-2 rounded border border-dashed border-muted-foreground/50">
                                                        <div className="w-auto px-1 h-6 flex items-center justify-center bg-muted rounded font-bold text-[10px] text-muted-foreground opacity-50">
                                                            CUSTOM
                                                        </div>
                                                        <span className="text-sm italic text-muted-foreground">
                                                            Other (User can type a custom response)
                                                        </span>
                                                    </li>
                                                )}
                                            </ul>
                                        ) : (
                                            <div className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded-md border border-yellow-200">
                                                {viewingQuestion.allowCustom
                                                    ? "This question has no preset options. Users will see a text field to type their answer."
                                                    : "No options defined for this question."}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {viewingQuestion.showIf && (
                                <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                                    Shows only if Question ID #{viewingQuestion.showIf.questionId} is answered with "{viewingQuestion.showIf.answer}"
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Add New Question</DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* LEFT COLUMN: Basic Info & Type */}
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">Question Text</label>
                                <Input
                                    value={newQuestion.question}
                                    onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                                    placeholder="e.g., What is your favorite color?"
                                />
                            </div>

                            <div className="flex flex-col justify-end pb-2">
                                <label className="flex items-center gap-2 text-sm font-medium">
                                    <Switch
                                        checked={!newQuestion.disabled}
                                        onCheckedChange={(checked) => setNewQuestion({ ...newQuestion, disabled: !checked })}
                                    />
                                    Active Question
                                </label>
                            </div>

                            <div className="border p-4 rounded-md space-y-4">
                                <h3 className="font-semibold text-sm">Question Type & Constraints</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <label className="flex items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={newQuestion.multiSelect}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setNewQuestion({
                                                    ...newQuestion,
                                                    multiSelect: checked,
                                                    minResponses: checked ? 1 : undefined,
                                                    maxResponses: undefined
                                                });
                                            }}
                                        />
                                        Multi-Select
                                    </label>
                                    <label className="flex items-center gap-2 text-sm">
                                        <input type="checkbox" checked={newQuestion.rangeSlider} onChange={(e) => setNewQuestion({ ...newQuestion, rangeSlider: e.target.checked })} />
                                        Range Slider
                                    </label>
                                    <label className="flex items-center gap-2 text-sm">
                                        <input type="checkbox" checked={newQuestion.ranked} onChange={(e) => setNewQuestion({ ...newQuestion, ranked: e.target.checked })} />
                                        Ranked Choice
                                    </label>
                                    <label className="flex items-center gap-2 text-sm">
                                        <input type="checkbox" checked={newQuestion.allowCustom} onChange={(e) => setNewQuestion({ ...newQuestion, allowCustom: e.target.checked })} />
                                        Allow Custom Answer
                                    </label>
                                    <label className="flex items-center gap-2 text-sm">
                                        <input type="checkbox" checked={newQuestion.hasDropdown} onChange={(e) => setNewQuestion({ ...newQuestion, hasDropdown: e.target.checked })} />
                                        Has Dropdown
                                    </label>
                                </div>

                                {newQuestion.multiSelect && <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div>
                                        <label className="text-xs text-muted-foreground">Min Responses (Default: 1)</label>
                                        <Input
                                            type="number"
                                            className="h-8"
                                            min={0}
                                            value={newQuestion.minResponses !== undefined ? newQuestion.minResponses : ''}
                                            disabled={!newQuestion.multiSelect}
                                            onChange={(e) => setNewQuestion({ ...newQuestion, minResponses: e.target.value ? parseInt(e.target.value) : undefined })}
                                        />
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            Set to 0 to make the question optional.
                                        </p>
                                    </div>
                                    <div>
                                        <label className={`text-xs ${!newQuestion.multiSelect ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>Max Responses</label>
                                        <Input
                                            type="number"
                                            className="h-8"
                                            min={1}
                                            value={newQuestion.maxResponses || ''}
                                            disabled={!newQuestion.multiSelect}
                                            onChange={(e) => setNewQuestion({ ...newQuestion, maxResponses: e.target.value ? parseInt(e.target.value) : undefined })}
                                        />
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            Leave blank for no limit.
                                        </p>
                                    </div>
                                </div>}
                            </div>

                            {/* Conditional Logic UI */}
                            <div className="border p-4 rounded-md bg-muted/20">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-semibold text-sm">Conditional Logic (Show If)</h3>
                                    <Switch
                                        checked={!!newQuestion.showIf}
                                        onCheckedChange={(checked) => setNewQuestion({
                                            ...newQuestion,
                                            showIf: checked ? { questionId: 0, answer: "" } : undefined
                                        })}
                                    />
                                </div>

                                {newQuestion.showIf && (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs">Parent Question ID</label>
                                            <select
                                                className="w-full text-sm border rounded p-1"
                                                value={newQuestion.showIf.questionId}
                                                onChange={(e) => setNewQuestion({
                                                    ...newQuestion,
                                                    showIf: { ...newQuestion.showIf!, questionId: parseInt(e.target.value) }
                                                })}
                                            >
                                                <option value={0}>Select Question...</option>
                                                {allQuestions.map(q => (
                                                    <option key={q.id} value={q.id}>
                                                        {q.id}. {q.question.substring(0, 40)}...
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs">Required Answer Value</label>
                                            {(() => {
                                                const parentQuestion = allQuestions.find(q => q.id === newQuestion.showIf?.questionId);
                                                const parentOptions = parentQuestion?.options || [];

                                                if (parentOptions.length > 0) {
                                                    return (
                                                        <select
                                                            className="w-full text-sm border rounded p-1 h-8"
                                                            value={newQuestion.showIf.answer}
                                                            onChange={(e) => setNewQuestion({
                                                                ...newQuestion,
                                                                showIf: { ...newQuestion.showIf!, answer: e.target.value }
                                                            })}
                                                        >
                                                            <option value="">Select Answer...</option>
                                                            {parentOptions.map((opt: any) => (
                                                                <option key={opt.value} value={opt.value}>
                                                                    {opt.value} - {opt.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    );
                                                }

                                                return (
                                                    <Input
                                                        className="h-8"
                                                        value={newQuestion.showIf.answer}
                                                        onChange={(e) => setNewQuestion({
                                                            ...newQuestion,
                                                            showIf: { ...newQuestion.showIf!, answer: e.target.value }
                                                        })}
                                                        placeholder="e.g. 'A' or 'Yes'"
                                                    />
                                                );
                                            })()}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Options Builder */}
                        <div className="space-y-4 flex flex-col h-full">
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-medium">Answer Options</label>
                                <Button size="sm" variant="outline" onClick={() => {
                                    const currentOptions = JSON.parse(newQuestion.optionsStr || "[]");
                                    const nextChar = String.fromCharCode(65 + currentOptions.length);
                                    const updated = [...currentOptions, { value: nextChar, label: "" }];
                                    setNewQuestion({ ...newQuestion, optionsStr: JSON.stringify(updated) });
                                }}>
                                    <Plus className="w-3 h-3 mr-1" /> Add Option
                                </Button>
                            </div>

                            <div className="flex-1 border rounded-md p-2 overflow-y-auto min-h-[300px] bg-muted/10">
                                {(() => {
                                    let options = [];
                                    try { options = JSON.parse(newQuestion.optionsStr || "[]"); } catch (e) { }

                                    if (options.length === 0 && !newQuestion.allowCustom) {
                                        return <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No options added yet.</div>;
                                    }

                                    return (
                                        <div className="space-y-2">
                                            {options.map((opt: any, idx: number) => (
                                                <div key={idx} className="flex gap-2 items-center bg-background p-2 rounded border">
                                                    <div className="w-8 h-8 flex items-center justify-center bg-muted rounded font-bold text-xs text-muted-foreground">
                                                        {opt.value}
                                                    </div>
                                                    <Input
                                                        className="h-8 flex-1"
                                                        value={opt.label}
                                                        placeholder="Answer"
                                                        onChange={(e) => {
                                                            const updated = [...options];
                                                            updated[idx].label = e.target.value;
                                                            setNewQuestion({ ...newQuestion, optionsStr: JSON.stringify(updated) });
                                                        }}
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                        onClick={() => {
                                                            const updated = options.filter((_: any, i: number) => i !== idx);
                                                            const reindexed = updated.map((o: any, i: number) => ({
                                                                ...o,
                                                                value: String.fromCharCode(65 + i)
                                                            }));
                                                            setNewQuestion({ ...newQuestion, optionsStr: JSON.stringify(reindexed) });
                                                        }}
                                                    >
                                                        <span className="sr-only">Delete</span>
                                                        &times;
                                                    </Button>
                                                </div>
                                            ))}

                                            {newQuestion.allowCustom && (
                                                <div className="flex gap-2 items-center bg-muted/40 p-2 rounded border border-dashed border-muted-foreground/50">
                                                    <div className="w-auto h-8 flex items-center justify-center bg-muted rounded font-bold text-xs text-muted-foreground opacity-50">
                                                        CUSTOM
                                                    </div>
                                                    <Input
                                                        className="h-8 w-auto flex-1 bg-transparent border-dashed text-muted-foreground italic"
                                                        value={options.length > 0 ? "Other" : "Blank"}
                                                        readOnly
                                                    />
                                                    <div className="text-[10px] text-muted-foreground px-2">
                                                        {options.length == 0 ? "Will be a blank field" : "Appears as an \"Other\" option. Selecting it shows an input field."}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>

                            {newQuestion.rangeSlider && (
                                <div className="border p-4 rounded-md space-y-2 bg-blue-50/50">
                                    <h4 className="font-semibold text-xs text-blue-800">Range Configuration</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input
                                            placeholder="Min Value (e.g. 18)"
                                            type="number"
                                            className="h-8"
                                            value={newQuestion.minValue || ''}
                                            onChange={(e) => setNewQuestion({ ...newQuestion, minValue: parseInt(e.target.value) })}
                                        />
                                        <Input
                                            placeholder="Max Value (e.g. 100)"
                                            type="number"
                                            className="h-8"
                                            value={newQuestion.maxValue || ''}
                                            onChange={(e) => setNewQuestion({ ...newQuestion, maxValue: parseInt(e.target.value) })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 pt-2">
                                        <div>
                                            <label className="text-xs text-blue-800">Default Start</label>
                                            <Input
                                                placeholder="e.g. 25"
                                                type="number"
                                                className="h-8"
                                                value={newQuestion.defaultRange?.[0] || ''}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    const current = newQuestion.defaultRange || [0, 0];
                                                    setNewQuestion({ ...newQuestion, defaultRange: [val, current[1]] });
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-blue-800">Default End</label>
                                            <Input
                                                placeholder="e.g. 35"
                                                type="number"
                                                className="h-8"
                                                value={newQuestion.defaultRange?.[1] || ''}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    const current = newQuestion.defaultRange || [0, 0];
                                                    setNewQuestion({ ...newQuestion, defaultRange: [current[0], val] });
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddQuestion} disabled={!newQuestion.question || (newQuestion.rangeSlider && (!newQuestion.defaultRange || newQuestion.defaultRange.length < 2))}>Save Question</Button>
                    </div>
                </DialogContent>
            </Dialog>

            <div className="border rounded-md">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">Order</TableHead>
                                <TableHead className="w-[50px]">Id</TableHead>
                                <TableHead>Question</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Enabled</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <SortableContext
                                items={items.map(i => i.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {items.map((q, index) => (
                                    <SortableQuestionRow
                                        key={q.id}
                                        question={q}
                                        index={index}
                                        handleToggleDisabled={handleToggleDisabled}
                                        updatingId={updatingId}
                                        onRowClick={setViewingQuestion}
                                    />
                                ))}
                            </SortableContext>
                        </TableBody>
                    </Table>
                </DndContext>
            </div>
        </div>
    );
};
