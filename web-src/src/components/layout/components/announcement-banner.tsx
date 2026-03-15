import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSidebar } from "@/components/ui/sidebar";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AnnouncementBanner() {
  const { state } = useSidebar();
  const [isVisible, setIsVisible] = React.useState(true);
  const isCollapsed = state === "collapsed";

  if (!isVisible) return null;

  const handleDismiss = () => {
    setIsVisible(false);
  };

  return (
    <Alert
      variant="default"
      className={cn(
        "relative mb-2 border-blue-500/30 bg-gradient-to-br from-blue-500/20 via-blue-600/15 to-blue-700/10 transition-all duration-300",
        "hover:from-blue-500/25 hover:via-blue-600/20 hover:to-blue-700/15",
        "shadow-lg shadow-blue-500/10",
        "grid-cols-[1fr] gap-0", // Override default grid layout
        isCollapsed &&
          "group-data-[collapsible=icon]:mx-1 group-data-[collapsible=icon]:p-2"
      )}
    >
      {/* Beautiful blue gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-400/5 via-blue-500/3 to-blue-600/5 rounded-md pointer-events-none" />

      {/* Expanded state content */}
      <div
        className={cn(
          "transition-all duration-200 relative z-10 col-start-1",
          isCollapsed && "group-data-[collapsible=icon]:hidden"
        )}
      >
        <AlertTitle className="text-sidebar-foreground font-semibold col-start-1">
          New Features Available!
        </AlertTitle>
        <AlertDescription className="text-muted-foreground text-xs col-start-1">
          Latest updates and improvements are now live. Check the dashboard to
          explore.
        </AlertDescription>
      </div>

      {/* Collapsed state content */}
      <div
        className={cn(
          "hidden relative z-10 col-start-1",
          isCollapsed && "group-data-[collapsible=icon]:block"
        )}
      >
        <div className="text-blue-500 text-xs font-medium truncate">New!</div>
      </div>

      {/* Dismiss button - only show in expanded state */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDismiss}
        className={cn(
          "absolute top-1 right-1 h-6 w-6 text-blue-500/70 hover:text-blue-500 hover:bg-blue-500/10",
          "transition-all duration-200 relative z-10",
          isCollapsed && "group-data-[collapsible=icon]:hidden"
        )}
      >
        <X className="h-3 w-3" />
        <span className="sr-only">Dismiss announcement</span>
      </Button>
    </Alert>
  );
}
