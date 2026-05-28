import { Check, Moon, Sun, Trash2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { Input, Label } from "../../components/Input";
import { Modal } from "../../components/Modal";
import { useToast } from "../../components/Toast";
import {
  useCurrentUser,
  useDeleteAccount,
  useUpdateProfile,
} from "../../lib/auth";
import { useTheme } from "../../lib/theme";

const CONFIRM_WORD = "DELETE";

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: user } = useCurrentUser();
  const updateProfile = useUpdateProfile();
  const deleteAccount = useDeleteAccount();
  const { theme, set: setTheme } = useTheme();
  const toast = useToast();

  const [name, setName] = useState(user?.name ?? "");
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  // Keep the field in sync if the user loads/changes underneath us, and reset
  // the danger-zone state whenever the modal is reopened.
  useEffect(() => {
    setName(user?.name ?? "");
  }, [user?.name]);
  useEffect(() => {
    if (!open) {
      setConfirming(false);
      setConfirmText("");
    }
  }, [open]);

  const nameDirty = name.trim() !== (user?.name ?? "");

  async function handleSaveName() {
    try {
      await updateProfile.mutateAsync({ name: name.trim() });
      toast.show({ variant: "success", title: "Name updated" });
    } catch (err) {
      toast.show({
        variant: "error",
        title: "Couldn't update name",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function handleDelete() {
    try {
      await deleteAccount.mutateAsync();
      // No success toast — the app will immediately swap to the auth screen.
    } catch (err) {
      toast.show({
        variant: "error",
        title: "Couldn't delete account",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Settings" maxWidth="max-w-lg">
      <div className="space-y-6">
        {/* Profile */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Profile
          </h3>
          <div>
            <Label htmlFor="settings-email">Email</Label>
            <div className="text-sm text-ink-secondary bg-surface-subtle/40 border border-border-subtle rounded-lg px-3 py-2">
              {user?.email}
            </div>
          </div>
          <div>
            <Label htmlFor="settings-name">Name</Label>
            <div className="flex gap-2">
              <Input
                id="settings-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={80}
                className="flex-1"
              />
              <Button
                onClick={handleSaveName}
                disabled={!nameDirty || updateProfile.isPending}
                size="md"
              >
                {updateProfile.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Appearance
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-primary">Theme</span>
            <div className="flex gap-1 p-1 bg-surface-subtle rounded-lg">
              {(["light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                    theme === t
                      ? "bg-surface-elevated text-ink-primary shadow-card"
                      : "text-ink-secondary hover:text-ink-primary"
                  }`}
                >
                  {t === "light" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                  {t === "light" ? "Light" : "Dark"}
                  {theme === t && <Check className="h-3 w-3 text-accent" />}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Danger zone */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-status-rejected">
            Danger zone
          </h3>
          {!confirming ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-status-rejected/30 bg-status-rejected/5 p-3">
              <div className="text-sm">
                <div className="text-ink-primary font-medium">Delete account</div>
                <div className="text-xs text-ink-secondary">
                  Permanently removes your account and all applications, reminders, and progress.
                </div>
              </div>
              <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-status-rejected/40 bg-status-rejected/5 p-3 space-y-3">
              <div className="flex items-start gap-2 text-sm text-status-rejected">
                <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  This is permanent and cannot be undone. Type <strong>{CONFIRM_WORD}</strong> to
                  confirm.
                </span>
              </div>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_WORD}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setConfirming(false);
                    setConfirmText("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={confirmText !== CONFIRM_WORD || deleteAccount.isPending}
                  onClick={handleDelete}
                >
                  {deleteAccount.isPending ? "Deleting..." : "Permanently delete"}
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
