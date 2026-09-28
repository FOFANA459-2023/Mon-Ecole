import { SETTINGS_TABS } from "@/app/nav";
import { useAuth } from "@/lib/auth/context";

export function useVisibleSettingsTabs() {
  const { canAny } = useAuth();
  return SETTINGS_TABS.filter((tab) => tab.anyOf.length === 0 || canAny([...tab.anyOf]));
}
