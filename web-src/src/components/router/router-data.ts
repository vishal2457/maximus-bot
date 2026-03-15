import { HomeIcon, List, Lock, FileText } from "lucide-react";
import { HomePage } from "../../pages/home/home.page";
import { DiscordConfigPage } from "../../pages/handle-secrets/handle-secrets.page";
import { LogsPage } from "../../pages/log-vewer/logs.page";
import { CronJobsListPage } from "../../pages/cron-jobs/cron-jobs-list/cron-jobs.page";

interface RouteData {
  path: string;
  name: string;
  component: React.ComponentType;
  isProtected: boolean;
  icon?: React.ComponentType;
  excludeFromSidebar?: boolean;
}

const ROUTER_DATA: RouteData[] = [
  {
    path: "/",
    name: "Home",
    component: HomePage,
    isProtected: true,
    icon: HomeIcon,
  },
  {
    path: "/data",
    name: "Data Table",
    component: CronJobsListPage,
    isProtected: true,
    icon: List,
  },
  {
    path: "/handle-secrets",
    name: "Configure Secrets",
    component: DiscordConfigPage,
    isProtected: true,
    icon: Lock,
  },
  {
    path: "/logs",
    name: "Logs",
    component: LogsPage,
    isProtected: true,
    icon: FileText,
  },
];

export const PROTECTED_ROUTES = ROUTER_DATA.filter(
  (route) => route.isProtected,
);

export const SIDEBAR_ROUTES = ROUTER_DATA.filter(
  (route) => route.isProtected && !route.excludeFromSidebar,
);

export const PUBLIC_ROUTES = ROUTER_DATA.filter((route) => !route.isProtected);

export const getAllRoutes = () => {
  return ROUTER_DATA.filter(
    (route) => route.isProtected && !route.excludeFromSidebar,
  );
};
