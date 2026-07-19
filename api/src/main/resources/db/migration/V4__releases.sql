-- Releases module (project 08): GitHub releases cached in Postgres (rate-limit
-- politeness + the module keeps working when GitHub is unreachable), plus a
-- repo mapping for apps whose GitHub repo name differs from the pipeline app
-- name (auth -> auth-service, portfolio -> sebastiancardona-dev.github.io).

alter table app_overrides
    add column repo text;

create table releases
(
    id           bigserial primary key,
    app          text        not null,
    repo         text        not null,
    tag          text        not null,
    name         text,
    body         text,
    prerelease   boolean     not null default false,
    html_url     text,
    published_at timestamptz,
    assets       jsonb,
    synced_at    timestamptz not null,
    constraint releases_repo_tag unique (repo, tag)
);

create index releases_app_published_idx on releases (app, published_at desc);
