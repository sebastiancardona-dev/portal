import { useState } from 'react'
import { Check, Copy, KeyRound, UserX } from 'lucide-react'
import {
  useAccountUsers,
  useAudit,
  useAuthClients,
  useInvites,
  useMe,
  useMintInvite,
  useRevokeInvite,
} from '../api/hooks'
import type { AccountUser, Invite, MintedInvite } from '../api/types'
import { fmtAbsolute, fmtRelative } from '../format'
import { Quiet, RelTime, Skeleton, SortTable, StatusDot } from '../ui'

const GROUPS = ['friend', 'recruiter', 'admin'] as const

function GroupBadge({ group }: { group: string }) {
  return <span className="group-badge">{group}</span>
}

/** "moneytrckr · 2h ago" chips — which apps this person actually signs into. */
function AppsUsedCell({ user }: { user: AccountUser }) {
  if (user.apps.length === 0) return <span className="muted">none yet</span>
  return (
    <span className="app-usage-list">
      {user.apps.map((a) => (
        <span
          key={a.clientId}
          className="app-usage"
          title={`${a.clientId}: ${a.useCount} sign-ins · first ${fmtAbsolute(a.firstUsedAt)} · last ${fmtAbsolute(a.lastUsedAt)}`}
        >
          <span className="mono">{a.clientId}</span>
          <span className="app-usage-when">{fmtRelative(a.lastUsedAt)}</span>
        </span>
      ))}
    </span>
  )
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className={`btn btn-sm${copied ? ' copied' : ''}`}
      aria-label={label}
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
      }}
    >
      {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.75} />}
      {copied ? 'Copied' : 'Copy link'}
    </button>
  )
}

function MintInviteForm({ onMinted }: { onMinted: (minted: MintedInvite) => void }) {
  const mint = useMintInvite()
  const [group, setGroup] = useState<string>('friend')
  const [ttlDays, setTtlDays] = useState(7)
  const [maxUses, setMaxUses] = useState(1)
  const [note, setNote] = useState('')

  return (
    <form
      className="mint-form"
      onSubmit={(e) => {
        e.preventDefault()
        mint.mutate(
          { group, ttlDays, maxUses, note: note.trim() || undefined },
          {
            onSuccess: (minted) => {
              setNote('')
              onMinted(minted)
            },
          },
        )
      }}
    >
      <label>
        <span>Group</span>
        <select value={group} onChange={(e) => setGroup(e.target.value)}>
          {GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Valid for</span>
        <span className="mint-num">
          <input
            type="number"
            min={1}
            max={365}
            value={ttlDays}
            onChange={(e) => setTtlDays(Number(e.target.value))}
          />
          <span className="mint-unit">days</span>
        </span>
      </label>
      <label>
        <span>Max uses</span>
        <input
          type="number"
          min={1}
          max={100}
          value={maxUses}
          onChange={(e) => setMaxUses(Number(e.target.value))}
        />
      </label>
      <label className="mint-note">
        <span>Note</span>
        <input
          type="text"
          value={note}
          maxLength={200}
          placeholder="who is this for?"
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <button type="submit" className="btn btn-primary" disabled={mint.isPending}>
        <KeyRound size={14} strokeWidth={1.75} />
        {mint.isPending ? 'Minting…' : 'Mint invite'}
      </button>
      {mint.isError && <span className="form-error">{mint.error.message}</span>}
    </form>
  )
}

function inviteStatus(invite: Invite): { state: 'ok' | 'off' | 'down'; label: string } {
  if (invite.revokedAt) return { state: 'down', label: 'revoked' }
  if (new Date(invite.expiresAt).getTime() < Date.now()) return { state: 'off', label: 'expired' }
  if (invite.uses >= invite.maxUses) return { state: 'off', label: 'used up' }
  return { state: 'ok', label: 'active' }
}

/** Two-step destructive action: first click arms it, second confirms. */
function RevokeButton({ invite }: { invite: Invite }) {
  const revoke = useRevokeInvite()
  const [armed, setArmed] = useState(false)
  if (inviteStatus(invite).label !== 'active') return null
  if (!armed) {
    return (
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setArmed(true)}>
        Revoke
      </button>
    )
  }
  return (
    <span className="revoke-confirm">
      <button
        type="button"
        className="btn btn-sm btn-danger"
        disabled={revoke.isPending}
        onClick={() => revoke.mutate(invite.id)}
      >
        <UserX size={14} strokeWidth={1.75} />
        {revoke.isPending ? 'Revoking…' : 'Confirm revoke'}
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setArmed(false)}>
        Keep
      </button>
    </span>
  )
}

