import { TeamName, TeamPlan } from "./utils/teams.enum";
import {
  AudioWaveform,
  Command,
  GalleryVerticalEnd,
  ShoppingCart,
} from "lucide-react";
import React, { createContext, useContext, useState } from "react";

export interface TeamContextData {
  name: TeamName;
  logo: React.ComponentType<{ className?: string }>;
  plan: TeamPlan;
}

export const teams: TeamContextData[] = [
  {
    name: TeamName.CRM,
    logo: GalleryVerticalEnd,
    plan: TeamPlan.ENTERPRISE,
  },
  {
    name: TeamName.HRM,
    logo: AudioWaveform,
    plan: TeamPlan.STARTUP,
  },
  {
    name: TeamName.MANUFACTURING,
    logo: Command,
    plan: TeamPlan.FREE,
  },
  {
    name: TeamName.ECOMMERCE,
    logo: ShoppingCart,
    plan: TeamPlan.ENTERPRISE,
  },
];

interface TeamContextType {
  activeTeam: TeamContextData;
  setActiveTeam: (team: TeamContextData) => void;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export const TeamProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [activeTeam, setActiveTeam] = useState<TeamContextData>(teams[0]);

  return (
    <TeamContext.Provider value={{ activeTeam, setActiveTeam }}>
      {children}
    </TeamContext.Provider>
  );
};

export const useTeam = () => {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error("useTeam must be used within a TeamProvider");
  }
  return context;
};
