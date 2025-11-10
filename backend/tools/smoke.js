#!/usr/bin/env node
// Simple smoke test for local dev
// - registers a user
// - finds the confirm token in SQLite
// - calls /auth/confirm
// - logs in and checks /me/status

import fetch from 'node-fetch';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE = process.env.APP_URL || 'http://localhost:3000';
const DB_PATH = path.join(__dirname, '..', 'src', 'twinside.sqlite');

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

(async ()=>{
  console.log('Running smoke test against', BASE);

  const email = `smoke+${Date.now()}@local`;
  const password = 'Sm0kePass!';
  const nick = `smoke${Date.now()}`;

  try {
    // register
    console.log('1) Registering user', email);
    const reg = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, nick, gender: 'woman', city: 'Local' }),
    });
    const regJson = await reg.json().catch(()=>null);
    console.log(' register response:', reg.status, regJson);

    // wait a bit for token to be written
    await sleep(500);

    // read token from sqlite directly
    const db = new Database(DB_PATH, { readonly: true });
    const row = db.prepare("SELECT * FROM email_tokens WHERE user_id = (SELECT id FROM users WHERE email=?) AND purpose='confirm_email' ORDER BY id DESC LIMIT 1").get(email);
    if (!row) {
      console.error('Could not find confirm token in DB. Check logs for email sending.');
      process.exit(2);
    }
    console.log('2) Found token in DB id=', row.id);

    // call confirm
    const confirmUrl = `${BASE}/auth/confirm?token=${row.token}`;
    console.log('3) Calling confirm URL');
    const conf = await fetch(confirmUrl);
    const confText = await conf.text();
    console.log(' confirm status', conf.status, confText.slice(0,200));

    // login
    console.log('4) Logging in');
    const loginRes = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      redirect: 'manual',
    });
    const cookies = loginRes.headers.raw()['set-cookie'] || [];
    console.log(' login status', loginRes.status, 'set-cookie:', cookies.length);

    const cookie = cookies.map(c=>c.split(';')[0]).join('; ');

    if (!cookie) {
      console.error('Login did not set auth cookie');
      process.exit(3);
    }

    const statusRes = await fetch(`${BASE}/me/status`, {
      headers: { Cookie: cookie }
    });
    const statusJson = await statusRes.json().catch(()=>null);
    console.log('5) /me/status', statusRes.status, statusJson);

    if (statusJson && statusJson.ok) {
      console.log('SMOKE OK');
      process.exit(0);
    } else {
      console.error('SMOKE FAIL');
      process.exit(4);
    }

  } catch (e) {
    console.error('Error in smoke test:', e);
    process.exit(1);
  }
})();
