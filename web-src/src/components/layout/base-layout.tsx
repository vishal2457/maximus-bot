import { AppSidebar } from "./app-sidebar";
import { FrostedNavbar } from "./components/frosted-navbar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

export const BaseLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <FrostedNavbar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-transparent">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};
