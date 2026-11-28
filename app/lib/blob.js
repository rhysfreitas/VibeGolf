// Git's blob id for a file's bytes: sha1("blob <length>\0" + bytes). The repo's tree lists every file by it,
// so the app knows which files changed without downloading them.
'use strict';
const crypto = require('crypto');
const blobSha = buf => crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
module.exports = { blobSha };
