"use client";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../../lib/utils";

interface NavGroup {
  title: string;
  items: {
    title: string;
    url: string;
    icon?: React.ComponentType<{ className?: string }>;
  }[];
}

export function NavMain({ groups }: { groups: NavGroup[] }) {
  const location = useLocation();

  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.title}>
          <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
          <SidebarMenu>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <SidebarMenuItem
                  key={item.title}
                  className={cn(
                    location.pathname === item.url && "bg-secondary rounded-md"
                  )}
                >
                  <Link to={item.url}>
                    <SidebarMenuButton tooltip={item.title}>
                      {Icon && <Icon className="size-4" />}
                      {item.title}
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  );
}
