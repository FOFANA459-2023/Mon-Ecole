import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";

export function PasswordInput(props: Omit<ComponentProps<typeof Input>, "type">) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className="pr-10" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-10 items-center justify-center"
        aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
