import * as React from "react";

import { NavMain } from "@/components/layout/nav-main";
import { NavUser } from "@/components/layout/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { getAllRoutes } from "../router/router-data";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const allRoutes = getAllRoutes();

  const data = {
    user: {
      name: "User",
      email: "user@example.com",
      avatar: "",
    },
    navGroups: [
      {
        title: "Navigation",
        items: allRoutes.map((route) => ({
          title: route.name,
          url: route.path,
          icon: route.icon as React.ComponentType<{ className?: string }>,
        })),
      },
    ].filter((group) => group.items.length > 0),
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader />
      <SidebarContent>
        <NavMain groups={data.navGroups} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
