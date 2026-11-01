'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nconf = require.main.require('nconf');

const configuredRoot = nconf.get('base_dir') || process.cwd();
const ROOT = fs.realpathSync(configuredRoot);
const MAX_FILE_SIZE = 2 * 1024 * 1024;

function fail(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    throw error;
}

function resolvePath(relativePath = '') {
    if (typeof relativePath !== 'string' || relativePath.includes('\0')) {
        fail('נתיב לא תקין');
    }

    const normalized = relativePath.replace(/\\/g, '/');

    if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
        fail('נתיב מוחלט אינו מורשה');
    }

    const parts = normalized.split('/').filter(Boolean);

    if (parts.some(part => part === '.' || part === '..')) {
        fail('נתיב לא מורשה');
    }

    let current = ROOT;

    for (const part of parts) {
        current = path.join(current, part);

        if (fs.existsSync(current)) {
            const stat = fs.lstatSync(current);
            if (stat.isSymbolicLink()) {
                fail('גישה לקישורים סמליים אינה מורשית');
            }
        }
    }

    const resolved = path.resolve(ROOT, ...parts);
    const relative = path.relative(ROOT, resolved);

    if (
        relative === '..' ||
        relative.startsWith('..' + path.sep) ||
        path.isAbsolute(relative)
    ) {
        fail('הגישה מחוץ לתיקיית NodeBB חסומה', 403);
    }

    return resolved;
}

function ensureRegularFile(filePath) {
    if (!fs.existsSync(filePath)) {
        fail('הקובץ לא נמצא', 404);
    }

    const stat = fs.lstatSync(filePath);

    if (stat.isSymbolicLink() || !stat.isFile()) {
        fail('הנתיב אינו קובץ רגיל');
    }

    if (stat.size > MAX_FILE_SIZE) {
        fail('הקובץ גדול מדי לעריכה דרך הממשק');
    }

    return stat;
}

function ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fail('התיקייה לא נמצאה', 404);
    }

    const stat = fs.lstatSync(dirPath);

    if (stat.isSymbolicLink() || !stat.isDirectory()) {
        fail('הנתיב אינו תיקייה רגילה');
    }

    return stat;
}

function relativePath(fullPath) {
    return path.relative(ROOT, fullPath).split(path.sep).join('/');
}

async function list(relative = '') {
    const dir = resolvePath(relative);
    ensureDirectory(dir);

    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const result = [];

    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const stat = await fs.promises.lstat(full);

        result.push({
            name: entry.name,
            path: relativePath(full),
            type: stat.isSymbolicLink()
                ? 'symlink'
                : stat.isDirectory()
                    ? 'directory'
                    : stat.isFile()
                        ? 'file'
                        : 'other',
            size: stat.isFile() ? stat.size : null,
            modified: stat.mtime.toISOString()
        });
    }

    result.sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (b.type === 'directory' && a.type !== 'directory') return 1;
        return a.name.localeCompare(b.name);
    });

    return {
        currentPath: relativePath(dir),
        parentPath: dir === ROOT ? '' : relativePath(path.dirname(dir)),
        entries: result
    };
}

async function read(relative) {
    if (!relative) fail('לא נבחר קובץ');

    const file = resolvePath(relative);
    ensureRegularFile(file);

    const buffer = await fs.promises.readFile(file);

    if (buffer.includes(0)) {
        fail('נראה שזה קובץ בינארי ולא קובץ טקסט');
    }

    let content;
    try {
        content = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch (err) {
        fail('הקובץ אינו טקסט UTF-8 ולכן לא ניתן לערוך אותו כאן');
    }

    return {
        path: relativePath(file),
        content
    };
}

async function createBackup(file) {
    if (!fs.existsSync(file)) return null;
    ensureRegularFile(file);
    const backupDir = path.join(ROOT, '.file-manager-backups');
    if (!fs.existsSync(backupDir)) {
        await fs.promises.mkdir(backupDir, { recursive: false, mode: 0o700 });
    }
    const backupStat = await fs.promises.lstat(backupDir);
    if (backupStat.isSymbolicLink() || !backupStat.isDirectory()) {
        fail('תיקיית הגיבויים אינה תקינה');
    }
    await fs.promises.chmod(backupDir, 0o700);
    const id = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    const backupName = id + '.bak';
    await fs.promises.copyFile(file, path.join(backupDir, backupName), fs.constants.COPYFILE_EXCL);
    await fs.promises.writeFile(path.join(backupDir, id + '.json'), JSON.stringify({
        id,
        path: relativePath(file),
        size: (await fs.promises.stat(file)).size,
        createdAt: new Date().toISOString()
    }), { mode: 0o600, flag: 'wx' });
    return id;
}

async function write(relative, content) {
    if (!relative || typeof content !== 'string') {
        fail('נתוני הקובץ אינם תקינים');
    }

    if (Buffer.byteLength(content, 'utf8') > MAX_FILE_SIZE) {
        fail('הקובץ גדול מדי');
    }

    const file = resolvePath(relative);
    const parent = path.dirname(file);
    ensureDirectory(parent);

    if (fs.existsSync(file)) ensureRegularFile(file);

    const backup = await createBackup(file);
    const temp = path.join(
        parent,
        `.${path.basename(file)}.file-manager-${crypto.randomBytes(8).toString('hex')}.tmp`
    );

    try {
        await fs.promises.writeFile(temp, content, {
            encoding: 'utf8',
            mode: 0o600,
            flag: 'wx'
        });

        if (fs.existsSync(file)) {
            const stat = await fs.promises.stat(file);
            await fs.promises.chmod(temp, stat.mode);
        }

        await fs.promises.rename(temp, file);
    } catch (err) {
        await fs.promises.rm(temp, { force: true }).catch(() => {});
        throw err;
    }

    return { success: true, backup };
}

async function mkdir(relative) {
    if (!relative) fail('יש לציין שם תיקייה');

    const dir = resolvePath(relative);
    ensureDirectory(path.dirname(dir));

    await fs.promises.mkdir(dir, { mode: 0o755 });
    return { success: true };
}

async function rename(relative, newName) {
    if (!relative || typeof newName !== 'string') fail('נתונים חסרים');

    if (
        !newName.trim() ||
        newName.includes('/') ||
        newName.includes('\\') ||
        newName === '.' ||
        newName === '..' ||
        newName.includes('\0')
    ) {
        fail('שם חדש אינו תקין');
    }

    const source = resolvePath(relative);
    if (!fs.existsSync(source)) fail('הפריט לא נמצא', 404);

    const stat = fs.lstatSync(source);
    if (stat.isSymbolicLink()) fail('שינוי שם של קישור סמלי אינו מורשה');

    const destination = path.join(path.dirname(source), newName);
    resolvePath(relativePath(destination));

    if (fs.existsSync(destination)) fail('כבר קיים פריט בשם הזה');

    await fs.promises.rename(source, destination);
    return { success: true };
}

async function remove(relative) {
    if (!relative) fail('לא נבחר פריט למחיקה');

    const target = resolvePath(relative);
    if (target === ROOT) fail('מחיקת תיקיית NodeBB חסומה');
    if (!fs.existsSync(target)) fail('הפריט לא נמצא', 404);

    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) fail('מחיקת קישור סמלי אינה מורשית');

    await fs.promises.rm(target, { recursive: true, force: false });
    return { success: true };
}

module.exports = {
    list,
    read,
    write,
    mkdir,
    rename,
    remove
};
