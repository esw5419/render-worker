// GitHub Actions 러너 한 대가 낮밤 쇼츠의 한 구간을 렌더한다(낮밤 automation/modal_remotion_render.cjs와 같은 설정).
// SugaReferenceShort, h264 crf18 muted, jpeg 프레임, 오디오는 wav 48kHz 전체 타임라인.
// env: PART(JSON {index,startFrame,endFrame}|{index,audio:true}), JOB_DIR(bundle/·props.json), OUT_DIR, RENDER_KEY
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {renderMedia, selectComposition} = require('@remotion/renderer');
const {encryptFile} = require('./crypt.cjs');

(async () => {
  const part = JSON.parse(process.env.PART);
  const jobDir = path.resolve(process.env.JOB_DIR), outDir = path.resolve(process.env.OUT_DIR);
  const serveUrl = path.join(jobDir, 'bundle');
  const name = part.audio ? 'full-timeline-audio.wav' : `chunk-${String(part.index).padStart(4, '0')}.mp4`;
  const plain = path.join(os.tmpdir(), name);
  const inputProps = JSON.parse(fs.readFileSync(path.join(jobDir, 'props.json'), 'utf8'));
  const composition = await selectComposition({serveUrl, id: 'SugaReferenceShort', inputProps});
  const common = {composition, serveUrl, inputProps, outputLocation: plain, logLevel: 'error',
    offthreadVideoCacheSizeInBytes: 1024 * 1024 * 1024, chromiumOptions: {gl: 'swangle'}};
  const t0 = Date.now();
  if (part.audio) {
    await renderMedia({...common, codec: 'wav', sampleRate: 48000, concurrency: 1});
  } else {
    await renderMedia({...common, codec: 'h264', crf: 18, muted: true, imageFormat: 'jpeg', frameRange: [part.startFrame, part.endFrame],
      concurrency: Number(process.env.RENDER_CONCURRENCY || os.cpus().length)});
  }
  fs.mkdirSync(outDir, {recursive: true});
  await encryptFile(plain, path.join(outDir, `${name}.enc`), process.env.RENDER_KEY);
  console.log(`${name} ${fs.statSync(plain).size} bytes in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
