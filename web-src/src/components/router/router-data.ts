import {
  HomeIcon,
  List,
  Lock,
  FileText,
  FolderKanban,
  Bot,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import { HomePage } from "../../pages/home/home.page";
import { DiscordConfigPage } from "../../pages/handle-secrets/handle-secrets.page";
import { LogsPage } from "../../pages/log-vewer/logs.page";
import { CronJobsListPage } from "../../pages/cron-jobs/cron-jobs-list/cron-jobs.page";
import { ProjectsPage } from "../../pages/projects/projects.page";
import { AgentsPage } from "../../pages/agents/agents.page";
import { ChatPage } from "../../pages/chat/chat.page";
import { LoginPage } from "../../pages/auth/login.page";

interface RouteData {
  path: string;
  name: string;
  component: React.ComponentType;
  isProtected: boolean;
  icon?: LucideIcon;
  excludeFromSidebar?: boolean;
}

const ROUTER_DATA: RouteData[] = [
  {
    path: "/login",
    name: "Login",
    component: LoginPage,
    isProtected: false,
  },
  {
    path: "/",
    name: "Telemetry",
    component: HomePage,
    isProtected: true,
    icon: HomeIcon,
  },
  {
    path: "/chat",
    name: "Chat",
    component: ChatPage,
    isProtected: true,
    icon: MessageSquare,
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
    name: "Projects",
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
    path: "/projects/:projectId/agents",
    name: "Project Agents",
    component: AgentsPage,
    isProtected: true,
    icon: Bot,
    excludeFromSidebar: true,
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
