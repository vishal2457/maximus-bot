import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { SIDEBAR_ROUTES } from "@/components/router/router-data";

type AgentType = "opencode" | "codex";

export const HomePage = () => {
  const navigate = useNavigate();
  const [activeAgent, setActiveAgent] = useState<AgentType>("opencode");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAgent();
  }, []);

  const fetchAgent = async () => {
    try {
      const response = await fetch("/api/agent");
      if (!response.ok) throw new Error("Failed to fetch agent");
      const data = await response.json();
      setActiveAgent(data.activeAgent);
    } catch (error) {
      console.error("Error fetching agent:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const setAgent = async (agent: AgentType) => {
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent }),
      });
      if (!response.ok) throw new Error("Failed to set agent");
      const data = await response.json();
      setActiveAgent(data.activeAgent);
      toast.success(`Active agent changed to ${data.activeAgent}`);
    } catch (error) {
      console.error("Error setting agent:", error);
      toast.error("Failed to change agent");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-6">
      <h1 className="text-3xl font-bold">Maximus Bot</h1>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Active Agent</CardTitle>
          <CardDescription>Select which AI agent to use</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button
            variant={activeAgent === "opencode" ? "default" : "outline"}
            onClick={() => setAgent("opencode")}
            disabled={isLoading || activeAgent === "opencode"}
            className="flex-1"
          >
            OpenCode
          </Button>
          <Button
            variant={activeAgent === "codex" ? "default" : "outline"}
            onClick={() => setAgent("codex")}
            disabled={isLoading || activeAgent === "codex"}
            className="flex-1"
          >
            Codex
          </Button>
        </CardContent>
      </Card>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Available Routes</CardTitle>
          <CardDescription>Navigate to different pages</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {SIDEBAR_ROUTES.filter((route) => route.path !== "/").map((route) => (
            <Button
              key={route.path}
              variant="outline"
              onClick={() => navigate(route.path)}
            >
              {route.name}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
