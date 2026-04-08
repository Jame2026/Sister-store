import bcrypt from "bcrypt";

async function run() {
    const password = "123456"; // your admin password
    const hashedPassword = await bcrypt.hash(password, 10); // 10 salt rounds
    console.log("Hashed password:", hashedPassword);
}

run();