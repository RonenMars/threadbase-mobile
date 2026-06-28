# Troubleshooting

## `npm install` fails on Windows with "The system cannot find the path specified"

**Symptom**

```
npm ERR! code 1
npm ERR! command failed
npm ERR! command C:\Windows\system32\cmd.exe /d /s /c git config core.hooksPath scripts/git-hooks 2>/dev/null || true
```

**Cause**

The `prepare` script in `package.json` originally used Unix shell syntax (`2>/dev/null || true`) which `cmd.exe` on Windows does not understand.

**Fix (already applied)**

The script was replaced with a cross-platform Node.js one-liner:

```json
"prepare": "node -e \"const {execSync}=require('child_process');try{execSync('git config core.hooksPath scripts/git-hooks',{stdio:'ignore'})}catch(e){}\""
```

If you see this error again, check that the `prepare` entry in `package.json` still uses the Node.js form and has not been reverted to the bash form.
