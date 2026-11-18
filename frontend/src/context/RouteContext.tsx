import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface NodeInfo {
  id: number;
  name: string;
  type: string;
  floorId: number;
  floorName?: string;
  x: number;
  y: number;
  qrId?: string;
  departmentName?: string;
}

export interface RouteResponse {
  totalDistance: number;
  instructions: string[];
  path: NodeInfo[];
}

interface RouteContextType {
  routeResult: RouteResponse | null;
  setRouteResult: (route: RouteResponse | null) => void;
  activeFloor: number;
  setActiveFloor: (floorId: number) => void;
  clearRoute: () => void;
}

const RouteContext = createContext<RouteContextType | undefined>(undefined);

/**
 * Lightweight global state for routing.
 * Strictly stores only the Current Route and Current Active Floor.
 * Note: accessProfile is owned locally by MapPage.tsx to avoid duplicate state conflicts.
 */
export const RouteProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [routeResult, setRouteResult] = useState<RouteResponse | null>(null);
  const [activeFloor, setActiveFloor] = useState<number>(1);

  const clearRoute = () => {
    setRouteResult(null);
  };

  const contextValue = React.useMemo(() => ({
    routeResult, setRouteResult, activeFloor, setActiveFloor, clearRoute
  }), [routeResult, activeFloor]);

  return (
    <RouteContext.Provider value={contextValue}>
      {children}
    </RouteContext.Provider>
  );
};

export const useRouteContext = () => {
  const context = useContext(RouteContext);
  if (context === undefined) {
    throw new Error('useRouteContext must be used within a RouteProvider');
  }
  return context;
};
