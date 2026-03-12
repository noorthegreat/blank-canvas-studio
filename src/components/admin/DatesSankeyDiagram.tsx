import { ResponsiveContainer, Sankey, Rectangle, Layer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

interface DatesSankeyDiagramProps {
    dates: any[];
}

export const DatesSankeyDiagram = ({ dates }: DatesSankeyDiagramProps) => {

    const processData = () => {
        // Colors for each stage
        const colors = {
            total: "#64748b",      // Slate 500
            oneAvail: "#3b82f6",   // Blue 500
            bothAvail: "#6366f1",  // Indigo 500
            oneConf: "#a855f7",    // Purple 500
            bothConf: "#d946ef",   // Fuchsia 500
            completed: "#10b981",  // Emerald 500
            pending: "#f59e0b",    // Amber 500
            manual: "#ef4444",     // Red 500
            auto: "#fb7185",       // Rose 400
        };

        const nodes = [
            { name: "Total Created", fill: colors.total },          // 0
            { name: "1+ Added Avail", fill: colors.oneAvail },      // 1
            { name: "Both Added Avail", fill: colors.bothAvail },   // 2
            { name: "1+ Confirmed", fill: colors.oneConf },         // 3
            { name: "Both Confirmed", fill: colors.bothConf },      // 4
            { name: "Completed", fill: colors.completed },          // 5
            { name: "Still Pending", fill: colors.pending },        // 6
            { name: "Manually Cancelled", fill: colors.manual },    // 7
            { name: "Auto Cancelled", fill: colors.auto },          // 8
        ];

        const links: { source: number; target: number; value: number }[] = [];

        let flow = {
            total_to_1avail: 0,
            total_to_pending: 0,
            total_to_mc: 0,
            total_to_ac: 0,

            one_to_both: 0,
            one_to_pending: 0,
            one_to_mc: 0,
            one_to_ac: 0,

            both_to_1conf: 0,
            both_to_pending: 0,
            both_to_mc: 0,
            both_to_ac: 0,

            oneConf_to_bothConf: 0,
            oneConf_to_pending: 0,
            oneConf_to_mc: 0,
            oneConf_to_ac: 0,

            bothConf_to_completed: 0,
            bothConf_to_pending: 0,
            bothConf_to_mc: 0,
            bothConf_to_ac: 0,
        };

        dates.forEach(d => {
            // Determine exit reason
            let exitNode = 6; // Pending default
            if (d.status === 'cancelled') {
                const hasFeedback = d.user1_feedback || d.user2_feedback;
                if (hasFeedback || d.notes?.toLowerCase().includes('manual')) {
                    exitNode = 7;
                } else {
                    exitNode = 8;
                }
            } else if (d.status === 'completed') {
                exitNode = 5;
            } else if (d.status === 'confirmed') {
                exitNode = 6;
            }

            // Determine highest Stage
            const u1Avail = d.user1_availability && Object.keys(d.user1_availability).length > 0;
            const u2Avail = d.user2_availability && Object.keys(d.user2_availability).length > 0;
            const u1Conf = d.user1_confirmed;
            const u2Conf = d.user2_confirmed;

            // Flags
            const has1Avail = u1Avail || u2Avail;
            const hasBothAvail = u1Avail && u2Avail;
            const has1Conf = u1Conf || u2Conf;
            const hasBothConf = u1Conf && u2Conf;

            // Flow logic
            if (has1Avail) {
                // Reached Stage 1
                if (hasBothAvail) {
                    // Reached Stage 2
                    if (has1Conf) {
                        // Reached Stage 3
                        if (hasBothConf) {
                            // Reached Stage 4
                            if (d.status === 'completed') {
                                flow.bothConf_to_completed++;
                            } else {
                                // Exited at Stage 4
                                if (exitNode === 7) flow.bothConf_to_mc++;
                                else if (exitNode === 8) flow.bothConf_to_ac++;
                                else flow.bothConf_to_pending++;
                            }
                        } else {
                            // Exited at Stage 3
                            if (exitNode === 7) flow.oneConf_to_mc++;
                            else if (exitNode === 8) flow.oneConf_to_ac++;
                            else flow.oneConf_to_pending++;
                        }
                    } else {
                        // Exited at Stage 2
                        if (exitNode === 7) flow.both_to_mc++;
                        else if (exitNode === 8) flow.both_to_ac++;
                        else flow.both_to_pending++;
                    }
                } else {
                    // Exited at Stage 1
                    if (exitNode === 7) flow.one_to_mc++;
                    else if (exitNode === 8) flow.one_to_ac++;
                    else flow.one_to_pending++;
                }
            } else {
                // Exited at Stage 0
                if (exitNode === 7) flow.total_to_mc++;
                else if (exitNode === 8) flow.total_to_ac++;
                else flow.total_to_pending++;
            }
        });

        // 0 -> ...
        const Stage1_Count = flow.one_to_both + flow.one_to_pending + flow.one_to_mc + flow.one_to_ac +
            flow.both_to_1conf + flow.both_to_pending + flow.both_to_mc + flow.both_to_ac +
            flow.oneConf_to_bothConf + flow.oneConf_to_pending + flow.oneConf_to_mc + flow.oneConf_to_ac +
            flow.bothConf_to_completed + flow.bothConf_to_pending + flow.bothConf_to_mc + flow.bothConf_to_ac;

        if (Stage1_Count > 0) links.push({ source: 0, target: 1, value: Stage1_Count });
        if (flow.total_to_pending > 0) links.push({ source: 0, target: 6, value: flow.total_to_pending });
        if (flow.total_to_mc > 0) links.push({ source: 0, target: 7, value: flow.total_to_mc });
        if (flow.total_to_ac > 0) links.push({ source: 0, target: 8, value: flow.total_to_ac });

        // 1 -> ...
        const Stage2_Count = flow.both_to_1conf + flow.both_to_pending + flow.both_to_mc + flow.both_to_ac +
            flow.oneConf_to_bothConf + flow.oneConf_to_pending + flow.oneConf_to_mc + flow.oneConf_to_ac +
            flow.bothConf_to_completed + flow.bothConf_to_pending + flow.bothConf_to_mc + flow.bothConf_to_ac;

        if (Stage2_Count > 0) links.push({ source: 1, target: 2, value: Stage2_Count });
        if (flow.one_to_pending > 0) links.push({ source: 1, target: 6, value: flow.one_to_pending });
        if (flow.one_to_mc > 0) links.push({ source: 1, target: 7, value: flow.one_to_mc });
        if (flow.one_to_ac > 0) links.push({ source: 1, target: 8, value: flow.one_to_ac });

        // 2 -> ...
        const Stage3_Count = flow.oneConf_to_bothConf + flow.oneConf_to_pending + flow.oneConf_to_mc + flow.oneConf_to_ac +
            flow.bothConf_to_completed + flow.bothConf_to_pending + flow.bothConf_to_mc + flow.bothConf_to_ac;

        if (Stage3_Count > 0) links.push({ source: 2, target: 3, value: Stage3_Count });
        if (flow.both_to_pending > 0) links.push({ source: 2, target: 6, value: flow.both_to_pending });
        if (flow.both_to_mc > 0) links.push({ source: 2, target: 7, value: flow.both_to_mc });
        if (flow.both_to_ac > 0) links.push({ source: 2, target: 8, value: flow.both_to_ac });

        // 3 -> ...
        const Stage4_Count = flow.bothConf_to_completed + flow.bothConf_to_pending + flow.bothConf_to_mc + flow.bothConf_to_ac;

        if (Stage4_Count > 0) links.push({ source: 3, target: 4, value: Stage4_Count });
        if (flow.oneConf_to_pending > 0) links.push({ source: 3, target: 6, value: flow.oneConf_to_pending });
        if (flow.oneConf_to_mc > 0) links.push({ source: 3, target: 7, value: flow.oneConf_to_mc });
        if (flow.oneConf_to_ac > 0) links.push({ source: 3, target: 8, value: flow.oneConf_to_ac });

        // 4 -> ...
        if (flow.bothConf_to_completed > 0) links.push({ source: 4, target: 5, value: flow.bothConf_to_completed });
        if (flow.bothConf_to_pending > 0) links.push({ source: 4, target: 6, value: flow.bothConf_to_pending });
        if (flow.bothConf_to_mc > 0) links.push({ source: 4, target: 7, value: flow.bothConf_to_mc });
        if (flow.bothConf_to_ac > 0) links.push({ source: 4, target: 8, value: flow.bothConf_to_ac });

        return { nodes, links };
    };

    const data = processData();

    return (
        <Card className="col-span-1 md:col-span-3">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                    Date Lifecycle Flow
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="h-[500px]">
                {data.links.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <Sankey
                            data={data}
                            node={<CustomNode />}
                            nodePadding={50}
                            sort={false} // Use explicit sort order
                            iterations={64} // Increase for better layout convergence
                            margin={{
                                left: 10,
                                right: 180, // Space for labels
                                top: 10,
                                bottom: 10,
                            }}
                            link={{ stroke: 'hsl(var(--muted-foreground))', strokeOpacity: 0.1 }}
                        >
                        </Sankey>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        Not enough data to generate flow.
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

const CustomNode = ({ x, y, width, height, index, payload, containerWidth }: any) => {
    const isOut = x + width + 6 > containerWidth;
    return (
        <Layer key={`CustomNode${index}`}>
            <Rectangle
                x={x}
                y={y}
                width={width}
                height={height}
                fill={payload.fill || "hsl(var(--primary))"}
                fillOpacity="1"
            />
            <text
                textAnchor={isOut ? 'end' : 'start'}
                x={isOut ? x - 6 : x + width + 6}
                y={y + height / 2 + 4} // Slight offset for vertical centering
                fontSize="12"
                fill="currentColor"
                className="fill-foreground text-xs font-medium"
            >
                {payload.name} ({payload.value})
            </text>
        </Layer>
    );
};
