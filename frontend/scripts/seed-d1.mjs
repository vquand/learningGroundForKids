// Deprecated: the Sites/D1 pipeline is retired. Retain this entry point only
// so older operator instructions fail clearly without invoking Wrangler.
console.error("db:seed:local in frontend is deprecated and refuses to run: Sites/D1 is retired. Use npm run db:seed:local --prefix server for the guarded local Render/Neon seed pipeline.");
process.exitCode = 1;
