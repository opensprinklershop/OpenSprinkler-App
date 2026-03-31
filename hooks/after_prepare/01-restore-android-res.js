const fs = require("fs");
const path = require("path");

module.exports = function (context) {
	const projectRoot = (context && context.opts && context.opts.projectRoot) || process.cwd();
	const markerPath = path.join(projectRoot, "hooks", ".www-res-backup.json");

	if (!fs.existsSync(markerPath)) {
		return;
	}

	const { moves } = JSON.parse(fs.readFileSync(markerPath, "utf8"));

	moves.forEach(({ originalPath, backupPath, tempDir }) => {
		if (fs.existsSync(backupPath) && !fs.existsSync(originalPath)) {
			fs.renameSync(backupPath, originalPath);
		}
		if (tempDir && fs.existsSync(tempDir)) {
			try {
				fs.rmdirSync(tempDir);
			} catch {
				// ignore cleanup errors
			}
		}
	});

	try {
		fs.unlinkSync(markerPath);
	} catch {
		// ignore cleanup errors
	}
};
