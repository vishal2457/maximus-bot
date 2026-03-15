import { AppSidebar } from "./app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "../ui/sidebar";
import { FrostedNavbar } from "./components/frosted-navbar";
import * as React from "react";

export const BaseLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex h-screen flex-1 flex-col">
          <FrostedNavbar />

          <div className="flex-1 flex flex-col gap-4">
            <div className="flex items-center gap-2 p-2 md:hidden">
              <SidebarTrigger />
              <span className="text-sm font-medium">Menu</span>
            </div>
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};
