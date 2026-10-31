const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const apiRequire = createRequire(resolve(__dirname, '../apps/api/package.json'));
const nestRequire = createRequire(apiRequire.resolve('@nestjs/platform-express'));
const multer = nestRequire('multer');

// Exercise the delayed-filter teardown reported in GHSA-q7qp-rjg7-q26m.
// Run separately so a regression cannot crash a live API or the test runner.
const request = new PassThrough();
const boundary = 'mordida-security-regression';
const payload = ['pending', 'rejected'].map(name =>
  `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${name}.txt"\r\nContent-Type: text/plain\r\n\r\nx\r\n`,
).join('');
request.headers = {
  'content-type': `multipart/form-data; boundary=${boundary}`,
  'content-length': Buffer.byteLength(payload),
};
let parser;
let resume;
let completions = 0;
const rejected = new Error('Rejected by test filter');
const deadline = setTimeout(() => { console.error('Regression timed out'); process.exit(1); }, 5000);
multer({
  fileHwm: 1,
  streamHandler: (req, stream) => { parser = stream; req.pipe(stream); },
  fileFilter: (req, file, callback) => {
    if (file.fieldname === 'pending') resume = callback;
    else req.once('end', () => setImmediate(() => callback(rejected)));
  },
}).any()(request, null, error => {
  completions++;
  assert.equal(error, rejected);
  setImmediate(() => {
    parser.once('close', () => {
      assert.equal(completions, 1);
      assert.deepEqual(request.files, []);
      clearTimeout(deadline);
      console.log('PASS: late filter after teardown does not terminate the process; multer ' + nestRequire('multer/package.json').version);
    });
    resume(null, true);
  });
});
request.end(payload);
