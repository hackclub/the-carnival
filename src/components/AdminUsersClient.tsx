"use client";

import { useCallback, useState } from "react";
import toast from "react-hot-toast";

export type UserListItem = {
  id: string;
  name: string | null;
  email: string;
  slackId: string | null;
  verificationStatus: string | null;
  role: "user" | "reviewer" | "admin";
};

const roleOptions: { value: UserListItem["role"]; label: string }[] = [
  { value: "user", label: "User" },
  { value: "reviewer", label: "Reviewer" },
  { value: "admin", label: "Admin" },
];

export default function AdminUsersClient({
  initial,
  currentUserId,
}: {
  initial: UserListItem[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState<UserListItem[]>(initial);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const updateRole = useCallback(
    async (userId: string, newRole: UserListItem["role"]) => {
      if (userId === currentUserId) {
        toast.error("You cannot change your own role.");
        return;
      }

      setUpdatingId(userId);
      const toastId = toast.loading("Updating role…");

      try {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        });

        const data = (await res.json().catch(() => null)) as {
          error?: string;
          user?: { id: string; role: UserListItem["role"] };
        } | null;

        if (!res.ok) {
          toast.error(data?.error || "Failed to update role.", { id: toastId });
          setUpdatingId(null);
          return;
        }

        toast.success("Role updated.", { id: toastId });

        // Update local state
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
        setUpdatingId(null);
      } catch {
        toast.error("Failed to update role.", { id: toastId });
        setUpdatingId(null);
      }
    },
    [currentUserId]
  );

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
        <div className="col-span-3">Name</div>
        <div className="col-span-3">Email</div>
        <div className="col-span-2">Slack</div>
        <div className="col-span-2">Verification</div>
        <div className="col-span-2">Role</div>
      </div>
      <div className="divide-y divide-border">
        {users.map((u) => {
          const isCurrentUser = u.id === currentUserId;
          const isUpdating = updatingId === u.id;

          return (
            <div key={u.id} className="grid grid-cols-12 gap-3 px-5 py-4 items-center">
              <div className="col-span-3 text-foreground font-semibold truncate">
                {u.name}
                {isCurrentUser && (
                  <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                )}
              </div>
              <div className="col-span-3 text-muted-foreground font-mono text-sm truncate">
                {u.email}
              </div>
              <div className="col-span-2 text-muted-foreground font-mono text-sm truncate">
                {u.slackId || "—"}
              </div>
              <div className="col-span-2 text-muted-foreground font-mono text-sm truncate">
                {u.verificationStatus || "—"}
              </div>
              <div className="col-span-2">
                <select
                  value={u.role}
                  onChange={(e) => updateRole(u.id, e.target.value as UserListItem["role"])}
                  disabled={isCurrentUser || isUpdating}
                  className={`
                    w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background
                    text-foreground font-medium
                    focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${isUpdating ? "animate-pulse" : ""}
                  `}
                >
                  {roleOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

