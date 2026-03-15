import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { CommandPalette } from "./command-palette";

interface NavItem {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface FrostedNavbarProps {
  brand?: {
    name: string;
    logo?: React.ComponentType<{ className?: string }>;
    href?: string;
  };
  items?: NavItem[];
  actions?: React.ReactNode;
  className?: string;
}

export function FrostedNavbar({
  brand,
  items = [],
  actions,
  className,
}: FrostedNavbarProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <header
      className={cn(
        // Frosted glass effect
        "sticky top-0 z-50 w-full",
        "backdrop-blur-xl bg-background/70 dark:bg-background/70",
        "border-b border-border/40",
        // Animation for smooth transitions
        "transition-all duration-200 ease-in-out",
        // Shadow for depth
        "shadow-sm shadow-background/20",
        className
      )}
    >
      <nav className="flex h-16 items-center justify-between px-4 md:px-6 lg:px-8">
        {/* Left side - Brand and Command Palette */}
        <div className="flex items-center space-x-4">
          {/* Brand */}
          {brand && (
            <div className="flex items-center space-x-2">
              {brand.logo && <brand.logo className="h-8 w-8" />}
              {brand.name && (
                <span className="text-lg font-semibold">{brand.name}</span>
              )}
            </div>
          )}

          {/* Command Palette */}
          <CommandPalette />
        </div>

        {/* Right side - Actions and Mobile Menu */}
        <div className="flex items-center space-x-2">
          {/* Actions */}
          {actions && (
            <div className="hidden md:flex items-center space-x-2">
              {actions}
            </div>
          )}

          {/* Mobile Menu Button */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden p-2 h-auto"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-80 backdrop-blur-xl bg-background/95"
            >
              <div className="flex flex-col space-y-4 mt-8">
                {/* Mobile Actions */}
                {actions && (
                  <div className="pt-4 border-t border-border/40">
                    {actions}
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}

export type { NavItem, FrostedNavbarProps };
