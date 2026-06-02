import fs from 'fs';
import path from 'path';
import pool from './connection';

async function migrate(): Promise<void> {
  console.log('-- Running Migration ---');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         INT          NOT NULL AUTO_INCREMENT,
      filename   VARCHAR(255) NOT NULL,
      run_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_migrations_filename (filename)
    )
  `);
  console.log('Migrations table ready');

  const migrationDir = path.join(__dirname, 'migrations');
  console.log(`Looking in: ${migrationDir}`);

  const allFiles = fs.readdirSync(migrationDir);
  console.log(`All files found: ${JSON.stringify(allFiles)}`);

  const files = allFiles.filter(f => f.endsWith('.sql')).sort();
  console.log(`SQL files to process: ${JSON.stringify(files)}`);

  if (files.length === 0) {
    console.log('No SQL files found — check the migrations folder');
    process.exit(0);
  }

  for (const file of files) {
    const [rows]: any = await pool.query(
      'SELECT id FROM _migrations WHERE filename = ?',
      [file]
    );

    if ((rows as any[]).length > 0) {
      console.log(`Skipping ${file} — already run`);
      continue;
    }

    console.log(`Running ${file}...`);
    const sql = fs.readFileSync(path.join(migrationDir, file), 'utf-8');

    const statements = sql
        .split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n')
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    console.log(`Found ${statements.length} statements`);

    for (let i = 0; i < statements.length; i++) {
      try {
        await pool.query(statements[i]);
        console.log(`Statement ${i + 1}/${statements.length} done`);
      }
      catch (err: any) {
        console.error(`Statement ${i + 1} failed:`, err.message);
        console.error(`SQL: ${statements[i].substring(0, 100)}...`);
        throw err;
      }
    }

    await pool.query('INSERT INTO _migrations (filename) VALUES (?)', [file]);
    console.log(`✅ Ran ${file}`);
  }

  console.log('\n----- Migration complete.-----');
  process.exit(0);
}

migrate().catch(err => {
  console.error('-----Migration failed -----', err.message);
  process.exit(1);
});