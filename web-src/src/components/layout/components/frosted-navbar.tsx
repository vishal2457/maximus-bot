import { useState } from "react";
import { useAgent, useSetAgent, type AgentType } from "@/lib/api";
import { ChevronDown, Activity, Bell } from "lucide-react";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function FrostedNavbar() {
  const { data: agentData } = useAgent();
  const setAgentMutation = useSetAgent();
  const [activeAgent, setActiveAgent] = useState<AgentType>(
    agentData?.activeAgent ?? "opencode",
  );

  const agents: AgentType[] = ["opencode", "codex"];

  const handleSetAgent = (agent: AgentType) => {
    setAgentMutation.mutate(agent, {
      onSuccess: (data) => {
        setActiveAgent(data.activeAgent);
        toast.success(`Active agent changed to ${data.activeAgent}`);
      },
      onError: () => {
        toast.error("Failed to change agent");
      },
    });
  };

  return (
    <header className="h-16 border-b border-[#333] bg-[#050505] sticky top-0 z-30 flex items-center justify-between px-4 md:px-8">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="md:hidden text-white hover:text-[#FF4400] hover:bg-[#222] p-2" />
        <div className="hidden md:flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[#555]">
          <span>SYS_CTRL</span>
          <span className="text-[#333]">/</span>
          <span className="text-white">TELEMETRY</span>
        </div>
      </div>

      <div className="flex items-center gap-4 md:gap-6">
        <div className="flex items-center gap-2 px-3 py-1 bg-[#00FF41]/10 border border-[#00FF41]/30">
          <div className="w-2 h-2 bg-[#00FF41] animate-pulse" />
          <span className="text-xs font-mono text-[#00FF41] uppercase tracking-widest">
            Uplink_OK
          </span>
        </div>

        <div className="relative group">
          <button className="flex items-center gap-2 px-4 py-2 bg-[#0D0D0D] border border-[#333] hover:border-[#555] transition-colors text-sm font-bold uppercase tracking-wider text-white">
            <Activity size={16} className="text-[#FF4400]" />
            {activeAgent}
            <ChevronDown size={16} className="text-[#555]" />
          </button>
          <div className="absolute right-0 mt-1 w-48 bg-[#0D0D0D] border border-[#333] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
            {agents.map((agent) => (
              <button
                key={agent}
                onClick={() => handleSetAgent(agent)}
                className={`w-full text-left px-4 py-3 text-sm font-bold uppercase tracking-wider transition-colors border-l-2 ${
                  activeAgent === agent
                    ? "border-[#FF4400] bg-[#FF4400]/10 text-[#FF4400]"
                    : "border-transparent text-[#777] hover:bg-[#222] hover:text-white"
                }`}
              >
                {agent}
              </button>
            ))}
          </div>
        </div>

        <button className="text-[#777] hover:text-white transition-colors relative">
          <Bell size={20} />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#FF4400] border border-[#050505]" />
        </button>
      </div>
    </header>
  );
}
