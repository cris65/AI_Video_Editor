# 🐺 Database Schema & Interfaces

## Entità MVP: `video_tasks`

| Colonna | Tipo | Modificatore | Descrizione |
|---|---|---|---|
| `id` | `uuid` | Primary Key, `uuid_generate_v4()` | Identificatore univoco del task |
| `frame_io_asset_id` | `text` | NOT NULL | ID dell'asset proxy su Frame.io |
| `start_sec` | `integer` | NOT NULL | Secondo d'inizio del taglio |
| `end_sec` | `integer` | NOT NULL | Secondo di fine del taglio |
| `status` | `text` | DEFAULT 'pending' | Stato dell'elaborazione (`pending`, `completed`, `failed`) |
