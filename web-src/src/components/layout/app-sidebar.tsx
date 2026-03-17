import { Link, useLocation } from "react-router-dom";
import {
  Terminal,
  LayoutDashboard,
  FolderKanban,
  Clock,
  KeyRound,
  Plug,
  ScrollText,
} from "lucide-react";

export function AppSidebar() {
  const location = useLocation();

  const navItems = [
    { id: "/", label: "Telemetry", icon: LayoutDashboard },
    { id: "/logs", label: "System Logs", icon: ScrollText },
    { id: "/api/project", label: "Workspaces", icon: FolderKanban },
    { id: "/data", label: "Cron Jobs", icon: Clock },
    { id: "/handle-secrets", label: "Vault", icon: KeyRound },
    { id: "/integrations", label: "Comms Link", icon: Plug },
  ];

  return (
    <aside className="fixed md:static inset-y-0 left-0 z-50 w-64 bg-[#050505] border-r border-[#333] flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-[#333] justify-between md:justify-start">
        <div className="flex items-center gap-3 text-[#FF4400]">
          <Terminal size={24} />
          <span className="font-bold text-xl tracking-widest uppercase text-white">
            Bot_Ctrl
          </span>
        </div>
      </div>

      <div className="flex-1 py-6 px-4 flex flex-col gap-2 overflow-y-auto">
        <div className="text-[10px] font-mono text-[#555] uppercase tracking-widest mb-2 px-2">
          Navigation_Matrix
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.id;
          return (
            <Link
              key={item.id}
              to={item.id}
              className={`flex items-center gap-3 px-3 py-3 border transition-all duration-200 text-sm font-bold uppercase tracking-wider ${
                isActive
                  ? "border-[#FF4400] bg-[#FF4400]/10 text-[#FF4400]"
                  : "border-transparent text-[#777] hover:border-[#333] hover:text-[#CCC]"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-[#333]">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 bg-[#222] border border-[#444] flex items-center justify-center text-sm font-bold text-white">
            VA
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold uppercase tracking-wider text-white">
              Vishal Acharya
            </span>
            <span className="text-[10px] font-mono text-[#FF4400] uppercase tracking-widest">
              Local Admin
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
