import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLogs, type LogType } from "@/lib/api";

export const LogsPage = () => {
  const [logType, setLogType] = useState<LogType>("debug");
  const { data: logs, isError, error, refetch, isFetching } = useLogs(logType);

  return (
    <Card className="m-6 w-full max-w-4xl">
      <CardHeader>
        <CardTitle>Log Viewer</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Label htmlFor="log-type">Log Type:</Label>
          <Select
            value={logType}
            onValueChange={(value: string) => setLogType(value as LogType)}
          >
            <SelectTrigger id="log-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="debug">Debug</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {isError && (
          <Alert variant="destructive">
            <AlertDescription>Error: {error?.message}</AlertDescription>
          </Alert>
        )}

        <ScrollArea className="h-96 w-full rounded-md border bg-muted/30">
          <pre className="p-4 text-sm text-green-400 whitespace-pre-wrap">
            {logs ?? ""}
          </pre>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
