#!/usr/bin/env node
// mcq-hero: prep a product photo, then composite the McQForYouDesign hero image.
// Usage: mcq-hero --image in.jpg --title "T" --type digital|physical [--label "xTool F1/F2"] --out hero.jpg
// Prep options: [--rotate N] [--crop auto|none] [--light auto|none] [--wb auto|none] [--no-prep]
// Compose options: [--badge badge.png] [--font font.woff2] [--caps true|false] [--size 4000x3000] [--quality 92]
// Prints one JSON report (output, thumbnailCheck, titleFontSizePx, titleLines, photo, badge, warnings, prep).
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const packageDir = path.resolve(__dirname, '..');
const prepOptions = ['rotate', 'crop', 'light', 'wb'];
const composeOptions = [
  'image',
  'title',
  'type',
  'label',
  'badge',
  'font',
  'caps',
  'size',
  'quality',
  'out',
];

/** Prints an error and exits with a non-zero code. */
function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

/** Parses `--name value` pairs and the `--no-prep` / `--help` flags. */
function parseArgs(argv) {
  const parsed = { values: {}, noPrep: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--no-prep') {
      parsed.noPrep = true;
    } else if (token === '--help' || token === '-h') {
      parsed.help = true;
    } else if (token.startsWith('--')) {
      const name = token.slice(2);
      if (![...prepOptions, ...composeOptions].includes(name)) {
        fail(`Unknown option --${name}. Run mcq-hero --help for usage.`);
      }
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        fail(`Option --${name} needs a value.`);
      }
      parsed.values[name] = value;
      index += 1;
    } else {
      fail(`Unexpected argument "${token}". Options start with --.`);
    }
  }
  return parsed;
}

/** Runs python prep_photo.py, trying the interpreter names used on Windows, macOS and Linux. */
function runPrep(sourcePath, preppedPath, values) {
  const prepArgs = [path.join(packageDir, 'prep_photo.py'), sourcePath, preppedPath];
  for (const name of prepOptions) {
    if (values[name] !== undefined) prepArgs.push(`--${name}`, values[name]);
  }
  const attempted = [];
  for (const interpreter of ['python3', 'python', 'py']) {
    const result = spawnSync(interpreter, prepArgs, { encoding: 'utf8' });
    if (result.error && result.error.code === 'ENOENT') {
      attempted.push(interpreter);
      continue;
    }
    if (result.status !== 0) {
      fail(
        `Photo prep failed (${interpreter} exited ${result.status}). ` +
          `${(result.stderr || '').trim()} ` +
          'If Pillow or numpy is missing run: pip install pillow numpy'
      );
    }
    try {
      return JSON.parse(result.stdout);
    } catch (error) {
      fail(`Photo prep returned output that is not JSON: ${result.stdout}`);
    }
  }
  return fail(`Python was not found (tried ${attempted.join(', ')}). Install Python 3 with Pillow and numpy.`);
}

/** Runs make_hero.js and returns its parsed JSON report. */
function runCompose(imagePath, values) {
  const composeArgs = [path.join(packageDir, 'make_hero.js'), '--image', imagePath];
  for (const name of composeOptions) {
    if (name !== 'image' && values[name] !== undefined) {
      composeArgs.push(`--${name}`, values[name]);
    }
  }
  const result = spawnSync(process.execPath, composeArgs, { encoding: 'utf8' });
  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const browserHint = /Executable doesn't exist|browserType\.launch/.test(stderr)
      ? ' Playwright needs its browser once: run npx playwright install chromium'
      : '';
    fail(`Hero compose failed. ${stderr}${browserHint}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    return fail(`Hero compose returned output that is not JSON: ${result.stdout}`);
  }
}

function main() {
  const { values, noPrep, help } = parseArgs(process.argv.slice(2));
  if (help) {
    console.log(
      'Usage: mcq-hero --image in.jpg --title "Title" --type digital|physical ' +
        '[--label "xTool F1/F2"] --out hero.jpg\n' +
        'Prep: [--rotate N] [--crop auto|none] [--light auto|none] [--wb auto|none] [--no-prep]\n' +
        'Compose: [--badge badge.png] [--font font.woff2] [--caps true|false] [--size 4000x3000] [--quality 92]'
    );
    return;
  }
  if (!values.image || !fs.existsSync(values.image)) {
    fail(`--image not found: ${values.image}`);
  }
  if (!values.title) fail('--title is required');
  if (!['digital', 'physical'].includes((values.type || '').toLowerCase())) {
    fail('--type must be digital or physical');
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcq-hero-'));
  let imageForCompose = values.image;
  let prepReport = null;
  try {
    if (!noPrep) {
      imageForCompose = path.join(workDir, 'prep.jpg');
      prepReport = runPrep(values.image, imageForCompose, values);
    }
    const out =
      values.out ||
      path.join(
        path.dirname(values.image),
        `${path.basename(values.image, path.extname(values.image))}_hero.jpg`
      );
    const report = runCompose(imageForCompose, { ...values, out: path.resolve(out) });
    report.prep = prepReport ? prepReport.steps : ['skipped (--no-prep)'];
    console.log(JSON.stringify(report, null, 2));
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

main();
