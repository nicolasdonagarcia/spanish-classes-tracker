// Sets a new password for an account (there is no "forgot password" email in the app).
// Usage:  npm run reset-password -- ana@correo.com NuevaClave123
// Reads MONGODB_URI (and optional MONGODB_DB) from .env / .env.local or the environment.
import { MongoClient } from "mongodb";
import { hashPassword } from "better-auth/crypto";

const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 6) {
  console.error("Uso: npm run reset-password -- correo@ejemplo.com NuevaClave (mínimo 6 caracteres)");
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  console.error("Falta MONGODB_URI (ponla en .env o .env.local).");
  process.exit(1);
}

const client = new MongoClient(process.env.MONGODB_URI);
try {
  const db = client.db(process.env.MONGODB_DB || "registro-clases");
  const user = await db.collection("user").findOne({ email: email.trim().toLowerCase() });
  if (!user) throw new Error(`No existe una cuenta con el correo ${email}`);
  const res = await db
    .collection("account")
    .updateOne(
      { userId: user._id, providerId: "credential" },
      { $set: { password: await hashPassword(password), updatedAt: new Date() } }
    );
  if (!res.matchedCount) throw new Error("La cuenta no tiene contraseña configurada.");
  await db.collection("session").deleteMany({ userId: user._id });
  console.log(`Listo: nueva contraseña para ${user.name} <${user.email}>.`);
} catch (err) {
  console.error(err.message ?? err);
  process.exitCode = 1;
} finally {
  await client.close();
}
