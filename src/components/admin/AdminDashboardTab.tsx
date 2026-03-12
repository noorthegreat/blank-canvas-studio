import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, PauseCircle, PlayCircle, GraduationCap, Heart, Handshake } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DatesSankeyDiagram } from "./DatesSankeyDiagram";

import { useAdminStats } from "@/hooks/admin/useAdminStats";
import { useAdminDates } from "@/hooks/admin/useAdminDates";

export const AdminDashboardTab = () => {
    const { profileStats, loading: statsLoading } = useAdminStats();
    const { dates, loading: datesLoading } = useAdminDates();
    const [showAllTime, setShowAllTime] = useState(false);

    if (statsLoading || datesLoading) {
        return <div className="p-8 text-center text-muted-foreground">Loading dashboard data...</div>;
    }

    const displayData = showAllTime
        ? profileStats.growthData
        : profileStats.growthData.filter(item => item.date > '2025-10-27');
    const CHART_COLORS = ["#7c3aed", "#2563eb", "#0d9488", "#f59e0b", "#ef4444", "#db2777", "#6b7280", "#14b8a6"];

    const renderLegend = (data: Array<{ label: string; count: number }>) => (
        <div className="space-y-2 overflow-auto pr-1">
            {data.map((entry, idx) => (
                <div key={entry.label} className="flex items-center justify-between text-sm rounded border px-2 py-1">
                    <div className="flex items-center gap-2">
                        <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                        />
                        <span>{entry.label}</span>
                    </div>
                    <span className="font-semibold">{entry.count}</span>
                </div>
            ))}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Profiles
                        </CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{profileStats.total}</div>
                        <p className="text-xs text-muted-foreground">
                            Registered users
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Romantic Survey Done
                        </CardTitle>
                        <Heart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{profileStats.romanticSurveyCompleted}</div>
                        <p className="text-xs text-muted-foreground">
                            Of {profileStats.total} total users
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Friendship Survey Done
                        </CardTitle>
                        <Handshake className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{profileStats.friendshipSurveyCompleted}</div>
                        <p className="text-xs text-muted-foreground">
                            Of {profileStats.total} total users
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Active Profiles
                        </CardTitle>
                        <PlayCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{profileStats.active}</div>
                        <p className="text-xs text-muted-foreground">
                            Currently active
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Paused Profiles
                        </CardTitle>
                        <PauseCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{profileStats.paused}</div>
                        <p className="text-xs text-muted-foreground">
                            Temporarily paused
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Student Profiles
                        </CardTitle>
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{profileStats.students}</div>
                        <p className="text-xs text-muted-foreground">
                            UZH / ETH domains
                        </p>
                    </CardContent>
                </Card>

                <Card className="md:col-span-4">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Profile Growth
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <Button
                                variant={showAllTime ? "default" : "outline"}
                                size="sm"
                                onClick={() => setShowAllTime(!showAllTime)}
                            >
                                {showAllTime ? "Show Recent" : "Show All Time"}
                            </Button>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </div>
                    </CardHeader>
                    <CardContent className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={displayData}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis
                                    dataKey="displayDate"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    domain={['dataMin', 'auto']}
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `${value}`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--background))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: 'var(--radius)',
                                    }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="count"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={2}
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Profile Status</CardTitle>
                    </CardHeader>
                    <CardContent className="min-h-[340px] md:h-[250px]">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-full">
                            <div className="h-[170px] md:h-full">
                                <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={profileStats.statusDistribution || []}
                                        dataKey="count"
                                        nameKey="label"
                                        outerRadius="78%"
                                        innerRadius="52%"
                                        label={false}
                                    >
                                        {(profileStats.statusDistribution || []).map((entry, idx) => (
                                            <Cell key={`${entry.label}-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                                </ResponsiveContainer>
                            </div>
                            {renderLegend(profileStats.statusDistribution || [])}
                        </div>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Student vs Non-student</CardTitle>
                    </CardHeader>
                    <CardContent className="min-h-[340px] md:h-[250px]">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-full">
                            <div className="h-[170px] md:h-full">
                                <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={profileStats.studentDistribution || []}
                                        dataKey="count"
                                        nameKey="label"
                                        outerRadius="78%"
                                        innerRadius="52%"
                                        label={false}
                                    >
                                        {(profileStats.studentDistribution || []).map((entry, idx) => (
                                            <Cell key={`${entry.label}-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                                </ResponsiveContainer>
                            </div>
                            {renderLegend(profileStats.studentDistribution || [])}
                        </div>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Gender Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="min-h-[340px] md:h-[250px]">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-full">
                            <div className="h-[170px] md:h-full">
                                <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={profileStats.genderDistribution || []}
                                        dataKey="count"
                                        nameKey="label"
                                        outerRadius="78%"
                                        innerRadius="52%"
                                        label={false}
                                    >
                                        {(profileStats.genderDistribution || []).map((entry, idx) => (
                                            <Cell key={`${entry.label}-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                                </ResponsiveContainer>
                            </div>
                            {renderLegend(profileStats.genderDistribution || [])}
                        </div>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Romantic Orientation</CardTitle>
                    </CardHeader>
                    <CardContent className="min-h-[340px] md:h-[250px]">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-full">
                            <div className="h-[170px] md:h-full">
                                <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={profileStats.sexualityDistribution || []}
                                        dataKey="count"
                                        nameKey="label"
                                        outerRadius="78%"
                                        innerRadius="52%"
                                        label={false}
                                    >
                                        {(profileStats.sexualityDistribution || []).map((entry, idx) => (
                                            <Cell key={`${entry.label}-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                                </ResponsiveContainer>
                            </div>
                            {renderLegend(profileStats.sexualityDistribution || [])}
                        </div>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Friendship Preference Type</CardTitle>
                    </CardHeader>
                    <CardContent className="min-h-[340px] md:h-[250px]">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-full">
                            <div className="h-[170px] md:h-full">
                                <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={profileStats.friendshipPreferenceDistribution || []}
                                        dataKey="count"
                                        nameKey="label"
                                        outerRadius="78%"
                                        innerRadius="52%"
                                        label={false}
                                    >
                                        {(profileStats.friendshipPreferenceDistribution || []).map((entry, idx) => (
                                            <Cell key={`${entry.label}-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                                </ResponsiveContainer>
                            </div>
                            {renderLegend(profileStats.friendshipPreferenceDistribution || [])}
                        </div>
                    </CardContent>
                </Card>

                <div className="md:col-span-4">
                    <DatesSankeyDiagram dates={dates || []} />
                </div>
            </div>
        </div>
    );
};
