import { Camera } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Spinner } from "@/components/common";
import { PersonAvatar } from "@/components/display";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/forms";

const TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Large avatar that doubles as the photo upload button (when `path` is given). */
export function PhotoUploader({
  name,
  photoUrl,
  path,
  onUploaded,
  label,
}: {
  name: string;
  photoUrl: string | null;
  path?: string;
  onUploaded: () => Promise<void> | void;
  label: string;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !path) return;
    if (!TYPES.includes(file.type) || file.size > 2 * 1024 * 1024) {
      toast.error(t("common.photoHint"));
      return;
    }
    const body = new FormData();
    body.append("file", file);
    setBusy(true);
    try {
      await api.post(path, body);
      await onUploaded();
    } catch (error) {
      toast.error(errorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  const avatar = <PersonAvatar name={name} photoUrl={photoUrl} className="size-20 text-lg" />;
  if (!path) return avatar;
  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="group focus-visible:ring-ring relative rounded-full outline-none focus-visible:ring-2"
        aria-label={label}
        title={label}
      >
        {avatar}
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {busy ? <Spinner className="size-5 text-white" /> : <Camera className="size-5" />}
        </span>
      </button>
      <input ref={input} type="file" accept={TYPES.join(",")} className="hidden" onChange={(e) => void onFile(e)} />
    </>
  );
}
