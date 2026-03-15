import * as React from "react";

import { NavMain } from "@/components/layout/nav-main";
import { NavUser } from "@/components/layout/components/nav-user";
import { AnnouncementBanner } from "@/components/layout/components/announcement-banner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { getCommonRoutes, getTeamSpecificRoutes } from "../router/router-data";
import { Switcher } from "./components/switcher";
import { useTeam } from "./team-context";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { activeTeam } = useTeam();

  const commonRoutes = getCommonRoutes();
  const teamSpecificRoutes = getTeamSpecificRoutes(activeTeam.name);

  const data = {
    user: {
      name: "John Doe",
      email: "john.doe@example.com",
      avatar: "/avatars/john-doe.jpg",
    },
    navGroups: [
      ...(commonRoutes.length > 0
        ? [
          {
            title: "Platform",
            items: commonRoutes.map((route) => ({
              title: route.name,
              url: route.path,
              icon: route.icon as React.ComponentType<{ className?: string }>,
            })),
          },
        ]
        : []),
      {
        title: activeTeam.name,
        items: teamSpecificRoutes.map((route) => ({
          title: route.name,
          url: route.path,
          icon: route.icon as React.ComponentType<{ className?: string }>,
        })),
      },
    ].filter((group) => group.items.length > 0), // Only show groups with items
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <Switcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={data.navGroups} />
      </SidebarContent>
      <SidebarFooter>
        <AnnouncementBanner />
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
