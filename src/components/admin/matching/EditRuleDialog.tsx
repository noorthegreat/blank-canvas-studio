import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ConditionEditor } from "./ConditionEditor";
import { RefSelector } from "./RefSelector";
import { ValueSelector } from "./ValueSelector";
import { Plus, Trash2, X } from "lucide-react";

interface EditRuleDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rule: any;
    onSave: (rule: any) => Promise<void>;
}

export const EditRuleDialog = ({ open, onOpenChange, rule, onSave }: EditRuleDialogProps) => {
    const [editedRule, setEditedRule] = useState<any>(null);

    useEffect(() => {
        if (rule) {
            setEditedRule({ ...rule });
        }
    }, [rule]);

    const handleSave = async () => {
        if (!editedRule) return;
        await onSave(editedRule);
        onOpenChange(false);
    };

    if (!editedRule) return null;

    const isDealbreaker = editedRule.rule_type === 'dealbreaker';
    const isActivityBoost = editedRule.operator === 'boost_decay_recency';

    if (isActivityBoost) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Activity Boost: {editedRule.name}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Active Status</Label>
                                <p className="text-xs text-muted-foreground">Toggle this rule on or off</p>
                            </div>
                            <Switch
                                checked={editedRule.is_active}
                                onCheckedChange={(c) => setEditedRule({ ...editedRule, is_active: c })}
                            />
                        </div>

                        <Separator />

                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                                value={editedRule.name}
                                onChange={(e) => setEditedRule({ ...editedRule, name: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                className="min-h-[100px]"
                                value={editedRule.description || ''}
                                onChange={(e) => setEditedRule({ ...editedRule, description: e.target.value })}
                            />
                        </div>

                        <div className="space-y-4 pt-4">
                            <Label>Decay Schedule</Label>
                            <div className="border rounded-md p-4 space-y-4">
                                <div className="grid grid-cols-3 gap-4 text-sm font-medium text-muted-foreground mb-2">
                                    <span>Days Since Active</span>
                                    <span>Boost Multiplier</span>
                                    <span></span>
                                </div>
                                {(editedRule.params?.decay_schedule || []).map((tier: any, index: number) => (
                                    <div key={index} className="grid grid-cols-3 gap-4 items-center">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-muted-foreground w-4">≤</span>
                                            <Input
                                                type="number"
                                                min="0"
                                                value={tier.days}
                                                onChange={(e) => {
                                                    const newSchedule = [...(editedRule.params?.decay_schedule || [])];
                                                    newSchedule[index] = { ...tier, days: parseInt(e.target.value) || 0 };
                                                    setEditedRule({ ...editedRule, params: { ...editedRule.params, decay_schedule: newSchedule } });
                                                }}
                                            />
                                        </div>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={tier.boost}
                                            onChange={(e) => {
                                                const newSchedule = [...(editedRule.params?.decay_schedule || [])];
                                                newSchedule[index] = { ...tier, boost: parseFloat(e.target.value) || 1 };
                                                setEditedRule({ ...editedRule, params: { ...editedRule.params, decay_schedule: newSchedule } });
                                            }}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                const newSchedule = (editedRule.params?.decay_schedule || []).filter((_: any, i: number) => i !== index);
                                                setEditedRule({ ...editedRule, params: { ...editedRule.params, decay_schedule: newSchedule } });
                                            }}
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const newSchedule = [...(editedRule.params?.decay_schedule || []), { days: 7, boost: 1.1 }];
                                        // Sort (optional but good UI)? The backend sorts anyway. Let's not auto-sort on edit to avoid jumping UI.
                                        setEditedRule({ ...editedRule, params: { ...(editedRule.params || {}), decay_schedule: newSchedule } });
                                    }}
                                    className="w-full"
                                >
                                    <Plus className="h-3 w-3 mr-2" />
                                    Add Decay Tier
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Apply a boost multiplier if the user was active within the last X days.
                                The logic will find the first matching tier (sorted by days).
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700">Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    const isMaxDistance = editedRule.operator === 'distance_lte';

    if (isMaxDistance) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Max Distance: {editedRule.name}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Active Status</Label>
                                <p className="text-xs text-muted-foreground">Toggle this rule on or off</p>
                            </div>
                            <Switch
                                checked={editedRule.is_active}
                                onCheckedChange={(c) => setEditedRule({ ...editedRule, is_active: c })}
                            />
                        </div>

                        <Separator />

                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                                value={editedRule.name}
                                onChange={(e) => setEditedRule({ ...editedRule, name: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                className="min-h-[100px]"
                                value={editedRule.description || ''}
                                onChange={(e) => setEditedRule({ ...editedRule, description: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Max Distance (Miles)</Label>
                            <Input
                                type="number"
                                value={editedRule.params?.value || 15}
                                onChange={(e) => setEditedRule({
                                    ...editedRule,
                                    params: { ...editedRule.params, value: parseInt(e.target.value) || 0 }
                                })}
                            />
                            <p className="text-xs text-muted-foreground">
                                Maximum distance in miles between users.
                            </p>
                        </div>

                        <div className="space-y-2 pt-2">
                            <Label>Only apply rule on this condition:</Label>
                            <ConditionEditor
                                condition={editedRule.condition || {}}
                                onChange={(newCondition) => setEditedRule({ ...editedRule, condition: newCondition })}
                                algorithm={editedRule.algorithm}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700">Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Rule: {editedRule.name}</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-6 py-4">
                    {/* LEFT COLUMN: Basic Info & Logic */}
                    <div className="space-y-4">
                        <div className="flex bg-gray-50 p-3 rounded-lg border items-center justify-between">
                            <Label className="font-semibold">Rule Type</Label>
                            <Select
                                value={editedRule.rule_type}
                                onValueChange={(v) => {
                                    const updates: any = { rule_type: v };
                                    if (v === 'modifier' && !editedRule.weight) {
                                        updates.weight = 1;
                                    }
                                    setEditedRule({ ...editedRule, ...updates });
                                }}
                            >
                                <SelectTrigger className="w-[180px] bg-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="dealbreaker">Dealbreaker</SelectItem>
                                    <SelectItem value="modifier">Modifier</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center justify-between">
                            <Label>Active</Label>
                            <Switch
                                checked={editedRule.is_active}
                                onCheckedChange={(c) => setEditedRule({ ...editedRule, is_active: c })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                                value={editedRule.name}
                                onChange={(e) => setEditedRule({ ...editedRule, name: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                value={editedRule.description || ''}
                                onChange={(e) => setEditedRule({ ...editedRule, description: e.target.value })}
                            />
                        </div>

                        <Separator />

                        <div className="rounded-md bg-green-100 p-4">
                            <div className="space-y-2">
                                <Label>Partner A (Source)</Label>
                                <Select
                                    value={editedRule.source_type}
                                    onValueChange={(v) => setEditedRule({ ...editedRule, source_type: v })}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="profile">Profile</SelectItem>
                                        <SelectItem value="question">Question</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="mt-2">
                                <RefSelector
                                    type={editedRule.source_type}
                                    value={editedRule.source_ref}
                                    onChange={(val) => setEditedRule({ ...editedRule, source_ref: val })}
                                    algorithm={editedRule.algorithm}
                                    placeholder="Select Source..."
                                />
                            </div>
                        </div>
                        <div className="space-y-2 rounded-md bg-gray-100 p-4">
                            <Label>Operator</Label>
                            <Select
                                value={editedRule.operator}
                                onValueChange={(v) => setEditedRule({ ...editedRule, operator: v })}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="equals">Equals</SelectItem>
                                    <SelectItem value="intersects">Intersects (Arrays)</SelectItem>
                                    <SelectItem value="mapped_subset">Mapped Subset</SelectItem>
                                    <SelectItem value="range_includes">Range Includes</SelectItem>
                                    <SelectItem value="set_similarity">Set Similarity</SelectItem>
                                    <SelectItem value="equals_or_adjacent">Equals or Adjacent</SelectItem>
                                    <SelectItem value="none_present_in">None Matching</SelectItem>
                                </SelectContent>
                            </Select>
                            <OperatorDescription operator={editedRule.operator} />
                        </div>
                        <div className="rounded-md bg-green-100 p-4">
                            <div className="space-y-2">
                                <Label>Partner B (Target)</Label>
                                <Select
                                    value={editedRule.target_type || 'constant'}
                                    onValueChange={(v) => setEditedRule({ ...editedRule, target_type: v })}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="profile">Profile</SelectItem>
                                        <SelectItem value="question">Question</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="mt-2">
                                <RefSelector
                                    type={editedRule.target_type || 'constant'}
                                    value={editedRule.target_ref}
                                    onChange={(val) => setEditedRule({ ...editedRule, target_ref: val })}
                                    algorithm={editedRule.algorithm}
                                    placeholder="Select Target..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Params & Weights */}
                    <div className="space-y-4">
                        {!isDealbreaker && (<>

                            <Label>Modifier Weights</Label>
                            <Card className="bg-blue-50/20 border-blue-100">
                                <CardContent className="pt-6">
                                    <div className="space-y-4">
                                        <div className="flex justify-between">
                                            <Label>Impact Weight ({editedRule.weight}x)</Label>
                                            <span className="text-xs text-muted-foreground">Adjusts score significance</span>
                                        </div>
                                        <Slider
                                            value={[editedRule.weight || 1]}
                                            min={0}
                                            max={10}
                                            step={0.1}
                                            onValueChange={([v]) => setEditedRule({ ...editedRule, weight: v })}
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                        )}

                        <div className="space-y-2">
                            <Label>Parameters</Label>
                            <ParamsEditor
                                operator={editedRule.operator}
                                params={editedRule.params || {}}
                                sourceType={editedRule.source_type}
                                sourceRef={editedRule.source_ref}
                                targetType={editedRule.target_type}
                                targetRef={editedRule.target_ref}
                                algorithm={editedRule.algorithm}
                                onChange={(newParams) => {
                                    setEditedRule({ ...editedRule, params: newParams });
                                }}
                            />
                        </div>

                        <div className="space-y-2 pt-4">
                            <Label>Only apply rule on this condition:</Label>
                            <ConditionEditor
                                condition={editedRule.condition || {}}
                                onChange={(newCondition) => setEditedRule({ ...editedRule, condition: newCondition })}
                                algorithm={editedRule.algorithm}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const OperatorDescription = ({ operator }: { operator: string }) => {
    let text = "";
    switch (operator) {
        case 'equals': text = "All answers (or profile values) must be exactly the same."; break;
        case 'intersects': text = "At least one answer (or profile value) must be the same."; break;
        case 'mapped_subset': text = "Answers from Partner A must be a subset of the answers from Partner B, according to the mapping defined in the parameters."; break;
        case 'range_includes': text = "Partner B's profile value must be within the range defined by Partner A's question answer."; break;
        case 'equals_or_adjacent': text = "Matches exact value or adjacent values (e.g. slight age diff)."; break;
        case 'set_similarity': text = "Calculates Jaccard Index similarity between two sets."; break;
        case 'boost_decay_recency': text = "Boosts score based on recency (e.g. last sign in)."; break;
        case 'none_present_in': text = "None of Partner A's answers can match any of Partner B's answers."; break;
        default: return null;
    }

    return (
        <p className="text-[0.8rem] text-muted-foreground mt-1">
            {text}
        </p>
    )
}

const ParamsEditor = ({ operator, params, onChange, sourceType, sourceRef, targetType, targetRef, algorithm }: {
    operator: string,
    params: any,
    onChange: (p: any) => void,
    sourceType?: string,
    sourceRef?: string,
    targetType?: string,
    targetRef?: string,
    algorithm?: string
}) => {

    if (operator === 'equals_or_adjacent') {
        return (
            <div className="space-y-2">
                <Label>Adjacent Match Multiplier (0-1)</Label>
                <Input
                    type="number"
                    step="0.1"
                    value={params.adjacent_weight_multiplier || 0.5}
                    onChange={(e) => onChange({ ...params, adjacent_weight_multiplier: parseFloat(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">
                    Score multiplier if values are adjacent but not equal (e.g. ±1).
                </p>
            </div>
        );
    }

    if (operator === 'mapped_subset') {
        const mapping = params.mapping || {};
        const entries = Object.entries(mapping);

        const addTuple = () => {
            onChange({
                ...params,
                mapping: { ...mapping, "": "" }
            });
        };

        const updateTuple = (oldKey: string, newKey: string, newVal: string) => {
            const newMapping = { ...mapping };
            if (oldKey !== newKey) {
                delete newMapping[oldKey];
            }
            newMapping[newKey] = newVal;
            onChange({ ...params, mapping: newMapping });
        };

        const removeTuple = (key: string) => {
            const newMapping = { ...mapping };
            delete newMapping[key];
            onChange({ ...params, mapping: newMapping });
        };

        return (
            <div className="space-y-2">
                <Label>Value Mapping</Label>
                <div className="space-y-2 max-h-[200px] overflow-y-auto p-2 border rounded">
                    {entries.map(([key, val]) => (
                        <div key={key} className="flex items-center gap-2">
                            <ValueSelector
                                placeholder="User Value"
                                value={key}
                                onChange={(val) => updateTuple(key, val, val as string)}
                                className="h-8 text-xs"
                                type={sourceType || 'question'}
                                reference={sourceRef || null}
                                algorithm={algorithm}
                            />
                            <span className="text-muted-foreground">&rarr;</span>
                            <ValueSelector
                                placeholder="Target Value"
                                value={val as string}
                                onChange={(v) => updateTuple(key, key, v)}
                                className="h-8 text-xs"
                                type={targetType || 'question'}
                                reference={targetRef || null}
                                algorithm={algorithm}
                            />
                            <Button
                                size="icon" variant="ghost" className="h-8 w-8 text-red-500"
                                onClick={() => removeTuple(key)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={addTuple} className="w-full">
                        <Plus className="h-3 w-3 mr-2" />
                        Add Mapping
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 border border-dashed rounded text-center text-sm text-muted-foreground">
            No specific parameters required.
        </div>
    );
}
