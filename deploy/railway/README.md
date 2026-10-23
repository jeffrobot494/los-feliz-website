# Railway preview

A temporary, always-on copy of the WordPress site for client review, hosted on Railway.
It is a full WordPress install (forms, editor, Instagram feed all work), seeded from the Local site.

## Deploy or update

From the repo root in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\railway\deploy-preview.ps1
```

- **First run** logs in to Railway (browser), creates the project `lfar-preview` with a MySQL
  database and a `web` service, gives it a `*.up.railway.app` address and uploads the site.
- **Later runs** upload again. The theme comes from `theme/lfar` in this repo; uploads and the
  database come from the Local site (`app\sql\local.sql`, which Local refreshes when the site is stopped).
- When the database snapshot has changed, the preview's database is **replaced** by it on start-up
  (so anything entered on the preview, like test form entries, is lost). Same snapshot = data kept.

## What's different from Local

- URLs are rewritten to the Railway address; search engines are told not to index it.
- WordPress logins are the same as on Local.
- **Form emails don't send** (no mail server). Submissions are still saved under Fluent Forms → Entries.
- Media uploaded on the preview is lost on the next deploy (no persistent disk). Add media in Local.

## Files

| File | Purpose |
| --- | --- |
| `Dockerfile` | PHP 8.2 + Apache, WordPress 7.1.3, Fluent Forms 6.2.16, theme, uploads |
| `docker-entrypoint.sh` | Waits for MySQL, loads a new snapshot, rewrites URLs, starts Apache on `$PORT` |
| `import-db.php` | Loads the mysqldump file through PHP (no MySQL client needed) |
| `wp-config.php` | Reads Railway's `MYSQL*` and `RAILWAY_PUBLIC_DOMAIN` variables |
| `deploy-preview.ps1` | Bundles everything in `%LOCALAPPDATA%\lfar-railway` and runs `railway up` |

## Taking it down

Railway dashboard → project `lfar-preview` → Settings → Delete project.
