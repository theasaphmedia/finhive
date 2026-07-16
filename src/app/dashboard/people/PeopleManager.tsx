"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { lineDelay } from "@/lib/lineDelay";

type Role = "owner" | "admin" | "stakeholder" | "client";

interface Person {
  id: string;
  name: string;
  email: string;
  role: Role;
  access_level: "full" | "summary" | null;
  can_confirm_flags: boolean;
  deactivated_at: string | null;
}

interface Invite {
  id: string;
  name: string;
  email: string;
  role: Role;
  access_level: "full" | "summary" | null;
  can_confirm_flags: boolean;
  created_at: string;
}

interface ClientOption {
  id: string;
  client_name: string;
}

export default function PeopleManager({
  organizationId,
  organizationName,
  currentProfileId,
  isOwner,
  initialPeople,
  initialInvites,
  clients,
}: {
  organizationId: string;
  organizationName: string;
  currentProfileId: string;
  isOwner: boolean;
  initialPeople: Person[];
  initialInvites: Invite[];
  clients: ClientOption[];
}) {
  const supabase = createClient();
  const [people, setPeople] = useState<Person[]>(initialPeople);
  const [invites, setInvites] = useState<Invite[]>(initialInvites);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resentId, setResentId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("stakeholder");
  const [accessLevel, setAccessLevel] = useState<"full" | "summary">("full");
  const [canConfirmFlags, setCanConfirmFlags] = useState(false);
  const [linkedClientId, setLinkedClientId] = useState("");

  async function sendInvite() {
    if (!name.trim() || !email.trim()) return;
    if (role === "client" && !linkedClientId) {
      setError("Choose which client record this login should be linked to.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Friendly pre-checks before hitting the DB -- catches the two most likely
    // mistakes (re-inviting someone who's already active, or already pending)
    // with a clear message instead of a raw Postgres constraint error.
    if (people.some((p) => p.email.toLowerCase() === normalizedEmail)) {
      setError("This email already has access -- find them in the list above to change their role instead.");
      return;
    }
    if (invites.some((i) => i.email.toLowerCase() === normalizedEmail)) {
      setError("An invite for this email is already pending below -- use Resend, or cancel it first.");
      return;
    }

    setSending(true);
    setError("");

    const { data: inviteRow, error: err } = await supabase
      .from("invites")
      .insert({
        organization_id: organizationId,
        name: name.trim(),
        email: normalizedEmail,
        role,
        access_level: role === "stakeholder" ? accessLevel : null,
        can_confirm_flags: role === "stakeholder" ? canConfirmFlags : false,
        linked_client_id: role === "client" ? linkedClientId : null,
        invited_by: currentProfileId,
      })
      .select()
      .single();

    if (err) {
      // 23505 = unique_violation -- someone else's invite for this email/org
      // slipped in between our pre-check and the insert (race condition).
      setError(
        err.code === "23505"
          ? "An invite for this email is already pending -- refresh the page to see it."
          : err.message
      );
      setSending(false);
      return;
    }

    // Sent through our own /api/invite route (service-role admin API) rather
    // than supabase.auth.signInWithOtp from this browser -- see the route's
    // top comment for why the client-side call silently failed for anyone
    // other than the admin who clicked it.
    const inviteRes = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail, organizationName, role }),
    });

    if (!inviteRes.ok) {
      const body = await inviteRes.json().catch(() => ({}));
      setError(`Invite saved, but the email failed to send: ${body.error ?? inviteRes.statusText}`);
    }

    setInvites((prev) => [...prev, inviteRow as Invite]);
    setName("");
    setEmail("");
    setSending(false);
  }

  async function resendInvite(invite: Invite) {
    setError("");
    setResendingId(invite.id);
    const inviteRes = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: invite.email, organizationName, role: invite.role }),
    });
    setResendingId(null);
    if (!inviteRes.ok) {
      const body = await inviteRes.json().catch(() => ({}));
      setError(`Couldn't resend: ${body.error ?? inviteRes.statusText}`);
      return;
    }
    setResentId(invite.id);
    setTimeout(() => setResentId((prev) => (prev === invite.id ? null : prev)), 3000);
  }

  async function cancelInvite(id: string) {
    setError("");
    const { error: err } = await supabase.from("invites").delete().eq("id", id);
    if (err) return setError(err.message);
    setInvites((prev) => prev.filter((i) => i.id !== id));
  }

  function timeAgo(iso: string) {
    const ms = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(ms / 36e5);
    if (hours < 1) return "just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  async function updatePerson(id: string, patch: Partial<Person>) {
    setError("");
    const { error: err } = await supabase.from("profiles").update(patch).eq("id", id);
    if (err) return setError(err.message);
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  // Deactivates rather than deletes the profiles row -- transactions
  // confirmed/approved/annotated by this person (plus audit_events,
  // error_log, invites sent, share links created) all reference profiles(id)
  // with ON DELETE NO ACTION, so a real delete fails outright for anyone
  // who's ever done any of that. Deactivation ends their access immediately
  // (enforced in requireViewerContext.ts) while keeping the audit trail
  // intact, and can be undone via "Reactivate" below -- unlike the old
  // delete, this is NOT permanent. See NDPA_COMPLIANCE_CHECKLIST.md Section 4.
  async function revokePerson(id: string) {
    if (id === currentProfileId) {
      setError("You can't revoke your own access here -- use My account to deactivate yourself.");
      return;
    }
    const target = people.find((p) => p.id === id);
    if (target?.role === "owner") {
      if (!isOwner) {
        setError("Only an owner can revoke another owner's access.");
        return;
      }
      const otherActiveOwners = people.filter((p) => p.role === "owner" && !p.deactivated_at && p.id !== id);
      if (otherActiveOwners.length === 0) {
        setError("This is the only owner -- promote someone else to owner first, or the organization would have no one able to manage it.");
        return;
      }
    }
    if (!confirm("Revoke this person's access? They'll be signed out and unable to log back in until reactivated.")) return;
    setError("");
    const { error: err } = await supabase
      .from("profiles")
      .update({ deactivated_at: new Date().toISOString() })
      .eq("id", id);
    if (err) return setError(err.message);
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, deactivated_at: new Date().toISOString() } : p)));
  }

  async function reactivatePerson(id: string) {
    setError("");
    const { error: err } = await supabase.from("profiles").update({ deactivated_at: null }).eq("id", id);
    if (err) return setError(err.message);
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, deactivated_at: null } : p)));
  }

  return (
    <div className="fade-in flex flex-col gap-10">
      <div>
        <h2 className="text-base font-semibold text-zinc-800">People</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Add anyone by email, choose their role, and toggle permissions -- no code changes ever
          required.
        </p>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="card card-flat stagger mt-4 flex flex-col divide-y divide-zinc-100">
          {people.map((p, i) => {
            const deactivated = !!p.deactivated_at;
            // Ownership transfer is owner-only (see CLAUDE.md roles table): an
            // admin can manage everyone else, but can't touch an existing
            // owner's row or promote anyone to owner. Mirrors the
            // owner_admin_can_update_profiles RLS policy on the DB side.
            const roleLocked = p.id === currentProfileId || deactivated || (p.role === "owner" && !isOwner);
            return (
              <div
                key={p.id}
                className="line-in row-hover flex flex-wrap items-center gap-3 rounded-md px-4 py-2 text-[13px]"
                style={{ animationDelay: lineDelay(i), opacity: deactivated ? 0.55 : 1 }}
              >
                <div className="min-w-[160px] flex-1">
                  <p className="font-medium text-zinc-800">
                    {p.name}
                    {deactivated && (
                      <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                        Deactivated
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500">{p.email}</p>
                </div>
                <select
                  value={p.role}
                  onChange={(e) => updatePerson(p.id, { role: e.target.value as Role })}
                  disabled={roleLocked}
                  title={p.role === "owner" && !isOwner ? "Only an owner can change another owner's role" : undefined}
                  className="input"
                >
                  {(isOwner || p.role === "owner") && <option value="owner">Owner</option>}
                  <option value="admin">Admin</option>
                  <option value="stakeholder">Stakeholder</option>
                  <option value="client">Client</option>
                </select>
                {p.role === "stakeholder" && (
                  <>
                    <select
                      value={p.access_level ?? "full"}
                      onChange={(e) =>
                        updatePerson(p.id, { access_level: e.target.value as "full" | "summary" })
                      }
                      disabled={deactivated}
                      className="input"
                    >
                      <option value="full">Full access</option>
                      <option value="summary">Summary only</option>
                    </select>
                    <label className="flex items-center gap-1 text-xs text-zinc-600">
                      <input
                        type="checkbox"
                        checked={p.can_confirm_flags}
                        onChange={(e) => updatePerson(p.id, { can_confirm_flags: e.target.checked })}
                        disabled={deactivated}
                      />
                      Can confirm flags
                    </label>
                  </>
                )}
                {deactivated ? (
                  <button
                    onClick={() => reactivatePerson(p.id)}
                    className="ml-auto text-xs font-medium"
                    style={{ color: "var(--org-accent, #1E9E6B)" }}
                  >
                    Reactivate
                  </button>
                ) : (
                  <button
                    onClick={() => revokePerson(p.id)}
                    disabled={p.id === currentProfileId || (p.role === "owner" && !isOwner)}
                    title={p.role === "owner" && !isOwner ? "Only an owner can revoke another owner's access" : undefined}
                    className="ml-auto text-xs font-medium text-zinc-500 hover:text-red-600 disabled:opacity-30"
                  >
                    Revoke
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {invites.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Pending invites
            </p>
            <div className="card card-flat mt-2 flex flex-col divide-y divide-zinc-100">
              {invites.map((i, idx) => (
                <div
                  key={i.id}
                  className="line-in row-hover flex items-center justify-between rounded-md px-4 py-3 text-sm"
                  style={{ animationDelay: lineDelay(idx) }}
                >
                  <span>
                    <span className="font-medium text-zinc-800">{i.name}</span>{" "}
                    <span className="text-zinc-500">({i.email})</span> &middot; {i.role}{" "}
                    <span className="text-xs text-zinc-400">&middot; invited {timeAgo(i.created_at)}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <button
                      onClick={() => resendInvite(i)}
                      disabled={resendingId === i.id}
                      className="text-xs font-medium disabled:opacity-50"
                      style={{ color: resentId === i.id ? "var(--org-accent, #1E9E6B)" : "var(--org-primary, #0F2A3D)" }}
                    >
                      {resendingId === i.id ? "Sending..." : resentId === i.id ? "Sent!" : "Resend"}
                    </button>
                    <button
                      onClick={() => cancelInvite(i.id)}
                      className="text-xs font-medium text-zinc-500 hover:text-red-600"
                    >
                      Cancel
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-zinc-800">Invite someone</h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="input" />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            className="input"
          />
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="input">
            <option value="admin">Admin</option>
            <option value="stakeholder">Stakeholder</option>
            <option value="client">Client</option>
          </select>
          {role === "stakeholder" && (
            <select
              value={accessLevel}
              onChange={(e) => setAccessLevel(e.target.value as "full" | "summary")}
              className="input"
            >
              <option value="full">Full access</option>
              <option value="summary">Summary only</option>
            </select>
          )}
          {role === "stakeholder" && (
            <label className="col-span-2 flex items-center gap-2 text-sm text-zinc-600">
              <input
                type="checkbox"
                checked={canConfirmFlags}
                onChange={(e) => setCanConfirmFlags(e.target.checked)}
              />
              Can confirm flagged transactions
            </label>
          )}
          {role === "client" && (
            <select
              value={linkedClientId}
              onChange={(e) => setLinkedClientId(e.target.value)}
              className="input col-span-2"
            >
              <option value="">Link to client record...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.client_name}
                </option>
              ))}
            </select>
          )}
        </div>
        <button onClick={sendInvite} disabled={sending} className="btn-primary mt-4">
          {sending ? "Sending..." : "Send invite"}
        </button>
      </div>
    </div>
  );
}
