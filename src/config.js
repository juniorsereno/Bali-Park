function getConfig(env = process.env) {
  for (const name of [
    "DATABASE_URL",
    "DASHBOARD_ACCESS_CODE",
    "SESSION_SECRET",
  ]) {
    if (!env[name]?.trim()) throw new Error(`Configure ${name} no ambiente.`);
  }
  if (env.SESSION_SECRET.length < 32)
    throw new Error("SESSION_SECRET deve ter pelo menos 32 caracteres.");
  return {
    accessCode: env.DASHBOARD_ACCESS_CODE,
    sessionSecret: env.SESSION_SECRET,
    cookieSecure:
      env.COOKIE_SECURE === undefined
        ? env.NODE_ENV === "production"
        : env.COOKIE_SECURE === "true",
    trustProxy: env.TRUST_PROXY === "1" ? 1 : false,
  };
}
module.exports = { getConfig };
