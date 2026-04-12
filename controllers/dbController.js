// Import your modular scripts

const { exportDatabase } = require("../config/dbScripts/export-db");
const { fixDatabase } = require("../config/dbScripts/fix-db");
const { importDatabase } = require("../config/dbScripts/import-db");
const { resetDatabase } = require("../config/dbScripts/reset-db");

// @route   POST /api/admin/db/export
exports.triggerExport = async (req, res) => {
  try {
    // Respond immediately so the frontend UI doesn't hang
    res.status(200).json({ message: 'Backup triggered. The server is writing files to the disk.' });
    
    // Execute the imported script function in the background
    exportDatabase().catch(err => console.error("Background export failed:", err));
  } catch (error) {
    res.status(500).json({ message: 'Failed to trigger export', error: error.message });
  }
};

// @route   POST /api/admin/db/import
exports.triggerImport = async (req, res) => {
  try {
    if (req.body.confirmText !== 'RESTORE_DATABASE') {
      return res.status(400).json({ message: 'Confirmation text missing or invalid.' });
    }

    res.status(200).json({ message: 'Restore triggered. The server is rebuilding the database.' });
    
    importDatabase().catch(err => console.error("Background import failed:", err));
  } catch (error) {
    res.status(500).json({ message: 'Failed to trigger import', error: error.message });
  }
};

// @route   DELETE /api/admin/db/reset
exports.triggerReset = async (req, res) => {
  try {
    if (req.body.confirmText !== 'WIPE_EVERYTHING') {
      return res.status(400).json({ message: 'Confirmation text missing or invalid.' });
    }

    // Since a wipe is fast, we can await it before responding
    await resetDatabase();
    
    res.status(200).json({ message: 'Database wiped completely. Admin account destroyed.' });
  } catch (error) {
    res.status(500).json({ message: 'Database reset failed', error: error.message });
  }
};

// @route   POST /api/admin/db/fix-indexes
exports.triggerFix = async (req, res) => {
  try {
    const result = await fixDatabase();
    res.status(200).json({ message: result.message });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fix database', error: error.message });
  }
};