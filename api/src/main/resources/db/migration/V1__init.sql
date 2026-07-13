-- Portal baseline schema. See docs/DESIGN.md (storage section) for rationale.
-- Postgres doubles as the TSDB for v1 — a deliberate, documented trade-off.

-- v1: a single seeded admin; the table shape survives the project-05 OIDC swap.
create table users (
    id            uuid primary key default gen_random_uuid(),
    email         text not null,
    name          text not null,
    password_hash text not null,
    role          text not null default 'admin',
    created_at    timestamptz not null default now()
);
create unique index ux_users_email on users (lower(email));

-- Optional display metadata for discovered apps — never required to show up.
create table app_overrides (
    app          text primary key,
    display_name text,
    icon         text,
    visible      boolean not null default true,
    health_path  text
);

-- Uptime history: one row per health probe (14d retention).
create table health_checks (
    id          uuid primary key default gen_random_uuid(),
    ts          timestamptz not null,
    app         text not null,
    env         text not null,
    up          boolean not null,
    http_status int,
    latency_ms  bigint
);
create index ix_health_checks_app_env_ts on health_checks (app, env, ts desc);

-- Host + container series: source `host` / `container:<name>` (14d retention).
create table metric_points (
    id     uuid primary key default gen_random_uuid(),
    ts     timestamptz not null,
    source text not null,
    metric text not null,
    value  double precision not null
);
create index ix_metric_points_source_metric_ts on metric_points (source, metric, ts desc);

-- One saved widget-grid layout per user; opaque to the server.
create table dashboard_layouts (
    user_id    uuid primary key references users (id),
    layout     jsonb not null,
    updated_at timestamptz not null default now()
);
