const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function startPythonAuditAgent(rootDir) {
  const pyScript = path.join(rootDir, 'agent_audit', 'main.py');
  if (fs.existsSync(pyScript)) {
    console.log(`Lancement de l'agent d'audit Python en arrière-plan...`);
    const pythonProcess = spawn('python', [pyScript, '--once'], {
      detached: true,
      stdio: 'ignore'
    });
    pythonProcess.on('error', (err) => {
      console.error(`Erreur au lancement de l'agent Python : ${err.message}`);
    });
    pythonProcess.unref();
  }
}

module.exports = { startPythonAuditAgent };
