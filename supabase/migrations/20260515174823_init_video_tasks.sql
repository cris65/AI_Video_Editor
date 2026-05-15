-- MVP Video Tasks Table
create table public.video_tasks (
    id uuid not null default uuid_generate_v4() primary key,
    frame_io_asset_id text not null,
    start_sec integer not null,
    end_sec integer not null,
    status text not null default 'pending',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS (Row Level Security) - currently open for MVP, but should be secured later
alter table public.video_tasks enable row level security;
create policy "Allow all operations for MVP" on public.video_tasks for all using (true);
