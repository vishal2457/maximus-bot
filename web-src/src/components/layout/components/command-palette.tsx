"use client";

import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Search, Settings, User, Calendar, MessageSquare, BarChart3, FileText, Users, Building2, ShoppingCart, Home, Kanban, Receipt, Shield, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface CommandPaletteProps {
  className?: string;
}

export function CommandPalette({ className }: CommandPaletteProps) {
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  const navigationItems = [
    {
      title: "Dashboard",
      icon: BarChart3,
      action: () => navigate("/dashboard"),
      shortcut: "D",
    },
    {
      title: "Home",
      icon: Home,
      action: () => navigate("/"),
      shortcut: "H",
    },
    {
      title: "Calendar",
      icon: Calendar,
      action: () => navigate("/calendar"),
      shortcut: "C",
    },
    {
      title: "Chat",
      icon: MessageSquare,
      action: () => navigate("/chat"),
      shortcut: "M",
    },
    {
      title: "Products",
      icon: ShoppingCart,
      action: () => navigate("/products"),
      shortcut: "P",
    },
    {
      title: "Leads",
      icon: Kanban,
      action: () => navigate("/leads"),
      shortcut: "L",
    },
    {
      title: "Invoices",
      icon: Receipt,
      action: () => navigate("/invoice"),
      shortcut: "I",
    },
    {
      title: "Users",
      icon: Users,
      action: () => navigate("/user"),
      shortcut: "U",
    },
    {
      title: "Companies",
      icon: Building2,
      action: () => navigate("/company"),
      shortcut: "B",
    },
    {
      title: "Contacts",
      icon: FileText,
      action: () => navigate("/contact"),
      shortcut: "O",
    },
    {
      title: "Roles",
      icon: Shield,
      action: () => navigate("/roles"),
      shortcut: "R",
    },
    {
      title: "Permissions",
      icon: Key,
      action: () => navigate("/permissions"),
      shortcut: "E",
    },
  ];

  const systemItems = [
    {
      title: "Profile",
      icon: User,
      action: () => navigate("/profile"),
      shortcut: "F",
    },
    {
      title: "Settings",
      icon: Settings,
      action: () => navigate("/settings"),
      shortcut: "S",
    },
  ];

  return (
    <>
      <Button
        variant="outline"
        className={cn(
          "relative h-9 w-9 p-0 xl:h-10 xl:w-60 xl:justify-start xl:px-3 xl:py-2",
          className
        )}
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4 xl:mr-2" />
        <span className="hidden xl:inline-flex">Search...</span>
        <CommandShortcut className="hidden xl:inline-flex">⌘K</CommandShortcut>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.title}
                  onSelect={() => runCommand(item.action)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.title}
                  <CommandShortcut>{item.shortcut}</CommandShortcut>
                </CommandItem>
              );
            })}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="System">
            {systemItems.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.title}
                  onSelect={() => runCommand(item.action)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.title}
                  <CommandShortcut>{item.shortcut}</CommandShortcut>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
