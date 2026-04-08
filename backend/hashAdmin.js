import bcrypt from "bcrypt";
import mysql from "mysql2/promise";
import 'dotenv/config'; 

async function addAdmin() {
    const email = "battambangprogrammer@gmail.com";
    const password = "chemcode"; 
    const hashed = await bcrypt.hash(password, 10);

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME
    });

    await connection.execute(
        "INSERT INTO admins (email, password) VALUES (?, ?)",
        [email, hashed]
    );

    console.log(`Admin ${email} added!`);
    await connection.end();
}

addAdmin();