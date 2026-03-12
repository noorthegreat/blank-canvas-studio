import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Badge } from '@/components/ui/badge';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export const MatchingRuleNode = memo(({ data }: { data: any }) => {
    const isDealbreaker = data.rule_type === 'dealbreaker';
    const isActivityBoost = data.operator === 'boost_decay_recency';
    const isMaxDistance = data.operator === 'distance_lte';
    const isActive = data.is_active;

    return (
        <TooltipProvider delayDuration={300}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div
                        onClick={data.onEdit}
                        className={`
                            relative px-4 py-2 rounded-full border shadow-xs cursor-pointer transition-all hover:scale-105
                            flex items-center gap-2 min-w-[180px] justify-center
                            ${(isActivityBoost || isMaxDistance) ? 'bg-purple-50 border-purple-200 text-purple-900' : isDealbreaker
                                ? 'bg-red-50 border-red-200 text-red-900'
                                : 'bg-blue-50 border-blue-200 text-blue-900'}
                            ${!isActive ? 'opacity-60 grayscale' : ''}
                        `}
                    >
                        <Handle type="target" position={Position.Top} className="bg-muted-foreground! w-2! h-2!" />

                        <span className="font-medium text-sm truncate max-w-[200px]">
                            {data.name}
                        </span>

                        {!isDealbreaker && !isActivityBoost && !isMaxDistance && (
                            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-blue-100 text-blue-700 hover:bg-blue-200">
                                {data.weight}
                            </Badge>
                        )}

                        <Handle type="source" position={Position.Bottom} className="bg-muted-foreground! w-2! h-2!" />
                    </div>
                </TooltipTrigger>
                <TooltipPrimitive.Portal>
                    <TooltipContent className="max-w-[300px] z-99999 pointer-events-none">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-4">
                                <span className="font-semibold">{isDealbreaker ? 'Dealbreaker' : 'Modifier'}</span>
                                <span className="text-xs text-muted-foreground font-mono">{data.operator}</span>
                            </div>
                            <p className="text-sm">{data.description || 'No description provided.'}</p>
                            {!isActive && <p className="text-xs text-red-500 font-medium">Currently Inactive</p>}
                        </div>
                    </TooltipContent>
                </TooltipPrimitive.Portal>
            </Tooltip>
        </TooltipProvider>
    );
});
