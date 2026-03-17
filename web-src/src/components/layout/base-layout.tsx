import { AppSidebar } from "./app-sidebar";

export const BaseLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex h-screen w-full bg-[#030303] text-[#E0E0E0] overflow-hidden font-sans selection:bg-[#FF4400]/30">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-transparent">
        {children}
      </div>
    </div>
  );
};
