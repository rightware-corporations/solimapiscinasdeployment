import bcrypt from "bcryptjs";
const password = process.argv[2];
if (!password || password.length < 12) {
  console.error("Use: npm run seed -- \"uma-palavra-passe-com-12+-caracteres\"");
  process.exit(1);
}
console.log(await bcrypt.hash(password, 12));
console.log("Guarde este valor como ADMIN_PASSWORD_HASH. Nenhuma palavra-passe foi guardada.");
