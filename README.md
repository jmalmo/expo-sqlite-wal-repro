# expo-sqlite WAL/SHM Cleanup Bug Reproduction

Minimal reproduction for [expo/expo#43441](https://github.com/expo/expo/issues/43441).

## Bug

`deleteDatabaseSync` / `deleteDatabaseAsync` in `expo-sqlite` only removes the main database file. If SQLite WAL (Write-Ahead Logging) sidecar files (`-wal`, `-shm`) exist on disk — e.g. after a crash or abnormal exit — they are **not** cleaned up.

This can lead to stale WAL replay when a new database is created with the same name.

## How to reproduce

```bash
npm install
USE_WATCHMAN=0 npx expo run:ios
```

Tap **"Run Test"** in the app. The test:

1. Opens a database in WAL mode, writes data, closes it
2. Creates fake `-wal` and `-shm` files (simulating crash leftovers)
3. Calls `deleteDatabaseAsync()`
4. Checks whether the sidecar files were removed

**Expected:** All files removed.
**Actual:** `-wal` and `-shm` files remain on disk.

## Fix

PR: [expo/expo#43442](https://github.com/expo/expo/pull/43442)
