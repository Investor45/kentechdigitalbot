const fs = require('fs/promises')
const os = require('os')
const path = require('path')
const { execFile } = require('child_process')
const { promisify } = require('util')
const run = promisify(execFile)
const MAX_BYTES = 60 * 1024 * 1024

async function prepareVideo(buffer) {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'kentech-youtube-'))
  try {
    const input = path.join(folder, 'input.mp4')
    const output = path.join(folder, 'output.mp4')
    await fs.writeFile(input, buffer)
    const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,codec_type,pix_fmt', '-of', 'json', input], { timeout: 15000, maxBuffer: 16384 })
    const streams = JSON.parse(stdout).streams || []
    const video = streams.find(s => s.codec_type === 'video')
    const audio = streams.find(s => s.codec_type === 'audio')
    if (!video || !audio) throw new Error('The downloaded video is missing video or audio.')
    if (video.codec_name === 'h264' && video.pix_fmt === 'yuv420p' && audio.codec_name === 'aac') return buffer
    await run('ffmpeg', [
      '-nostdin', '-v', 'error', '-y', '-i', input,
      '-map', '0:v:0', '-map', '0:a:0',
      '-vf', "scale='min(1280,iw)':'min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', output,
    ], { timeout: 120000, killSignal: 'SIGKILL', maxBuffer: 65536 })
    if ((await fs.stat(output)).size > MAX_BYTES) throw new Error('The converted video exceeds the 60 MB limit.')
    return await fs.readFile(output)
  } finally {
    await fs.rm(folder, { recursive: true, force: true })
  }
}

module.exports = { prepareVideo }
