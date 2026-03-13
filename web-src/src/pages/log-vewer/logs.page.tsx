import { useState, useEffect } from "react";
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

export const LogsPage = () => {
  const [logs, setLogs] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [logType, setLogType] = useState<"debug" | "error">("debug");

  useEffect(() => {
    fetchLogs();
  }, [logType]);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/logs/${logType}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const text = await response.text();
      setLogs(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLogs("");
    } finally {
      setLoading(false);
    }
  };

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
            onValueChange={(value: string) =>
              setLogType(value as "debug" | "error")
            }
          >
            <SelectTrigger id="log-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="debug">Debug</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchLogs} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>Error: {error}</AlertDescription>
          </Alert>
        )}

        <ScrollArea className="h-96 w-full rounded-md border bg-muted/30">
          <pre className="p-4 text-sm text-green-400 whitespace-pre-wrap">
            {logs}
          </pre>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
