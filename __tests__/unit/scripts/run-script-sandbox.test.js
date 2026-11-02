/**
 * @jest-environment node
 *
 * Tests for the shared runScript helper (#718): a script under test must not
 * see the developer's real HOME, cwd or cached credentials.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { runScript, BLANKED_ENV } = require('./_runScript');

let fixtureDir;
let probe;
const saved = {};

beforeEach(() => {
  fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-script-probe-'));
  probe = path.join(fixtureDir, 'probe.sh');
  fs.writeFileSync(probe, 'printf "%s\\n%s\\n" "$HOME" "$PWD"\nfor v in "$@"; do printf "%s=[%s]\\n" "$v" "${!v}"; done\n');
  for (const name of BLANKED_ENV) {
    saved[name] = process.env[name];
    process.env[name] = path.join(fixtureDir, 'real-cached-credential.json');
  }
});

afterEach(() => {
  for (const name of BLANKED_ENV) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
  fs.rmSync(fixtureDir, { recursive: true, force: true });
});

describe('runScript', () => {
  it('points HOME and cwd at the same fresh temp dir, not the real ones', () => {
    const { stdout, code } = runScript(probe, []);
    const [home, cwd] = stdout.split('\n');
    expect(code).toBe(0);
    expect(path.basename(home)).toBe(path.basename(cwd));
    expect(path.basename(home)).toMatch(/^run-script-/);
    expect(home).not.toBe(os.homedir());
    expect(cwd).not.toBe(process.cwd());
  });

  it('blanks every credential variable even though the parent env carries them', () => {
    const { stdout } = runScript(probe, BLANKED_ENV);
    for (const name of BLANKED_ENV) expect(stdout).toContain(`${name}=[]`);
  });

  it('removes the temp dir once the script has run', () => {
    const { stdout } = runScript(probe, []);
    expect(fs.existsSync(stdout.split('\n')[1])).toBe(false);
  });

  it('creates a git repo with one commit when asked, so scripts that read HEAD still run', () => {
    const git = path.join(fixtureDir, 'git-probe.sh');
    fs.writeFileSync(git, 'git rev-parse --short HEAD >/dev/null && echo has-head\n');
    expect(runScript(git, [], { git: true }).stdout).toContain('has-head');
    expect(runScript(git, []).stdout).not.toContain('has-head');
  });

  it('lets a caller override a blanked variable explicitly', () => {
    const { stdout } = runScript(probe, ['PLAY_SA_JSON_B64'], { env: { PLAY_SA_JSON_B64: 'x' } });
    expect(stdout).toContain('PLAY_SA_JSON_B64=[x]');
  });
});
