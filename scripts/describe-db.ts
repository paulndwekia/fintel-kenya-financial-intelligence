import mysql from "mysql2/promise";
const connection = await mysql.createConnection(process.env.DATABASE_URL!);
const [rows] = await connection.query("DESCRIBE treasury_bonds");
console.log(JSON.stringify(rows, null, 2));
await connection.end();
