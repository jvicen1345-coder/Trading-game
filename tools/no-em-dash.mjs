#!/usr/bin/env node
/* Project style: no em dashes. Use a hyphen instead.
 *
 *   node tools/no-em-dash.mjs          report offenders, exit 1 if any
 *   node tools/no-em-dash.mjs --fix    rewrite them to hyphens
 *   node tools/no-em-dash.mjs --en     also catch en dashes
 *   node tools/no-em-dash.mjs f1 f2    check only the files given
 *
 * The dash characters are built from escapes on purpose, so this file never
 * trips its own check.
 */
import fs from 'fs';
import { execSync } from 'child_process';

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const NUL = String.fromCharCode(0);

const args = process.argv.slice(2);
const fix = args.includes('--fix');
const withEn = args.includes('--en');
const explicit = args.filter(a => !a.startsWith('--'));

const BAD = withEn ? [EM, EN] : [EM];
const NAMES = { [EM]: 'em dash', [EN]: 'en dash' };
const SKIP_DIR = /(^|\/)(\.git|node_modules|vendor)(\/|$)/;
const TEXT = /\.(js|mjs|cjs|ts|html|css|md|json|txt|yml|yaml|svg)$/i;

function tracked(){
  try { return execSync('git ls-files', { encoding:'utf8' }).split('\n').filter(Boolean); }
  catch { return []; }
}

const files = (explicit.length ? explicit : tracked())
  .filter(f => !SKIP_DIR.test(f))
  .filter(f => explicit.length ? true : TEXT.test(f))
  .filter(f => { try { return fs.statSync(f).isFile(); } catch { return false; } });

let hits = 0, touched = 0;

for(const f of files){
  let src;
  try { src = fs.readFileSync(f, 'utf8'); } catch { continue; }
  if(src.includes(NUL)) continue;                     // binary, leave it alone
  if(!BAD.some(ch => src.includes(ch))) continue;

  src.split('\n').forEach((line, i) => {
    BAD.forEach(ch => {
      let at = line.indexOf(ch);
      while(at !== -1){
        hits++;
        if(!fix){
          const snip = line.slice(Math.max(0, at - 34), at + 35).trim();
          console.log('  ' + f + ':' + (i + 1) + ':' + (at + 1) + '  ' + NAMES[ch] + '   ' + snip);
        }
        at = line.indexOf(ch, at + 1);
      }
    });
  });

  if(fix){
    let out = src;
    BAD.forEach(ch => { out = out.split(ch).join('-'); });
    if(out !== src){ fs.writeFileSync(f, out); touched++; }
  }
}

if(fix){
  console.log(hits
    ? 'Replaced ' + hits + ' dash(es) with hyphens across ' + touched + ' file(s).'
    : 'Nothing to fix.');
  process.exit(0);
}
if(hits){
  console.error('\n' + hits + ' em dash(es) found. Project style is a hyphen.');
  console.error('Run:  node tools/no-em-dash.mjs --fix\n');
  process.exit(1);
}
console.log('No em dashes. Clean.');
