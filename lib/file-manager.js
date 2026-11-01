'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nconf = require.main.require('nconf');

const ROOT = fs.realpathSync(nconf.get('base_dir') || process.cwd());
const BACKUP_NAME = '.file-manager-backups';
const BACKUP = path.join(ROOT, BACKUP_NAME);
const MAX_EDIT = 2 * 1024 * 1024;

function fail(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    throw error;
}

function exists(target) {
    try {
        fs.lstatSync(target);
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') return false;
        throw error;
    }
}

function resolvePath(value = '') {
    if (typeof value !== 'string' || value.includes('\0')) fail('נתיב לא תקין');
    const normalized = value.replace(/\\/g, '/');
    if (normalized.startsWith('/') || /^[a-z]:/i.test(normalized)) fail('נתיב מוחלט אינו מורשה');
    const parts = normalized.split('/').filter(Boolean);
    if (parts.some(part => part === '.' || part === '..')) fail('נתיב לא מורשה');
    if (parts[0] === BACKUP_NAME) fail('תיקיית הגיבויים הפנימית מוגנת');

    let current = ROOT;
    for (const part of parts) {
        current = path.join(current, part);
        if (exists(current) && fs.lstatSync(current).isSymbolicLink()) fail('גישה לקישורים סמליים אינה מורשית');
    }
    const absolute = path.resolve(ROOT, ...parts);
    const relative = path.relative(ROOT, absolute);
    if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
        fail('הגישה מחוץ לתיקיית NodeBB חסומה', 403);
    }
    return absolute;
}

function ensureFile(target, maxSize = MAX_EDIT) {
    if (!exists(target)) fail('הקובץ לא נמצא', 404);
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink() || !stat.isFile()) fail('הנתיב אינו קובץ רגיל');
    if (stat.size > maxSize) fail('הקובץ גדול מדי לעריכה דרך הממשק');
    return stat;
}

function ensureDir(target) {
    if (!exists(target)) fail('התיקייה לא נמצאה', 404);
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink() || !stat.isDirectory()) fail('הנתיב אינו תיקייה רגילה');
    return stat;
}

function relative(target) {
    return path.relative(ROOT, target).split(path.sep).join('/');
}

async function ensureBackupDir() {
    if (!exists(BACKUP)) await fs.promises.mkdir(BACKUP, { mode: 0o700 });
    const stat = await fs.promises.lstat(BACKUP);
    if (stat.isSymbolicLink() || !stat.isDirectory()) fail('תיקיית הגיבויים אינה תקינה', 500);
    await fs.promises.chmod(BACKUP, 0o700);
}

async function createBackup(file) {
    if (!exists(file)) return null;
    ensureFile(file, Number.MAX_SAFE_INTEGER);
    await ensureBackupDir();
    const id = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
    const backupFile = path.join(BACKUP, id + '.bak');
    const metadataFile = path.join(BACKUP, id + '.json');
    await fs.promises.copyFile(file, backupFile, fs.constants.COPYFILE_EXCL);
    try {
        await fs.promises.writeFile(metadataFile, JSON.stringify({
            id, kind: 'file', path: relative(file),
            size: (await fs.promises.stat(file)).size,
            createdAt: new Date().toISOString()
        }), { mode: 0o600, flag: 'wx' });
    } catch (error) {
        await fs.promises.rm(backupFile, { force: true }).catch(() => {});
        throw error;
    }
    return id;
}

async function list(folder = '') {
    const dir = resolvePath(folder);
    ensureDir(dir);
    const names = await fs.promises.readdir(dir);
    const entries = [];
    for (const name of names) {
        if (dir === ROOT && name === BACKUP_NAME) continue;
        const target = path.join(dir, name);
        const stat = await fs.promises.lstat(target);
        entries.push({
            name, path: relative(target),
            type: stat.isSymbolicLink() ? 'symlink' : stat.isDirectory() ? 'directory' : stat.isFile() ? 'file' : 'other',
            size: stat.isFile() ? stat.size : null,
            modified: stat.mtime.toISOString()
        });
    }
    entries.sort((a, b) => a.type === 'directory' && b.type !== 'directory' ? -1 :
        b.type === 'directory' && a.type !== 'directory' ? 1 : a.name.localeCompare(b.name));
    return { currentPath: relative(dir), parentPath: dir === ROOT ? '' : relative(path.dirname(dir)), entries };
}

async function read(folder) {
    if (!folder) fail('לא נבחר קובץ');
    const file = resolvePath(folder);
    ensureFile(file);
    const handle = await fs.promises.open(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size > MAX_EDIT) fail('הקובץ אינו מתאים לעריכה');
        const buffer = await handle.readFile();
        if (buffer.includes(0)) fail('נראה שזה קובץ בינארי ולא קובץ טקסט');
        let content;
        try {
            content = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
        } catch (error) {
            fail('הקובץ אינו טקסט UTF-8 ולכן לא ניתן לערוך אותו כאן');
        }
        return { path: relative(file), content };
    } finally {
        await handle.close();
    }
}

