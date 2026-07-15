-- Project 05 SSO: identity moves to the auth service (same pattern as MoneyTrckr V5).
-- users rows stay (dashboard layouts FK them); auth_uid links a row to its ecosystem
-- account. Portal never shipped with local logins, so password_hash goes outright.

alter table users add column auth_uid uuid unique;
alter table users drop column password_hash;

-- role vocabulary: 'admin' (full) | 'viewer' (read-only: recruiter/friend groups)
alter table users alter column role set default 'viewer';

-- Spring Session JDBC schema (spring.session.jdbc.initialize-schema=never — Flyway owns DDL)
create table spring_session (
    primary_id            char(36) not null,
    session_id            char(36) not null,
    creation_time         bigint not null,
    last_access_time      bigint not null,
    max_inactive_interval int not null,
    expiry_time           bigint not null,
    principal_name        varchar(100),
    constraint spring_session_pk primary key (primary_id)
);

create unique index spring_session_ix1 on spring_session (session_id);
create index spring_session_ix2 on spring_session (expiry_time);
create index spring_session_ix3 on spring_session (principal_name);

create table spring_session_attributes (
    session_primary_id char(36) not null,
    attribute_name     varchar(200) not null,
    attribute_bytes    bytea not null,
    constraint spring_session_attributes_pk primary key (session_primary_id, attribute_name),
    constraint spring_session_attributes_fk foreign key (session_primary_id)
        references spring_session (primary_id) on delete cascade
);
