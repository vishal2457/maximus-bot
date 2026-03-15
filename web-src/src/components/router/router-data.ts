import { HomeIcon, List, Lock, FileText } from "lucide-react";
import { HomePage } from "../../pages/home/home.page";
import { DiscordConfigPage } from "../../pages/handle-secrets/handle-secrets.page";
import { LogsPage } from "../../pages/log-vewer/logs.page";
import { CronJobsListPage } from "../../pages/cron-jobs/cron-jobs-list/cron-jobs.page";
import { TeamName } from "../layout/utils/teams.enum";

interface RouteData {
  path: string;
  name: string;
  component: React.ComponentType;
  isProtected: boolean;
  icon?: React.ComponentType;
  excludeFromSidebar?: boolean;
  teams?: TeamName[];
}

const ROUTER_DATA: RouteData[] = [
  {
    path: "/",
    name: "Home",
    component: HomePage,
    isProtected: true,
    icon: HomeIcon,
    teams: [TeamName.CRM],
  },
  {
    path: "/data",
    name: "Data Table",
    component: CronJobsListPage,
    isProtected: true,
    icon: List,
    teams: [TeamName.CRM],
  },
  {
    path: "/handle-secrets",
    name: "Configure Secrets",
    component: DiscordConfigPage,
    isProtected: true,
    icon: Lock,
    teams: [TeamName.CRM],
  },
  {
    path: "/logs",
    name: "Logs",
    component: LogsPage,
    isProtected: true,
    icon: FileText,
    teams: [TeamName.CRM],
  },
];

export const PROTECTED_ROUTES = ROUTER_DATA.filter(
  (route) => route.isProtected,
);

export const SIDEBAR_ROUTES = ROUTER_DATA.filter(
  (route) => route.isProtected && !route.excludeFromSidebar,
);

export const PUBLIC_ROUTES = ROUTER_DATA.filter((route) => !route.isProtected);

export const getRoutesByTeam = (teamName: TeamName) => {
  return ROUTER_DATA.filter(
    (route) => route.isProtected && route.teams?.includes(teamName),
  );
};

export const getSidebarRoutesByTeam = (teamName: TeamName) => {
  return getRoutesByTeam(teamName);
};

export const getCommonRoutes = () => {
  return ROUTER_DATA.filter(
    (route) =>
      route.isProtected &&
      !route.excludeFromSidebar &&
      route.teams?.includes(TeamName.CRM) &&
      route.teams?.includes(TeamName.HRM) &&
      route.teams?.includes(TeamName.MANUFACTURING) &&
      route.teams?.includes(TeamName.ECOMMERCE),
  );
};

export const getTeamSpecificRoutes = (teamName: TeamName) => {
  return ROUTER_DATA.filter(
    (route) =>
      route.isProtected &&
      !route.excludeFromSidebar &&
      route.teams?.includes(teamName) &&
      !(
        route.teams?.includes(TeamName.CRM) &&
        route.teams?.includes(TeamName.HRM) &&
        route.teams?.includes(TeamName.MANUFACTURING) &&
        route.teams?.includes(TeamName.ECOMMERCE)
      ),
  );
};
