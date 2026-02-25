import { registerRootComponent } from "expo";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View, Button, ScrollView } from "react-native";
import * as SQLite from "expo-sqlite";
import * as FileSystem from "expo-file-system/legacy";
import { useState } from "react";

export default function App() {
  const [log, setLog] = useState([]);

  const addLog = (msg) => setLog((prev) => [...prev, msg]);

  const runTest = async () => {
    setLog([]);
    const dbName = "wal-test.db";
    const dbPath = `${FileSystem.documentDirectory}SQLite/${dbName}`;

    // Clean up from previous runs
    try { await SQLite.deleteDatabaseAsync(dbName); } catch {}
    try { await FileSystem.deleteAsync(dbPath + "-wal", { idempotent: true }); } catch {}
    try { await FileSystem.deleteAsync(dbPath + "-shm", { idempotent: true }); } catch {}

    addLog("1. Opening database...");
    let db = await SQLite.openDatabaseAsync(dbName);

    addLog("2. Enabling WAL mode...");
    await db.execAsync("PRAGMA journal_mode = WAL");

    addLog("3. Creating table and inserting data...");
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, value TEXT);
      INSERT INTO test (value) VALUES ('hello');
    `);

    addLog("4. Closing database...");
    await db.closeAsync();

    addLog("5. Simulating crash leftovers...");
    addLog("   (writing fake -wal and -shm files)");
    // After a crash or abnormal exit, WAL/SHM files remain on disk.
    // We simulate this by creating them after a clean close.
    await FileSystem.writeAsStringAsync(dbPath + "-wal", "stale WAL data from crash");
    await FileSystem.writeAsStringAsync(dbPath + "-shm", "stale SHM data from crash");

    addLog("6. Checking files BEFORE delete:");
    const mainExists = await FileSystem.getInfoAsync(dbPath);
    const walExists = await FileSystem.getInfoAsync(dbPath + "-wal");
    const shmExists = await FileSystem.getInfoAsync(dbPath + "-shm");
    addLog(`   main db: ${mainExists.exists ? "EXISTS" : "missing"}`);
    addLog(`   -wal:    ${walExists.exists ? "EXISTS" : "missing"}`);
    addLog(`   -shm:    ${shmExists.exists ? "EXISTS" : "missing"}`);

    addLog("7. Deleting database via deleteDatabaseAsync...");
    await SQLite.deleteDatabaseAsync(dbName);

    addLog("8. Checking files AFTER delete:");
    const mainAfter = await FileSystem.getInfoAsync(dbPath);
    const walAfter = await FileSystem.getInfoAsync(dbPath + "-wal");
    const shmAfter = await FileSystem.getInfoAsync(dbPath + "-shm");
    addLog(`   main db: ${mainAfter.exists ? "EXISTS" : "missing (ok)"}`);
    addLog(
      `   -wal:    ${walAfter.exists ? "EXISTS \u2190 BUG! Not cleaned up" : "missing (ok)"}`
    );
    addLog(
      `   -shm:    ${shmAfter.exists ? "EXISTS \u2190 BUG! Not cleaned up" : "missing (ok)"}`
    );

    if (walAfter.exists || shmAfter.exists) {
      addLog("\n\u274C BUG REPRODUCED: WAL/SHM files were NOT deleted");
      addLog("   deleteDatabaseAsync only removes the main db file.");
      addLog("   Stale WAL can be replayed against a new db with");
      addLog("   the same name, causing corruption.");
    } else {
      addLog("\n\u2705 All files cleaned up correctly");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>expo-sqlite WAL/SHM Cleanup Test</Text>
      <Button title="Run Test" onPress={runTest} />
      <ScrollView style={styles.logContainer}>
        {log.map((msg, i) => (
          <Text key={i} style={styles.logText}>
            {msg}
          </Text>
        ))}
      </ScrollView>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 40, paddingTop: 80 },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 20 },
  logContainer: { marginTop: 20, flex: 1 },
  logText: { fontFamily: "monospace", fontSize: 13, marginBottom: 4 },
});

registerRootComponent(App);