async function write(folder, content) {
    if (!folder || typeof content !== 'string') fail('נתוני הקובץ אינם תקינים');
    if (Buffer.byteLength(content, 'utf8') > MAX_EDIT) fail('הקובץ גדול מדי');
    const file = resolvePath(folder);
    ensureDir(path.dirname(file));
    if (exists(file)) ensureFile(file);
    const backup = await createBackup(file);
    const temp = path.join(path.dirname(file), '.' + path.basename(file) + '.fm-' + crypto.randomBytes(8).toString('hex') + '.tmp');
    try {
        await fs.promises.writeFile(temp, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
        if (exists(file)) {
            const stat = fs.lstatSync(file);
            if (stat.isSymbolicLink() || !stat.isFile()) fail('היעד השתנה ואינו קובץ רגיל');
            await fs.promises.chmod(temp, stat.mode);
        }
        await fs.promises.rename(temp, file);
    } catch (error) {
        await fs.promises.rm(temp, { force: true }).catch(() => {});
        throw error;
    }
    return { success: true, backup };
}

async function mkdir(folder) {
    if (!folder) fail('יש לציין שם תיקייה');
    const dir = resolvePath(folder);
    ensureDir(path.dirname(dir));
    await fs.promises.mkdir(dir, { mode: 0o755 });
    return { success: true };
}

async function rename(folder, newName) {
    if (!folder || typeof newName !== 'string') fail('נתונים חסרים');
    const name = newName.trim();
    if (!name || /[\/\\\0]/.test(name) || name === '.' || name === '..') fail('שם חדש אינו תקין');
    const source = resolvePath(folder);
    if (!exists(source)) fail('הפריט לא נמצא', 404);
    const stat = fs.lstatSync(source);
    if (stat.isSymbolicLink()) fail('שינוי שם של קישור סמלי אינו מורשה');
    const destination = path.join(path.dirname(source), name);
    resolvePath(relative(destination));
    if (exists(destination)) fail('כבר קיים פריט בשם הזה');
    await fs.promises.rename(source, destination);
    return { success: true };
}

async function remove(folder) {
    if (!folder) fail('לא נבחר פריט למחיקה');
    const target = resolvePath(folder);
    if (target === ROOT) fail('מחיקת תיקיית NodeBB חסומה');
    if (!exists(target)) fail('הפריט לא נמצא', 404);
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) fail('מחיקת קישור סמלי אינה מורשית');
    await ensureBackupDir();

    const id = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
    const trashFile = path.join(BACKUP, id + '.trash');
    const metadataFile = path.join(BACKUP, id + '.json');
    const tempMeta = metadataFile + '.tmp';
    await fs.promises.writeFile(tempMeta, JSON.stringify({
        id, kind: 'trash', path: relative(target), isDirectory: stat.isDirectory(),
        size: stat.isFile() ? stat.size : null, createdAt: new Date().toISOString()
    }), { mode: 0o600, flag: 'wx' });
    try {
        await fs.promises.rename(target, trashFile);
        await fs.promises.rename(tempMeta, metadataFile);
    } catch (error) {
        if (exists(trashFile) && !exists(target)) await fs.promises.rename(trashFile, target).catch(() => {});
        await fs.promises.rm(tempMeta, { force: true }).catch(() => {});
        throw error;
    }
    return { success: true, trashed: true, id };
}


const PREVIEW_IMAGES = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml'
};
const PREVIEW_TEXT = new Set([
    '.txt', '.json', '.js', '.mjs', '.cjs', '.css', '.scss', '.html', '.htm',
    '.xml', '.md', '.php', '.py', '.sh', '.yml', '.yaml', '.sql', '.log',
    '.csv', '.ini', '.conf', '.env', '.tpl', '.ts', '.tsx', '.jsx'
]);

async function preview(folder) {
    if (!folder) fail('לא נבחר קובץ');
    const file = resolvePath(folder);
    const stat = ensureFile(file, 8 * 1024 * 1024);
    const extension = path.extname(file).toLowerCase();

    if (PREVIEW_IMAGES[extension]) {
        const handle = await fs.promises.open(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
        try {
            const current = await handle.stat();
            if (!current.isFile() || current.size > 8 * 1024 * 1024) fail('התמונה גדולה מדי לתצוגה מקדימה');
            const content = await handle.readFile();
            return {
                kind: 'image',
                mime: PREVIEW_IMAGES[extension],
                data: content.toString('base64'),
                size: current.size,
                modified: current.mtime.toISOString()
            };
        } finally {
            await handle.close();
        }
    }

    if (PREVIEW_TEXT.has(extension) && stat.size <= MAX_EDIT) {
        try {
            const result = await read(folder);
            return {
                kind: 'text',
                content: result.content.slice(0, 120000),
                truncated: result.content.length > 120000,
                size: stat.size,
                modified: stat.mtime.toISOString()
            };
        } catch (error) {
            if (error.status === 400) return { kind: 'unsupported', size: stat.size, modified: stat.mtime.toISOString() };
            throw error;
        }
    }

    return { kind: 'unsupported', size: stat.size, modified: stat.mtime.toISOString() };
}

module.exports = { list, read, write, mkdir, rename, remove, preview };
