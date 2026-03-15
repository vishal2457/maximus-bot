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
import { useAgent, useSetAgent, type AgentType } from "@/lib/api";

export const HomePage = () => {
  const navigate = useNavigate();
  const { data: agentData, isLoading } = useAgent();
  const setAgentMutation = useSetAgent();

  const activeAgent = agentData?.activeAgent ?? "opencode";

  const handleSetAgent = (agent: AgentType) => {
    setAgentMutation.mutate(agent, {
      onSuccess: (data) => {
        toast.success(`Active agent changed to ${data.activeAgent}`);
      },
      onError: () => {
        toast.error("Failed to change agent");
      },
    });
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
            onClick={() => handleSetAgent("opencode")}
            disabled={
              isLoading ||
              setAgentMutation.isPending ||
              activeAgent === "opencode"
            }
            className="flex-1"
          >
            OpenCode
          </Button>
          <Button
            variant={activeAgent === "codex" ? "default" : "outline"}
            onClick={() => handleSetAgent("codex")}
            disabled={
              isLoading || setAgentMutation.isPending || activeAgent === "codex"
            }
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
