import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

interface FrostedNavbarProps {
  brand?: {
    name: string;
    logo?: React.ComponentType<{ className?: string }>;
    href?: string;
  };
  className?: string;
}

export function FrostedNavbar({ brand, className }: FrostedNavbarProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full",
        "backdrop-blur-xl bg-background/70 dark:bg-background/70",
        "border-b border-border/40",
        "transition-all duration-200 ease-in-out",
        "shadow-sm shadow-background/20",
        className,
      )}
    >
      <nav className="flex h-16 items-center justify-between px-4 md:px-6 lg:px-8">
        <div className="flex items-center space-x-4">
          {brand && (
            <div className="flex items-center space-x-2">
              {brand.logo && <brand.logo className="h-8 w-8" />}
              {brand.name && (
                <span className="text-lg font-semibold">{brand.name}</span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
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
            />
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
