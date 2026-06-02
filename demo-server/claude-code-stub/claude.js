#!/usr/bin/env node
// Fake `claude` binary for the public demo. Spawned by tb-streamer's PTYManager
// when a reviewer starts or resumes a session. Prints the welcome box + ready
// marker (so the app's hasReachedPrompt gate latches), then echoes scripted
// replies on stdin. No Anthropic API calls — reviewer-safe, no token spend.

'use strict';

const BANNER = [
  '\x1b[2J\x1b[H',
  '╭───────────────────────────────────────────────╮\r\n',
  '│ Welcome to Claude Code (demo)                 │\r\n',
  '│                                               │\r\n',
  '│   This is a public demo build. Live Claude    │\r\n',
  '│   is not connected — input gets scripted      │\r\n',
  '│   replies. Pair the app against your own      │\r\n',
  '│   tb-streamer for the full experience.        │\r\n',
  '╰───────────────────────────────────────────────╯\r\n',
  '\r\n',
  '❯ ',
].join('');

const SCRIPTED_REPLIES = [
  '⏺ This is a demo session. I respond with canned text.\r\n  Real Claude runs against your local tb-streamer.\r\n\r\n❯ ',
  '⏺ Demo mode: I can show you what Threadbase looks like,\r\n  but I do not run a real model in this container.\r\n\r\n❯ ',
  "⏺ I'd love to help, but this is a reviewer-facing demo.\r\n  Install tb-streamer on your Mac to chat with real Claude.\r\n\r\n❯ ",
];

process.stdout.write(BANNER);

let replyIndex = 0;
let buffer = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  // Echo characters as the user types so the prompt feels alive.
  process.stdout.write(chunk);

  // When the user hits return, emit a scripted reply and rotate.
  if (buffer.includes('\r') || buffer.includes('\n')) {
    buffer = '';
    process.stdout.write('\r\n');
    process.stdout.write(SCRIPTED_REPLIES[replyIndex % SCRIPTED_REPLIES.length]);
    replyIndex += 1;
  }
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

// Keep the process alive — tb-streamer will SIGTERM us when the session ends.
process.stdin.resume();
