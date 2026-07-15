const fs = require('fs');

function atomicWriteFileSync(filePath, data) {
  const tmpPath = filePath + '.tmp';
  try {
    fs.writeFileSync(tmpPath, data, 'utf8');
    try {
      fs.renameSync(tmpPath, filePath);
    } catch (renameErr) {
      fs.copyFileSync(tmpPath, filePath);
      fs.unlinkSync(tmpPath);
    }
    return true;
  } catch (err) {
    console.error(`Erreur écriture atomique ${filePath}:`, err.message);
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
    return false;
  }
}

module.exports = { atomicWriteFileSync };
