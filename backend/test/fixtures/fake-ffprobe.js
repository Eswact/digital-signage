#!/usr/bin/env node
// Stand-in for ffprobe in tests: reports FAKE_DURATION seconds (default 10) of 1280x720 video.
if (process.argv.includes('-version')) {
  console.log('ffprobe version fake');
  process.exit(0);
}
const duration = process.env.FAKE_DURATION || '10';
console.log(
  JSON.stringify({
    format: { duration },
    streams: [{ codec_type: 'video', width: 1280, height: 720, duration }],
  }),
);
