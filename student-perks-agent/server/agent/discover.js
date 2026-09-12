import { spawn } from 'node:child_process';

const PROFILE = process.env.WEBCMD_PROFILE || 'student-perks-agent';
const SEARCH_SITE = 'https://www.google.com/';
const COMMAND_TIMEOUT_MS = 150_000;

function runCommand(args, input = '', timeoutMs = COMMAND_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const child = spawn('webcmd.cmd', args, { shell: true, windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Webcmd command timed out: webcmd ${args.join(' ')}`));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
    if (input) child.stdin.write(input);
    child.stdin.end();
  });
}

function parseJsonCommand(result, label) {
  if (result.code !== 0) throw new Error(`${label} failed: ${result.stderr || result.stdout}`.trim());
  const starts = [result.stdout.indexOf('{'), result.stdout.indexOf('[')].filter((value) => value >= 0);
  if (!starts.length) throw new Error(`${label} returned no JSON.`);
  try { return JSON.parse(result.stdout.slice(Math.min(...starts))); }
  catch { throw new Error(`${label} returned invalid JSON.`); }
}

async function ensureProfile() {
  const listed = await runCommand(['profile', 'list', '-f', 'json']);
  if (listed.code === 0) {
    const profiles = parseJsonCommand(listed, 'Webcmd profile list');
    if (profiles.some((profile) => profile.alias === PROFILE || profile.contextId === PROFILE)) return;
  }
  const created = await runCommand(['profile', 'create', PROFILE]);
  if (created.code !== 0 && !/already exists|duplicate|exists/i.test(`${created.stdout} ${created.stderr}`)) {
    throw new Error(`Webcmd profile create failed: ${created.stderr || created.stdout}`.trim());
  }
}

function buildResearchProgram(profile) {
  const country = JSON.stringify(profile.country);
  const fieldOfStudy = JSON.stringify(profile.fieldOfStudy);
  const interests = JSON.stringify(profile.interests);
  return `
const profile = { country: ${country}, fieldOfStudy: ${fieldOfStudy}, interests: ${interests} };
const interestTerms = (profile.interests + ' ' + profile.fieldOfStudy).toLowerCase().split(/[,\\s]+/).filter(term => term.length > 2);
const queries = [
  'student discount free student program ' + profile.fieldOfStudy + ' ' + profile.interests + ' official ' + profile.country,
];
const candidates = [];

function hostOf(value) {
  const match = value.match(/^https?:[/][/]([^/]+)/i);
  return match ? match[1].split(':')[0].toLowerCase().replace(/^www[.]/, '') : '';
}
function cleanUrl(value) {
  if (!/^https?:[/][/]/i.test(value)) return null;
  const match = value.match(/^https?:[/][/]([^/]+)/i);
  if (!match) return null;
  return match[1].split(':')[0].toLowerCase().replace(/^www[.]/, '');
}
function matchingTerms(text) {
  const lower = text.toLowerCase();
  return interestTerms.filter(term => lower.includes(term));
}

for (const query of queries) {
  await page.goto('https://www.google.com/search?q=' + encodeURIComponent(query), { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
  await page.locator('body').waitFor({ timeout: 5000 });
  const links = await page.locator('a').evaluateAll(anchors => anchors.map(anchor => ({ href: anchor.href, text: anchor.textContent?.trim() })));
  for (const link of links) {
    if (!/^https?:[/][/]/i.test(link.href) || !link.text || link.text.length < 8) continue;
    const terms = matchingTerms(link.text);
    if (terms.length === 0 || candidates.some(item => item.url === link.href)) continue;
    candidates.push({ url: link.href, searchTitle: link.text, matchingTerms: terms });
  }
}

const targets = candidates
  .sort((a, b) => b.matchingTerms.length - a.matchingTerms.length)
  .slice(0, 7);
return {
  searchedQueries: queries,
  offers: targets.map(candidate => ({
    provider: hostOf(candidate.url) || 'Provider shown in search result',
    name: candidate.searchTitle,
    benefit: candidate.searchTitle,
    url: candidate.url,
    whyRelevant: 'Matches your field/interests because the live search result mentions ' + candidate.matchingTerms.join(', ') + '.',
  })),
};
`;
}

export async function discoverOffers(profile) {
  const requiredFields = ['country', 'university', 'fieldOfStudy', 'interests'];
  const missingFields = requiredFields.filter((field) => !String(profile?.[field] || '').trim());
  if (missingFields.length > 0) return { status: 400, body: { error: 'Missing profile fields', fields: missingFields } };

  let sessionId;
  try {
    const doctor = await runCommand(['doctor']);
    if (doctor.code !== 0) throw new Error(`Webcmd doctor failed: ${doctor.stderr || doctor.stdout}`.trim());
    await ensureProfile();
    const created = await runCommand(['--profile', PROFILE, 'session', 'create', `student-perks-verify-${Date.now()}`, '-f', 'json']);
    sessionId = parseJsonCommand(created, 'Webcmd session create').id;
    const context = await runCommand(['site', 'memory', 'context', SEARCH_SITE, '--task-id', `student-perks-verify-${Date.now()}`, '-f', 'json']);
    if (context.code !== 0) throw new Error(`Webcmd site memory context failed: ${context.stderr || context.stdout}`.trim());
    const args = ['--profile', PROFILE, '--session', sessionId, 'browser', 'run', '--stdin', '--no-snapshot-diff', '--timeout', '60', '--max-output', '60000', '-f', 'json'];
    const result = await runCommand(args, buildResearchProgram(profile), 75_000);
    const parsed = parseJsonCommand(result, 'Webcmd browser discovery');
    const browserResult = parsed.result || parsed;
    return { status: 200, body: { offers: Array.isArray(browserResult.offers) ? browserResult.offers : [], searchedQueries: browserResult.searchedQueries || [] } };
  } catch (error) {
    return { status: 502, body: { error: 'Live browser verification failed', details: error.message, offers: [] } };
  } finally {
    if (sessionId) await runCommand(['--profile', PROFILE, 'session', 'close', sessionId]).catch(() => {});
  }
}
