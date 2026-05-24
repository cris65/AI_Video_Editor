# 🐺 Database Schema & Interfaces

**Version:** v0.1.66 - 2026-05-24

## MVP Entity: `video_tasks`

| Column | Type | Modifier | Description |
|---|---|---|---|
| `id` | `uuid` | Primary Key, `uuid_generate_v4()` | Unique identifier of the task |
| `frame_io_asset_id` | `text` | NOT NULL | ID of the proxy asset on Frame.io |
| `start_sec` | `integer` | NOT NULL | Start time of the cut in seconds |
| `end_sec` | `integer` | NOT NULL | End time of the cut in seconds |
| `status` | `text` | DEFAULT 'pending' | Processing status (`pending`, `completed`, `failed`) |