export function AccountsPage() {
  const me = useMe()
  const users = useAccountUsers()
  const invites = useInvites()
  const clients = useAuthClients()
  const audit = useAudit(100)
  const [minted, setMinted] = useState<MintedInvite | null>(null)

  if (me.data && me.data.role !== 'admin') {
    return <Quiet>admin access is required for the accounts module</Quiet>
  }
  if (users.isPending || invites.isPending) {
    return (
      <div className="page-skeleton">
        <Skeleton height={60} />
        <Skeleton height={220} />
        <Skeleton height={220} />
      </div>
    )
  }
  if (users.isError) {
    return <Quiet>could not reach the auth service — {users.error.message}</Quiet>
  }

  return (
    <>
      <header className="page-head">
        <div className="page-id">
          <span className="eyebrow">Modules</span>
          <h1 className="page-title">Accounts</h1>
        </div>
        <div className="page-meta mono">SSO · relayed live from the auth service</div>
      </header>

      <section className="panel">
        <h2 className="panel-title">People</h2>
        {(users.data ?? []).length === 0 ? (
          <Quiet>no accounts registered yet</Quiet>
        ) : (
          <SortTable
            rows={users.data ?? []}
            rowKey={(u) => u.id}
            defaultSort={{ key: 'joined', dir: 'desc' }}
            columns={[
              {
                key: 'who',
                label: 'User',
                get: (u) => u.email,
                render: (u) => (
                  <span className="account-who">
                    <span className="account-name">{u.displayName}</span>
                    <span className="account-email mono">{u.email}</span>
                  </span>
                ),
              },
              {
                key: 'groups',
                label: 'Groups',
                get: (u) => [...u.groups].sort().join(' '),
                render: (u) =>
                  [...u.groups].sort().map((g) => <GroupBadge key={g} group={g} />),
              },
              {
                key: 'apps',
                label: 'Apps used',
                get: (u) => u.apps.length,
                render: (u) => <AppsUsedCell user={u} />,
              },
              {
                key: 'joined',
                label: 'Joined',
                get: (u) => u.createdAt,
                render: (u) => <RelTime ts={u.createdAt} />,
              },
              {
                key: 'status',
                label: 'Status',
                get: (u) => (u.disabled ? 1 : 0),
                render: (u) =>
                  u.disabled ? (
                    <StatusDot state="down" label="disabled" />
                  ) : (
                    <StatusDot state="ok" label="active" />
                  ),
              },
            ]}
          />
        )}
      </section>

      <section className="panel">
        <h2 className="panel-title">Invites</h2>
        <p className="settings-microcopy">
          Registration is invite-only, ecosystem-wide. Minted links land the redeemer in the
          chosen group; the link is shown exactly once.
        </p>
        <MintInviteForm onMinted={setMinted} />
        {minted && (
          <div className="mint-result" role="status">
            <span className="mint-result-label">Invite link — copy it now, it is not stored:</span>
            <code className="mint-result-url">{minted.registerUrl}</code>
            <CopyButton text={minted.registerUrl} label="Copy the invite link" />
          </div>
        )}
        {(invites.data ?? []).length === 0 ? (
          <Quiet>no invites minted yet</Quiet>
        ) : (
          <SortTable
            rows={invites.data ?? []}
            rowKey={(i) => i.id}
            defaultSort={{ key: 'expires', dir: 'desc' }}
            columns={[
              {
                key: 'group',
                label: 'Group',
                get: (i) => i.group,
                render: (i) => <GroupBadge group={i.group} />,
              },
              {
                key: 'uses',
                label: 'Uses',
                align: 'right',
                mono: true,
                get: (i) => i.uses,
                render: (i) => `${i.uses}/${i.maxUses}`,
              },
              {
                key: 'expires',
                label: 'Expires',
                get: (i) => i.expiresAt,
                render: (i) => <RelTime ts={i.expiresAt} />,
              },
              {
                key: 'note',
                label: 'Note',
                get: (i) => i.note ?? '',
                render: (i) => i.note ?? <span className="muted">—</span>,
              },
              {
                key: 'redeemed',
                label: 'Redeemed by',
                get: (i) => i.redemptions.length,
                render: (i) =>
                  i.redemptions.length === 0 ? (
                    <span className="muted">—</span>
                  ) : (
                    <span
                      title={i.redemptions
                        .map((r) => `${r.displayName} <${r.email}> · ${fmtAbsolute(r.redeemedAt)}`)
                        .join('\n')}
                    >
                      {i.redemptions.map((r) => r.displayName).join(', ')}
                    </span>
                  ),
              },
              {
                key: 'status',
                label: 'Status',
                get: (i) => inviteStatus(i).label,
                render: (i) => {
                  const s = inviteStatus(i)
                  return <StatusDot state={s.state} label={s.label} />
                },
              },
              {
                key: 'actions',
                label: '',
                get: () => '',
                render: (i) => <RevokeButton invite={i} />,
              },
            ]}
          />
        )}
      </section>

      <div className="panel-row">
        <section className="panel">
          <h2 className="panel-title">Audit trail</h2>
          {audit.isPending && <Skeleton height={160} />}
          {audit.isError && <Quiet>audit unavailable — {audit.error.message}</Quiet>}
          {audit.data &&
            (audit.data.length === 0 ? (
              <Quiet>no events recorded yet</Quiet>
            ) : (
              <div className="table-scroll audit-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Event</th>
                      <th>Subject</th>
                      <th>IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.data.map((e, index) => (
                      <tr key={`${e.at}-${index}`}>
                        <td>
                          <RelTime ts={e.at} />
                        </td>
                        <td>
                          <span className="audit-event mono">{e.event}</span>
                        </td>
                        <td className="mono audit-subject" title={e.subject ?? undefined}>
                          {e.subject ?? <span className="muted">—</span>}
                        </td>
                        <td className="mono">{e.ip ?? <span className="muted">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </section>

        <section className="panel">
          <h2 className="panel-title">OIDC clients</h2>
          {clients.isPending && <Skeleton height={160} />}
          {clients.isError && <Quiet>clients unavailable — {clients.error.message}</Quiet>}
          {clients.data && (
            <SortTable
              rows={clients.data}
              rowKey={(c) => c.clientId}
              columns={[
                { key: 'id', label: 'Client', mono: true, get: (c) => c.clientId },
                { key: 'name', label: 'Name', get: (c) => c.name },
                {
                  key: 'type',
                  label: 'Type',
                  get: (c) => (c.confidential ? 'confidential' : 'public'),
                },
                {
                  key: 'scopes',
                  label: 'Scopes',
                  mono: true,
                  get: (c) => c.scopes.join(' '),
                },
              ]}
            />
          )}
        </section>
      </div>
    </>
  )
}
