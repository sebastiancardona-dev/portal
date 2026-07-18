-- Optional per-app base host (e.g. tools.sebastiancardona.dev): lets an
-- environment without Docker discovery (the test slot) still build health
-- URLs by convention — prod = https://<baseHost>, test = first label + "-test".
alter table app_overrides add column base_host text;
