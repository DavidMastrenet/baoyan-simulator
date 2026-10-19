import { readFile, readdir, mkdir, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE = path.join(ROOT, 'content'),
  OUT = path.join(ROOT, 'public/story/v2');
const statKeys = [
  'study',
  'research',
  'english',
  'craft',
  'practice',
  'expression',
  'network',
  'energy',
  'stress',
  'money',
  'integrity',
  'materials',
  'backup',
];
const majors = ['计算机类', '理工实验类', '经管类', '人文社科类', '师范教育类', '交叉学科'];
const errors = [];
const assert = (condition, message) => {
  if (!condition) errors.push(message);
};
export function resourceName(kind, id) {
  let a = 2166136261,
    b = 2246822507;
  for (const c of `${kind}/${id}`) {
    a = Math.imul(a ^ c.charCodeAt(0), 16777619);
    b = Math.imul(b ^ c.charCodeAt(0), 3266489909);
  }
  return (
    (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0') + '.json'
  );
}
async function readFolder(name) {
  return Promise.all(
    (await readdir(path.join(SOURCE, name)))
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map(async (f) => JSON.parse(await readFile(path.join(SOURCE, name, f), 'utf8'))),
  );
}
const [events, questions, endings] = await Promise.all(
  ['events', 'questions', 'endings'].map(readFolder),
);
const programs = JSON.parse(await readFile(path.join(SOURCE, 'programs.json'), 'utf8'));
const ids = new Set(events.map((e) => e.id));
function condition(c, where) {
  if (!c) return;
  for (const field of ['min', 'max'])
    for (const [key, n] of Object.entries(c[field] ?? {}))
      assert(statKeys.includes(key) && Number.isFinite(n), `${where}: invalid condition ${key}`);
  for (const key of ['from', 'to'])
    if (c[key] !== undefined)
      assert(Number.isInteger(c[key]) && c[key] >= 0 && c[key] < 48, `${where}: invalid turn`);
  if (c.from !== undefined && c.to !== undefined)
    assert(c.from <= c.to, `${where}: inverted turn range`);
  for (const k of ['flags', 'notFlags', 'anyFlags'])
    if (c[k])
      assert(Array.isArray(c[k]) && c[k].every((f) => typeof f === 'string'), `${where}: flags`);
  if (c.majors)
    assert(
      c.majors.every((m) => majors.includes(m)),
      `${where}: major`,
    );
}
function consequence(c, where) {
  assert(typeof c.text === 'string' && c.text.length > 0, `${where}: consequence text`);
  for (const [key, n] of Object.entries(c.effects ?? {}))
    assert(statKeys.includes(key) && Number.isFinite(n), `${where}: effect ${key}`);
  for (const next of c.schedule ?? []) {
    assert(ids.has(next.id), `${where}: missing chain ${next.id}`);
    assert(
      Number.isInteger(next.after) && next.after >= 0 && next.after <= 47,
      `${where}: schedule delay`,
    );
  }
  if (c.award)
    assert(
      c.award.id && c.award.title && c.award.level >= 1 && c.award.level <= 3,
      `${where}: award`,
    );
  if (c.course)
    assert(
      c.course.title &&
        Number.isFinite(c.course.score) &&
        c.course.score >= 0 &&
        c.course.score <= 100 &&
        c.course.credits > 0 &&
        c.course.credits <= 6 &&
        ['all', 'policy', 'none'].includes(c.course.counted),
      `${where}: course`,
    );
}
for (const [kind, items] of Object.entries({ events, questions, endings })) {
  assert(new Set(items.map((e) => e.id)).size === items.length, `${kind}: duplicate id`);
  assert(
    new Set(items.map((e) => resourceName(kind, e.id))).size === items.length,
    `${kind}: filename collision`,
  );
  for (const e of items) assert(/^[a-z0-9.-]+$/.test(e.id), `${kind}: unsafe id`);
}
for (const e of events) {
  assert(
    e.title &&
      e.scene &&
      Array.isArray(e.body) &&
      e.body.every((t) => typeof t === 'string') &&
      e.body.length >= 1,
    e.id + ': prose',
  );
  assert(e.choices.length >= 2 && e.choices.length <= 5, e.id + ': choices');
  condition(e.when, e.id);
  for (const v of e.variants ?? []) condition(v.when, e.id);
  for (const c of e.choices) {
    if (typeof c.hint === 'string') c.hint = c.hint.replace(/^[\s;；]+/, '') || '根据当前情况处理';
    assert(c.label && c.hint, e.id + ': choice label');
    condition(c.when, e.id);
    consequence(c, e.id);
    if (c.check) {
      assert(
        statKeys.includes(c.check.stat) && Number.isFinite(c.check.difficulty),
        e.id + ': check',
      );
      consequence(c.check.success, e.id);
      consequence(c.check.failure, e.id);
    }
    for (const o of c.outcomes ?? []) {
      assert(Number.isFinite(o.weight) && o.weight > 0, e.id + ': outcome weight');
      condition(o.when, e.id);
      consequence(o, e.id);
    }
  }
}
for (let turn = 0; turn < 48; turn++)
  assert(
    events.filter((e) => e.calendar === turn).length === 1,
    `calendar ${turn}: expected one event`,
  );
for (const e of events.filter((e) => e.chain))
  assert(
    e.id.startsWith('new.background.') ||
      events.some((x) =>
        x.choices.some((c) =>
          [c, c.check?.success, c.check?.failure, ...(c.outcomes ?? [])].some((k) =>
            k?.schedule?.some((n) => n.id === e.id),
          ),
        ),
      ),
    `orphan chain: ${e.id}`,
  );
for (const q of questions)
  assert(
    q.title &&
      q.text &&
      q.options.length === 3 &&
      q.options.every(
        (a) => a.text && a.response && Number.isInteger(a.score) && a.score >= 0 && a.score <= 4,
      ) &&
      q.options.some((a) => a.score === 4),
    q.id + ': question',
  );
for (const code of ['cs', 'lab', 'biz', 'human', 'edu', 'cross'])
  for (let i = 0; i < 12; i++)
    assert(
      questions.some((q) => q.id === `q.${code}.${i}`),
      `missing q.${code}.${i}`,
    );
for (let i = 0; i < 14; i++)
  assert(
    questions.some((q) => q.id === `q.english.${i}`),
    `missing English ${i}`,
  );
for (let i = 0; i < 20; i++)
  assert(
    questions.some((q) => q.id === `q.method.${i}`),
    `missing methods ${i}`,
  );
const endingSource = await readFile(path.join(ROOT, 'src/engine/endings.ts'), 'utf8');
const endingIds = [...endingSource.matchAll(/return '([^']+)'/g)].map((m) => m[1]);
for (const id of endingIds)
  assert(
    endings.some((e) => e.id === id),
    `missing ending ${id}`,
  );
for (const e of endings)
  assert(
    e.title && e.subtitle && e.body?.length >= 2 && endingIds.includes(e.id),
    e.id + ': ending',
  );
assert(new Set(programs.map((p) => p.id)).size === programs.length, 'duplicate program');
for (const p of programs)
  assert(
    p.school &&
      p.department &&
      p.tier >= 1 &&
      p.tier <= 4 &&
      p.fee >= 0 &&
      p.gpaMin <= 4 &&
      ['research', 'craft', 'practice'].includes(p.track) &&
      [...majors, '不限'].includes(p.major) &&
      p.available.every((s) => ['summer', 'pre', 'late'].includes(s)),
    p.id + ': program',
  );
if (errors.length) throw new Error(errors.join('\n'));
await rm(OUT, { recursive: true, force: true });
for (const dir of ['chapters', 'events', 'questions', 'endings'])
  await mkdir(path.join(OUT, dir), { recursive: true });
for (const [kind, items] of Object.entries({ events, questions, endings }))
  for (const item of items)
    await writeFile(path.join(OUT, kind, resourceName(kind, item.id)), JSON.stringify(item));
const ranges = [
  [0, 11],
  [12, 23],
  [24, 31],
  [32, 38],
  [39, 47],
];
for (let chapter = 0; chapter < 5; chapter++) {
  const [from, to] = ranges[chapter];
  const list = events
    .filter(
      (e) =>
        (e.when?.to ?? 47) >= from &&
        (e.when?.from ?? 0) <= to &&
        (e.calendar === undefined || (e.calendar >= from && e.calendar <= to)),
    )
    .map((e) => ({
      id: e.id,
      file: resourceName('events', e.id),
      category: e.category,
      when: e.when,
      weight: e.weight ?? 10,
      calendar: e.calendar,
      egg: e.egg,
      rare: e.rare,
      chain: e.chain,
      once: e.once,
    }));
  await writeFile(
    path.join(OUT, 'chapters', `${chapter}.json`),
    JSON.stringify({ version: 1, chapter, events: list }),
  );
}
await writeFile(path.join(OUT, 'programs.json'), JSON.stringify(programs));
const counts = {
  version: 1,
  events: events.length,
  choices: events.reduce((n, e) => n + e.choices.length, 0),
  calendar: 48,
  chains: events.filter((e) => e.chain).length,
  eggs: events.filter((e) => e.egg).length,
  rare: events.filter((e) => e.rare).length,
  backgrounds: events.filter((e) => e.id.startsWith('new.background.')).length,
  questions: questions.length,
  endings: endings.length,
  programs: programs.length,
};
await writeFile(path.join(OUT, 'counts.json'), JSON.stringify(counts, null, 2));
console.log(JSON.stringify(counts, null, 2));
