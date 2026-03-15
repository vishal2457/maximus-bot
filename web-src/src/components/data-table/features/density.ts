import {
  type TableFeature,
  type Table,
  type Updater,
  type TableState,
} from "@tanstack/react-table";
import { functionalUpdate, makeStateUpdater } from "@tanstack/react-table";

export enum Density {
  COMPACT = "sm",
  NORMAL = "md",
  WIDE = "lg",
}

export type DensityState = `${Density}`;

export interface DensityTableState {
  density: DensityState;
}

export interface DensityOptions {
  enableDensity?: boolean;
  onDensityChange?: (updater: Updater<DensityState>) => void;
}

declare module "@tanstack/react-table" {
  interface TableState {
    density: DensityState;
  }
  interface TableOptionsResolved<TData> {
    enableDensity?: boolean;
    onDensityChange?: (updater: Updater<DensityState>) => void;
  }
  interface Table<TData> {
    setDensity: (updater: Updater<DensityState>) => void;
    toggleDensity: (value?: DensityState) => void;
    getDensity: () => DensityState;
  }
}

export const DensityFeature: TableFeature<unknown> = {
  getInitialState: (state) =>
    ({
      ...state,
      density: Density.NORMAL,
    } as Partial<TableState>),

  getDefaultOptions: (table) => ({
    enableDensity: true,
    onDensityChange: makeStateUpdater("density", table),
  }),

  createTable: (table) => {
    table.setDensity = (updater) => {
      const safeUpdater: Updater<DensityState> = (old) => {
        const newState = functionalUpdate(updater, old);
        return newState;
      };
      return table.options.onDensityChange?.(safeUpdater);
    };

    table.toggleDensity = (value) => {
      table.setDensity((old) => {
        if (value) return value;
        return old === Density.WIDE
          ? Density.NORMAL
          : old === Density.NORMAL
          ? Density.COMPACT
          : Density.WIDE;
      });
    };

    table.getDensity = () => {
      return table.getState().density;
    };
  },
};

export const getDensityPadding = (density: DensityState): string => {
  switch (density) {
    case Density.COMPACT:
      return "0.25rem 0.5rem";
    case Density.NORMAL:
      return "0.5rem 0.75rem";
    case Density.WIDE:
      return "0.75rem 1rem";
    default:
      return "0.5rem 0.75rem";
  }
};

export const getDensityClassName = (density: DensityState): string => {
  const transitionClasses = getDensityEnhancedTransitionClasses();

  switch (density) {
    case Density.COMPACT:
      return `py-1 px-2 text-sm ${transitionClasses}`;
    case Density.NORMAL:
      return `py-2 px-3 ${transitionClasses}`;
    case Density.WIDE:
      return `py-3 px-4 text-base ${transitionClasses}`;
    default:
      return `py-2 px-3 ${transitionClasses}`;
  }
};

export const getDensityLabel = (density: DensityState): string => {
  switch (density) {
    case Density.COMPACT:
      return "Compact";
    case Density.NORMAL:
      return "Normal";
    case Density.WIDE:
      return "Wide";
    default:
      return "Normal";
  }
};

// Utility for getting transition classes
export const getDensityTransitionClasses = (): string => {
  return "transition-all duration-200 ease-in-out";
};

// Utility for getting enhanced transition classes with transform support
export const getDensityEnhancedTransitionClasses = (): string => {
  return "transition-[padding,font-size,line-height] duration-200 ease-in-out";
};
