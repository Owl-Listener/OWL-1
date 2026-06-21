// Builds a workspace the Claude Agent SDK can load Designpowers from.
//
// The SDK loads project agents/skills/memory when you set cwd + settingSources:['project'],
// which means it reads `<cwd>/.claude/agents/*.md`, `<cwd>/.claude/skills/*/SKILL.md`, and
// `<cwd>/CLAUDE.md`. Designpowers ships its agents/skills at the repo top level, so this
// script copies them into `.dp-workspace/.claude/` once. Real design output (design-state.md,
// built artifacts) also lands in `.dp-workspace/` so the server can serve it back to OWL-1.
//
// Idempotent. Run via `npm run setup` (and `npm start` runs it for you).

import { cp, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = join(ROOT, 'vendor', 'designpowers');
const WS = join(ROOT, '.dp-workspace');
const CLAUDE_DIR = join(WS, '.claude');

if (!existsSync(VENDOR)) {
  console.error(`✗ vendor/designpowers not found at ${VENDOR}. The pack is incomplete.`);
  process.exit(1);
}

// Fresh .claude each run so edits to vendored Designpowers always take effect.
await rm(CLAUDE_DIR, { recursive: true, force: true });
await mkdir(CLAUDE_DIR, { recursive: true });

await cp(join(VENDOR, 'agents'), join(CLAUDE_DIR, 'agents'), { recursive: true });
await cp(join(VENDOR, 'skills'), join(CLAUDE_DIR, 'skills'), { recursive: true });
await cp(join(VENDOR, 'CLAUDE.md'), join(WS, 'CLAUDE.md'));

// A scratch place for the team's output; the server serves /artifacts from here.
await mkdir(join(WS, 'output'), { recursive: true });

// Keep the workspace out of git but leave a marker so the dir exists.
await writeFile(join(WS, '.gitignore'), '*\n!.gitignore\n');

console.log('✓ Designpowers workspace ready at .dp-workspace/');
console.log(`  agents: ${(await import('node:fs')).readdirSync(join(CLAUDE_DIR, 'agents')).length}`);
console.log(`  skills: ${(await import('node:fs')).readdirSync(join(CLAUDE_DIR, 'skills')).length}`);
