import { QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/react";
import { Toaster } from "sonner";
import { MainRouter } from "@/components/router/main-router";
import { queryClient } from "@/lib/query-client";
import { ThemeProvider } from "next-themes";
import { TeamProvider } from "@/components/layout/team-context";

function App() {
  return (
    <>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TeamProvider>
          <NuqsAdapter>
            <QueryClientProvider client={queryClient}>
              <MainRouter />
            </QueryClientProvider>
            <Toaster
              visibleToasts={5}
              position="bottom-right"
              richColors
              theme="dark"
              closeButton
            />
          </NuqsAdapter>
        </TeamProvider>
      </ThemeProvider>
    </>
  );
}

export default App;
