const fs = require("fs");
const os = require("os");
const path = require("path");

module.exports = function (context) {
	const projectRoot = (context && context.opts && context.opts.projectRoot) || process.cwd();
	const resRoot = path.join(projectRoot, "www", "res");
	const moves = [];

	// Remove stale platform symlinks that point to the same res/ directory.
	// Without this, Cordova's file-copy resolves both src and dest to the same
	// physical path and throws EINVAL (src and dest cannot be the same).
	const platformResDirs = [
		path.join(projectRoot, "platforms", "ios", "www", "res"),
		path.join(projectRoot, "platforms", "browser", "www", "res"),
	];
	platformResDirs.forEach((p) => {
		try {
			if (fs.lstatSync(p).isSymbolicLink()) {
				fs.unlinkSync(p);
			}
		} catch {
			// ignore – path doesn't exist or can't be stat'd
		}
	});

	if (fs.existsSync(resRoot)) {
		const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "os-www-res-"));
		const backupPath = path.join(tempDir, "res");
		fs.renameSync(resRoot, backupPath);
		moves.push({ originalPath: resRoot, backupPath, tempDir });
	}

	if (moves.length === 0) {
		return;
	}

	const markerPath = path.join(projectRoot, "hooks", ".www-res-backup.json");
	fs.writeFileSync(markerPath, JSON.stringify({ moves }, null, 2), "utf8");
};
