import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    Edge,
    Node,
    Connection,
    addEdge
} from 'reactflow';
import 'reactflow/dist/style.css';

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MatchingRuleNode } from './matching/MatchingRuleNode';
import { EditRuleDialog } from './matching/EditRuleDialog';
import { DryRunPanel } from './matching/DryRunPanel';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const nodeTypes = {
    custom: MatchingRuleNode,
};

export const AdminMatchingRulesTab = () => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedRule, setSelectedRule] = useState<any>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const [selectedAlgorithm, setSelectedAlgorithm] = useState<"relationship" | "friendship" | "event">("relationship");

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges],
    );

    const fetchRules = async () => {
        setIsLoading(true);
        try {
            console.log('Fetching rules for algorithm:', selectedAlgorithm);
            const { data, error } = await supabase
                .from('matching_rules')
                .select('*')
                .eq('algorithm', selectedAlgorithm)
                .order('rule_type', { ascending: true }) // Dealbreakers first usually
                .order('created_at', { ascending: true });

            if (error) throw error;

            // Layout Calculation
            const newNodes: Node[] = [];
            const newEdges: Edge[] = [];

            // Layout Constants
            const CENTER_X_AXIS = 400; // Visual center
            const NODE_WIDTH = 220;    // Fixed width for alignment
            const HALF_WIDTH = NODE_WIDTH / 2;
            const COL_SPACING = 240;
            const START_Y = 100;
            const VERTICAL_SPACING = 50;

            // Helper to get Center X for a column index (0-3)
            const getColCenterX = (colIndex: number) => {
                const offset = (colIndex - 1.5) * COL_SPACING;
                return CENTER_X_AXIS + offset;
            };

            // Helper to center a node at a specific X
            const getCenteredX = (centerX: number) => centerX - HALF_WIDTH;

            // 1. Start Node
            // Positioned above the first column (Dealbreakers) as requested
            newNodes.push({
                id: 'start',
                type: 'input',
                data: { label: `Start ${selectedAlgorithm.charAt(0).toUpperCase() + selectedAlgorithm.slice(1)} Matching` },
                position: { x: getCenteredX(getColCenterX(0)), y: 0 },
                style: {
                    width: NODE_WIDTH,
                    background: '#f0fdf4',
                    border: '1px solid #86efac',
                    borderRadius: '8px',
                    padding: '10px',
                    textAlign: 'center',
                    fontWeight: 'bold',
                }
            });

            // Flatten data for sequential layout
            const dealbreakers = data?.filter(r => r.rule_type === 'dealbreaker') || [];
            const allModifiers = data?.filter(r => r.rule_type === 'modifier') || [];

            // Column 0 Data: Hardcoded (first) + Dealbreakers
            const hardcodedCol0 = selectedAlgorithm === "friendship"
                ? []
                : [{
                    id: 'hardcoded-dislikes',
                    type: 'default', // Visual type
                    isHardcoded: true,
                    data: { label: 'Exclude Dislikes (Hardcoded)' }
                }];
            const col0Rules = [...hardcodedCol0, ...dealbreakers];

            // Distribute Modifiers across Columns 1-3
            const modifierCols: any[][] = [[], [], []];
            allModifiers.forEach((rule, i) => modifierCols[i % 3].push(rule));


            // Add final hardcoded nodes to the last column (Column 3 -> index 2)
            modifierCols[2].push(
                {
                    id: 'prioritize-least-seen',
                    type: 'default',
                    isHardcoded: true,
                    data: { label: 'Prioritize Least Seen' }
                },
                {
                    id: 'notify-finish',
                    type: 'input', // Use output type for the final node? or default with different style
                    isHardcoded: true,
                    data: { label: 'Assign Match' },
                }
            );

            // All Columns Data
            const allColumns = [col0Rules, ...modifierCols];
            let lastNodeId = 'start';

            // Iterate columns and chain them
            allColumns.forEach((colRules, colIndex) => {
                const colX = getCenteredX(getColCenterX(colIndex));
                let colY = START_Y;

                colRules.forEach((rule: any, ruleIndex: number) => {
                    // Determine Node ID and Style
                    const id = rule.id;
                    const isHardcoded = rule.isHardcoded;

                    let style: React.CSSProperties = { width: NODE_WIDTH };
                    if (id === 'notify-finish') {
                        style = {
                            width: NODE_WIDTH,
                            background: '#f0fdf4',
                            border: '1px solid #86efac',
                            borderRadius: '8px',
                            padding: '10px',
                            textAlign: 'center',
                            fontWeight: 'bold',
                        };
                    } else if (id === 'prioritize-least-seen') {
                        style = {
                            width: NODE_WIDTH,
                            background: '#faf5ff', // purple-50
                            border: '1px solid #d8b4fe', // purple-300
                            borderRadius: '8px',
                            padding: '10px',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            color: '#6b21a8', // purple-800
                        };
                    } else if (isHardcoded) {
                        style = {
                            width: NODE_WIDTH,
                            background: '#fef2f2',
                            border: '1px dashed #f87171',
                            color: '#dc2626',
                        };
                    } else if (colIndex === 0) {
                        // Dealbreaker styling managed by CustomNode
                    }

                    // For Hardcoded, we use 'default' type (or custom if we want).
                    // Previous used 'default' with specific data.label.
                    let nodeType = isHardcoded ? 'default' : 'custom';
                    if (id === 'notify-finish') nodeType = 'output';

                    let nodeData = isHardcoded
                        ? rule.data
                        : { ...rule, onEdit: () => handleEdit(rule) };

                    newNodes.push({
                        id,
                        type: nodeType,
                        position: { x: colX, y: colY },
                        data: nodeData,
                        style
                    });

                    // Create Edge from Previous Node
                    // Logic:
                    // If first node of Col 0: Connect from 'start'
                    // If first node of Col N (N>0): Connect from Last Node of Col N-1
                    // Else: Connect from Previous Node in same Col

                    let edgeType = 'smoothstep';
                    // If connecting across columns (bottom of prev -> top of current), use smoothstep
                    // If connecting visually 'down' in same column, smoothstep is fine too.

                    newEdges.push({
                        id: `e-${lastNodeId}-${id}`,
                        source: lastNodeId,
                        target: id,
                        animated: true,
                        type: edgeType,
                        style: isHardcoded || (colIndex === 0 && !isHardcoded)
                            ? { stroke: '#f87171' } // Red path for Dealbreakers
                            : { stroke: '#93c5fd' } // Blue path for Modifiers
                    });

                    lastNodeId = id;
                    colY += VERTICAL_SPACING;
                });
            });

            setNodes(newNodes);
            setEdges(newEdges);

        } catch (error: any) {
            console.error('Error fetching matching rules:', error);
            toast({
                title: 'Error',
                description: 'Failed to load matching rules',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleEdit = (rule: any) => {
        setSelectedRule(rule);
        setIsDialogOpen(true);
    };

    const handleSaveRule = async (updatedRule: any) => {
        try {
            const { error } = await supabase
                .from('matching_rules')
                .update({
                    name: updatedRule.name,
                    description: updatedRule.description,
                    is_active: updatedRule.is_active,
                    weight: updatedRule.weight,
                    condition: updatedRule.condition,
                    source_type: updatedRule.source_type,
                    source_ref: updatedRule.source_ref,
                    target_type: updatedRule.target_type,
                    target_ref: updatedRule.target_ref,
                    operator: updatedRule.operator,
                    params: updatedRule.params,
                    rule_type: updatedRule.rule_type,
                    algorithm: selectedAlgorithm // Ensure we stay in current algo
                })
                .eq('id', updatedRule.id);

            if (error) throw error;

            toast({ title: "Rule Updated" });
            fetchRules(); // Refresh graph
        } catch (error: any) {
            console.error("Error updating rule:", error);
            toast({
                title: 'Error',
                description: 'Failed to update rule',
                variant: 'destructive',
            });
        }
    };

    useEffect(() => {
        fetchRules();
    }, [selectedAlgorithm]);

    return (
        <div className="space-y-6">
            <Tabs
                defaultValue="relationship"
                value={selectedAlgorithm}
                onValueChange={(val) => setSelectedAlgorithm(val as any)}
                className="w-full"
            >
                <div className="flex justify-between items-center mb-4">
                    <TabsList>
                        <TabsTrigger value="relationship">Relationship</TabsTrigger>
                        <TabsTrigger value="friendship">Friendship</TabsTrigger>
                        <TabsTrigger value="event">Event</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="relationship" className="mt-0">
                    <MatchingGraph
                        isLoading={isLoading}
                        fetchRules={fetchRules}
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodeTypes={nodeTypes}
                    />
                </TabsContent>
                <TabsContent value="friendship" className="mt-0">
                    <MatchingGraph
                        isLoading={isLoading}
                        fetchRules={fetchRules}
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodeTypes={nodeTypes}
                    />
                </TabsContent>
                <TabsContent value="event" className="mt-0">
                    <MatchingGraph
                        isLoading={isLoading}
                        fetchRules={fetchRules}
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodeTypes={nodeTypes}
                    />
                </TabsContent>
            </Tabs>

            <Separator />

            <div className="space-y-4">
                <h3 className="text-lg font-semibold">Dry Run & Testing</h3>
                <DryRunPanel />
            </div>

            <EditRuleDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                rule={selectedRule}
                onSave={handleSaveRule}
            />
        </div>
    );
};

// Extracted for cleaner JSX
const MatchingGraph = ({ isLoading, fetchRules, nodes, edges, onNodesChange, onEdgesChange, onConnect, nodeTypes }: any) => {
    return (
        <Card className="border-none shadow-none bg-transparent">
            <CardHeader className="px-0 pt-0">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <CardTitle>Algorithm Visualization</CardTitle>
                        <Button variant="ghost" size="icon" onClick={fetchRules} disabled={isLoading}>
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                        Visual representation of the matching pipeline.
                    </div>
                </div>
            </CardHeader>
            <CardContent className="h-[600px] border rounded-xl bg-background/50 p-0 overflow-hidden relative">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    nodeTypes={nodeTypes}
                    fitView
                    minZoom={0.5}
                    maxZoom={1.5}
                    attributionPosition="bottom-right"
                >
                    <Background gap={12} size={1} />
                    <Controls />
                </ReactFlow>
            </CardContent>
        </Card>
    );
};
