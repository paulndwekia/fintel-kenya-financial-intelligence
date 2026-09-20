import mysql from "mysql2/promise";
const connection = await mysql.createConnection(process.env.DATABASE_URL!);
const [rows] = await connection.query("SELECT id, name, status, recordCount, recordsRejected, latestObservation, expectedFrequency, lastSuccessfulUpdate, lastAttemptedAt FROM data_sources ORDER BY id");
console.log(JSON.stringify(rows, null, 2));
await connection.end();
