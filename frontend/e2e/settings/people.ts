import { execFileSync } from "node:child_process";
import path from "node:path";
import stack from "../test-stack.cjs";

// Sample people for the settings specs (settings _common.md §7, fictional): real (non-demo) users that S24 counts and
// S25 searches. Real users only come from SSO, which the test stack cannot use, so they are written straight into the
// test database (bambam_e2e, guarded like the rest of the stack) — never the dev database.

export type Person = { code: string; first: string; last: string; firstEn: string; lastEn: string; department: string; role: string | null };

export const PEOPLE: Person[] = [
  // env-defined Superadmin (SUPER_ADMIN_EMPLOYEE_CODES in e2e/test-stack.cjs), no user_roles row
  { code: "EMP0105", first: "ณัฐพล", last: "อินทรวงศ์", firstEn: "Nattapon", lastEn: "Intarawong", department: "ฝ่ายเทคโนโลยีสารสนเทศ", role: null },
  { code: "EMP0118", first: "ปวีณา", last: "ศรีสุข", firstEn: "Paweena", lastEn: "Srisuk", department: "ศูนย์จัดการงานอาคาร", role: "admin" },
  { code: "EMP0122", first: "ชไมพร", last: "รัตนพันธ์", firstEn: "Chamaiporn", lastEn: "Rattanapan", department: "ศูนย์จัดการงานอาคาร", role: "admin" },
  { code: "EMP0231", first: "ธนากร", last: "พึ่งบุญ", firstEn: "Thanakorn", lastEn: "Phuengboon", department: "ฝ่ายอาคารสถานที่", role: "technician" },
  { code: "EMP0310", first: "มาลี", last: "ทองดี", firstEn: "Malee", lastEn: "Thongdee", department: "ฝ่ายอาคารสถานที่", role: "housekeeper_lead" },
  { code: "EMP0311", first: "สมศักดิ์", last: "แก้วกล้า", firstEn: "Somsak", lastEn: "Kaewkla", department: "ฝ่ายอาคารสถานที่", role: "security_lead" },
  { code: "EMP0412", first: "วรรณา", last: "สุขประเสริฐ", firstEn: "Wanna", lastEn: "Sukprasert", department: "ฝ่ายบัญชี", role: null },
  { code: "EMP0413", first: "กิตติพัฒน์", last: "แสงทอง", firstEn: "Kittipat", lastEn: "Saengthong", department: "ฝ่ายจัดซื้อ", role: null },
];

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** Runs SQL on the test database (docker compose db); returns the unaligned output. */
export function psql(sql: string): string {
  stack.assertNotDevDb();
  const u = new URL(stack.DATABASE_URL);
  const db = decodeURIComponent(u.pathname.slice(1));
  if (db !== "bambam_e2e" && !process.env.E2E_DATABASE_URL) throw new Error(`refusing to write sample people into ${db}`);
  const compose = ["compose", "-f", path.join(__dirname, "..", "..", "..", "docker-compose.yml")];
  return execFileSync("docker", [...compose, "exec", "-T", "db", "psql", "-v", "ON_ERROR_STOP=1", "-U", decodeURIComponent(u.username), "-d", db, "-tAc", sql], { encoding: "utf8" }).trim();
}

/**
 * Upserts one person. `resetRole` puts them back at `role` (null = no row = พนักงานทั่วไป); without it an existing
 * person keeps the role another spec may have just given them.
 */
export function upsertPerson(p: Person, role: string | null = p.role, resetRole = true) {
  psql(`
    INSERT INTO platform.users (employee_code, first_name_th, last_name_th, first_name_en, last_name_en, email, department, position_th, is_demo)
    VALUES (${q(p.code)}, ${q(p.first)}, ${q(p.last)}, ${q(p.firstEn)}, ${q(p.lastEn)}, ${q(`${p.firstEn.toLowerCase()}.${p.lastEn[0].toLowerCase()}@example.co.th`)}, ${q(p.department)}, 'พนักงาน', false)
    ON CONFLICT (employee_code) DO UPDATE SET first_name_th = EXCLUDED.first_name_th, last_name_th = EXCLUDED.last_name_th, department = EXCLUDED.department, is_demo = false;
    ${resetRole ? `DELETE FROM platform.user_roles WHERE employee_code = ${q(p.code)};` : ""}
    ${role ? `INSERT INTO platform.user_roles (employee_code, role_id) SELECT ${q(p.code)}, id FROM platform.roles WHERE key = ${q(role)} ON CONFLICT (employee_code) DO NOTHING;` : ""}
  `);
}

/** Every sample person exists (new ones get their sample role). Idempotent and safe while other specs run. */
export function seedPeople() {
  for (const p of PEOPLE) upsertPerson(p, p.role, false);
}

export const person = (code: string) => PEOPLE.find((p) => p.code === code)!;

/** A one-off real user in `roleKey` (S24 "ลบ Role นี้ไม่ได้"); remove with `removePerson`. */
export function addPersonToRole(code: string, roleKey: string) {
  upsertPerson({ code, first: "ทดสอบ", last: code, firstEn: "Test", lastEn: code, department: "ฝ่ายทดสอบ", role: roleKey });
}

export function removePerson(code: string) {
  psql(`DELETE FROM platform.user_roles WHERE employee_code = ${q(code)}; DELETE FROM platform.users WHERE employee_code = ${q(code)} AND NOT is_demo;`);
}
