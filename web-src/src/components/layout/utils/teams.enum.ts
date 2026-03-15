export enum TeamName {
  CRM = "CRM",
  HRM = "HRM",
  MANUFACTURING = "Manufacturing",
  ECOMMERCE = "Ecommerce"
}

export enum TeamPlan {
  ENTERPRISE = "Enterprise",
  STARTUP = "Startup",
  FREE = "Free"
}

export enum TeamPermission {
  READ = "read",
  WRITE = "write",
  ADMIN = "admin"
}

export enum TeamStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  SUSPENDED = "suspended"
}

export interface Team {
  name: TeamName;
  plan: TeamPlan;
  displayName: string;
  description: string;
  permissions?: TeamPermission[];
  status?: TeamStatus;
}

export const TEAMS: Record<TeamName, Team> = {
  [TeamName.CRM]: {
    name: TeamName.CRM,
    plan: TeamPlan.ENTERPRISE,
    displayName: "CRM",
    description: "Customer Relationship Management",
    permissions: [TeamPermission.READ, TeamPermission.WRITE, TeamPermission.ADMIN],
    status: TeamStatus.ACTIVE
  },
  [TeamName.HRM]: {
    name: TeamName.HRM,
    plan: TeamPlan.STARTUP,
    displayName: "HRM",
    description: "Human Resource Management",
    permissions: [TeamPermission.READ, TeamPermission.WRITE],
    status: TeamStatus.ACTIVE
  },
  [TeamName.MANUFACTURING]: {
    name: TeamName.MANUFACTURING,
    plan: TeamPlan.FREE,
    displayName: "Manufacturing",
    description: "Manufacturing Operations",
    permissions: [TeamPermission.READ],
    status: TeamStatus.ACTIVE
  },
  [TeamName.ECOMMERCE]: {
    name: TeamName.ECOMMERCE,
    plan: TeamPlan.ENTERPRISE,
    displayName: "Ecommerce",
    description: "E-commerce Operations",
    permissions: [TeamPermission.READ, TeamPermission.WRITE, TeamPermission.ADMIN],
    status: TeamStatus.ACTIVE
  }
};

export const TEAM_NAMES = Object.values(TeamName);
export const TEAM_PLANS = Object.values(TeamPlan);
export const TEAM_PERMISSIONS = Object.values(TeamPermission);
export const TEAM_STATUSES = Object.values(TeamStatus);

export const isTeamName = (value: string): value is TeamName => {
  return Object.values(TeamName).includes(value as TeamName);
};

export const getTeamByName = (name: string): Team | undefined => {
  if (isTeamName(name)) {
    return TEAMS[name];
  }
  return undefined;
};

export const getTeamsByPlan = (plan: TeamPlan): Team[] => {
  return Object.values(TEAMS).filter(team => team.plan === plan);
};

export const getTeamsByPermission = (permission: TeamPermission): Team[] => {
  return Object.values(TEAMS).filter(team => 
    team.permissions?.includes(permission)
  );
};

export const getTeamsByStatus = (status: TeamStatus): Team[] => {
  return Object.values(TEAMS).filter(team => team.status === status);
};

export const hasTeamPermission = (teamName: TeamName, permission: TeamPermission): boolean => {
  const team = TEAMS[teamName];
  return team?.permissions?.includes(permission) ?? false;
};
