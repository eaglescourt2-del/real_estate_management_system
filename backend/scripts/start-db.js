const EmbeddedPostgres = require('embedded-postgres').default;
const path = require('path');
const fs = require('fs');

async function main() {
  const dbDir = path.join(__dirname, '..', 'data', 'db');
  console.log(`[EmbeddedPostgres] Database directory: ${dbDir}`);

  const PORT = 15432;

  const isAlreadyInitialised = fs.existsSync(pgVersionFile);

  const pg = new EmbeddedPostgres({
    databaseDir: dbDir,
    port: PORT,
    user: 'postgres',
    password: 'postgres123',
    authMethod: 'password',
    persistent: true,
    initdbFlags: ['-E', 'UTF8', '--locale=C'],
  });

  if (!isAlreadyInitialised) {
    console.log('[EmbeddedPostgres] Initialising PostgreSQL cluster with UTF8 encoding...');
    await pg.initialise();
    console.log('[EmbeddedPostgres] Initialization complete.');
  } else {
    console.log('[EmbeddedPostgres] PostgreSQL cluster is already initialised.');
  }

  // Ensure postgresql.conf has port 15432 and listen_addresses = 127.0.0.1
  const postgresqlConf = path.join(dbDir, 'postgresql.conf');
  if (fs.existsSync(postgresqlConf)) {
    let conf = fs.readFileSync(postgresqlConf, 'utf8');
    conf = conf.replace(/#?port\s*=\s*\d+/, `port = ${PORT}`);
    conf = conf.replace(/#?listen_addresses\s*=\s*'[^\']*'/, `listen_addresses = '127.0.0.1'`);
    fs.writeFileSync(postgresqlConf, conf, 'utf8');
    console.log(`[EmbeddedPostgres] Confirmed postgresql.conf port = ${PORT} and listen_addresses = 127.0.0.1`);
  }

  console.log(`[EmbeddedPostgres] Starting PostgreSQL on port ${PORT}...`);
  await pg.start();
  console.log(`[EmbeddedPostgres] PostgreSQL is running on port ${PORT}.`);

  try {
    console.log('[EmbeddedPostgres] Ensuring database "real_estate_db" exists...');
    await pg.createDatabase('real_estate_db');
    console.log('[EmbeddedPostgres] Database "real_estate_db" is ready.');
  } catch (err) {
    if (err.message && err.message.includes('already exists')) {
      console.log('[EmbeddedPostgres] Database "real_estate_db" already exists.');
    } else {
      console.log('[EmbeddedPostgres] Database notice:', err.message || err);
    }
  }

  console.log(`[EmbeddedPostgres] Server ready at postgresql://postgres:postgres123@localhost:${PORT}/real_estate_db`);

  // Keep process running
  setInterval(() => {}, 1000 * 60);

  const shutdown = async () => {
    console.log('\n[EmbeddedPostgres] Stopping PostgreSQL server...');
    try {
      await pg.stop();
      console.log('[EmbeddedPostgres] Stopped cleanly.');
    } catch (e) {
      console.error('[EmbeddedPostgres] Stop error:', e);
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[EmbeddedPostgres] Fatal error:', err);
  process.exit(1);
});
