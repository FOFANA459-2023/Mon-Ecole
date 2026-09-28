import type { ReactNode } from "react";

import { useAuth } from "./context";

type CanProps = {
  /** Render children when the user has this permission… */
  permission?: string;
  /** …or any of these. */
  anyOf?: string[];
  fallback?: ReactNode;
  children: ReactNode;
};

/** Hides UI the user may not use. The API enforces the same rules server-side. */
export function Can({ permission, anyOf, fallback = null, children }: CanProps) {
  const { can, canAny } = useAuth();
  const allowed = (permission ? can(permission) : true) && (anyOf ? canAny(anyOf) : true);
  return <>{allowed ? children : fallback}</>;
}
