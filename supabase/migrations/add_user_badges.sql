-- user_badges: persists earned gamification badges per user

create table if not exists user_badges (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users(id) on delete cascade not null,
  badge_id   text        not null,
  earned_at  timestamptz default now() not null,
  unique(user_id, badge_id)
);

alter table user_badges enable row level security;

drop policy if exists "Users manage own badges" on user_badges;

create policy "Users manage own badges"
  on user_badges for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
