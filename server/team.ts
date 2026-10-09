import type { AdminTeamMember, PublicTeamMember } from '../shared/team';
import type { TeamMemberInput } from '../shared/schemas';
import type { Db } from './db';

type Row = {
  id: number;
  name: string;
  role: string;
  bio: string;
  quote: string;
  photo: string | null;
  facts: string;
  visible: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const toPublic = (r: Row): PublicTeamMember => ({
  id: r.id,
  name: r.name,
  role: r.role,
  bio: r.bio,
  quote: r.quote,
  photo: r.photo,
  facts: JSON.parse(r.facts),
});

const toAdmin = (r: Row): AdminTeamMember => ({
  ...toPublic(r),
  visible: Boolean(r.visible),
  sortOrder: r.sort_order,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const ORDER = 'ORDER BY sort_order, id';

export function listVisibleTeam(db: Db): PublicTeamMember[] {
  return (db.prepare(`SELECT * FROM team_members WHERE visible = 1 ${ORDER}`).all() as Row[]).map(toPublic);
}

export function listTeam(db: Db): AdminTeamMember[] {
  return (db.prepare(`SELECT * FROM team_members ${ORDER}`).all() as Row[]).map(toAdmin);
}

export function getTeamMember(db: Db, id: number): AdminTeamMember | undefined {
  const row = db.prepare('SELECT * FROM team_members WHERE id = ?').get(id) as Row | undefined;
  return row && toAdmin(row);
}

const values = (input: TeamMemberInput) => ({ ...input, facts: JSON.stringify(input.facts), visible: input.visible ? 1 : 0 });

export function createTeamMember(db: Db, input: TeamMemberInput): AdminTeamMember {
  // New members go to the end of the list.
  const { next } = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM team_members').get() as { next: number };
  const info = db
    .prepare('INSERT INTO team_members (name, role, bio, quote, photo, facts, visible, sort_order) VALUES (@name, @role, @bio, @quote, @photo, @facts, @visible, @sortOrder)')
    .run({ ...values(input), sortOrder: next });
  return getTeamMember(db, Number(info.lastInsertRowid))!;
}

export function updateTeamMember(db: Db, id: number, input: TeamMemberInput): AdminTeamMember | undefined {
  db.prepare(
    `UPDATE team_members SET name = @name, role = @role, bio = @bio, quote = @quote, photo = @photo, facts = @facts,
     visible = @visible, updated_at = datetime('now') WHERE id = @id`,
  ).run({ ...values(input), id });
  return getTeamMember(db, id);
}

export function deleteTeamMember(db: Db, id: number) {
  return db.prepare('DELETE FROM team_members WHERE id = ?').run(id).changes > 0;
}

/** Saves a new order; `ids` must contain every member exactly once. */
export function reorderTeam(db: Db, ids: number[]) {
  const all = (db.prepare('SELECT id FROM team_members').all() as { id: number }[]).map((r) => r.id);
  if (ids.length !== all.length || new Set(ids).size !== ids.length || !all.every((id) => ids.includes(id))) return false;
  const update = db.prepare('UPDATE team_members SET sort_order = ? WHERE id = ?');
  db.transaction(() => ids.forEach((id, i) => update.run(i, id)))();
  return true;
}
