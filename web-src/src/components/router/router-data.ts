import {
  HomeIcon,
  List,
  Lock,
  FileText,
  FolderKanban,
  Plug,
} from "lucide-react";
import { HomePage } from "../../pages/home/home.page";
import { DiscordConfigPage } from "../../pages/handle-secrets/handle-secrets.page";
import { LogsPage } from "../../pages/log-vewer/logs.page";
import { CronJobsListPage } from "../../pages/cron-jobs/cron-jobs-list/cron-jobs.page";
import { ProjectsPage } from "../../pages/projects/projects.page";
import { IntegrationsPage } from "../../pages/integrations/integrations.page";

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
    name: "Telemetry",
    component: HomePage,
    isProtected: true,
    icon: HomeIcon,
  },
  {
    path: "/logs",
    name: "System Logs",
    component: LogsPage,
    isProtected: true,
    icon: FileText,
  },
  {
    path: "/project",
    name: "Workspaces",
    component: ProjectsPage,
    isProtected: true,
    icon: FolderKanban,
  },
  {
    path: "/data",
    name: "Cron Jobs",
    component: CronJobsListPage,
    isProtected: true,
    icon: List,
  },
  {
    path: "/handle-secrets",
    name: "Vault",
    component: DiscordConfigPage,
    isProtected: true,
    icon: Lock,
  },
  {
    path: "/integrations",
    name: "Comms Link",
    component: IntegrationsPage,
    isProtected: true,
    icon: Plug,
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
