import { pool } from './src/config/db.js';

async function run() {
  try {
    const res = await pool.query(`UPDATE sidemenu SET page_url = '/secure-gate/transport' WHERE menu = 'Transport';`);
    console.log('Updated Transport menu, rows affected:', res.rowCount);
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
