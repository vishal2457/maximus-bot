import { Link, useLocation } from "react-router-dom";
import { Terminal } from "lucide-react";
import { SIDEBAR_ROUTES } from "../router/router-data";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

function NavigationLinks() {
  const location = useLocation();
  const { setOpenMobile, isMobile } = useSidebar();

  return (
    <>
      {SIDEBAR_ROUTES.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <SidebarMenuItem key={item.path}>
            <SidebarMenuButton
              asChild
              isActive={isActive}
              onClick={() => {
                if (isMobile) {
                  setOpenMobile(false);
                }
              }}
              className={`flex items-center gap-3 px-3 py-3 border transition-all duration-200 text-sm font-bold uppercase tracking-wider ${
                isActive
                  ? "border-[#FF4400] bg-[#FF4400]/10 text-[#FF4400]"
                  : "border-transparent text-[#777] hover:border-[#333] hover:text-[#CCC]"
              }`}
            >
              <Link to={item.path}>
                {Icon && <Icon size={18} />}
                <span>{item.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </>
  );
}

export function AppSidebar() {
  return (
    <Sidebar className="border-r border-[#333]">
      <SidebarHeader className="border-b border-[#333]">
        <div className="flex items-center gap-3 text-[#FF4400] px-2">
          <Terminal size={24} />
          <span className="font-bold text-xl tracking-widest uppercase text-white">
            Bot_Ctrl
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <div className="text-[10px] font-mono text-[#555] uppercase tracking-widest mb-2 px-2">
            Navigation_Matrix
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavigationLinks />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-[#333]">
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
      </SidebarFooter>
    </Sidebar>
  );
}
