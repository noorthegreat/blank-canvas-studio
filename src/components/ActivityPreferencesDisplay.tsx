import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Activity = "coffee" | "food" | "bar";

const ACTIVITY_INFO: Record<Activity, { label: string; emoji: string }> = {
  coffee: { label: "Coffee", emoji: "☕" },
  food: { label: "Food", emoji: "🍽️" },
  bar: { label: "Bar", emoji: "🍸" },
};

interface ActivityPreferencesDisplayProps {
  userPreferences: Activity[];
  matchPreferences: Activity[];
  userName: string;
  matchName: string;
}

export const ActivityPreferencesDisplay = ({
  userPreferences,
  matchPreferences,
  userName,
  matchName,
}: ActivityPreferencesDisplayProps) => {
  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">Activity Preferences</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-4">
          {/* User's preferences */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">{userName}</h4>
            {userPreferences.map((activityId, index) => {
              const activity = ACTIVITY_INFO[activityId];
              return (
                <div
                  key={activityId}
                  className="flex items-center gap-2 p-2 bg-secondary/50 rounded-md"
                >
                  <span className="text-xl">{activity.emoji}</span>
                  <span className="font-medium">{activity.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    #{index + 1}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Match's preferences */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">{matchName}</h4>
            {matchPreferences.map((activityId, index) => {
              const activity = ACTIVITY_INFO[activityId];
              return (
                <div
                  key={activityId}
                  className="flex items-center gap-2 p-2 bg-secondary/50 rounded-md"
                >
                  <span className="text-xl">{activity.emoji}</span>
                  <span className="font-medium">{activity.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    #{index + 1}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
