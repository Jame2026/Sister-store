import bcrypt from "bcrypt";
import mysql from "mysql2/promise";

async function addAdmin() {
    const password = "chemcode";
    const hashed = await bcrypt.hash(password, 10);

    const connection = await mysql.createConnection({
        host: "<AWS_DB_ENDPOINT>",
        user: "<DB_USERNAME>",
        password: "<DB_PASSWORD>",
        database: "sister_store"
    });

    await connection.execute(
        "INSERT INTO admins (email, password) VALUES (?, ?)",
        ["admin@gmail.com", hashed]
    );

    console.log("Admin added!");
    await connection.end();
}

addAdmin();