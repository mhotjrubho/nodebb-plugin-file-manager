'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nconf = require.main.require('nconf');
const yauzl = require('yauzl');

const ROOT = fs.realpathSync(nconf.get('base_dir') || process.cwd());
const BACKUP_NAME = '.file-manager-backups';
const BACKUP = path.join(ROOT, BACKUP_NAME);
const MAX_FILE = 100 * 1024 * 1024;
const MAX_TOTAL = 500 * 1024 * 1024;

function fail(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    throw error;
}

function exists(target) {
    try { fs.lstatSync(target); return true; } catch (error) {
        if (error.code === 'ENOENT') return false;
        throw error;
    }
}

function resolvePath(value) {
    if (typeof value !== 'string' || value.includes('\0')) fail('נתיב לא תקין');
    const normalized = value.replace(/\\/g, '/');
    if (normalized.startsWith('/') || /^[a-z]:/i.test(normalized)) fail('נתיב מוחלט אסור');
    const parts = normalized.split('/').filter(Boolean);
    if (parts.some(part => part === '.' || part === '..')) fail('נתיב לא מורשה');
    if (parts[0] === BACKUP_NAME) fail('תיקיית הגיבויים הפנימית מוגנת');
    let current = ROOT;
    for (const part of parts) {
        current = path.join(current, part);
        if (exists(current) && fs.lstatSync(current).isSymbolicLink()) fail('קישור סמלי חסום');
    }
    const absolute = path.resolve(ROOT, ...parts);
    const relative = path.relative(ROOT, absolute);
    if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) fail('מחוץ לתיקיית NodeBB', 403);
    return absolute;
}

function rel(target) {
    return path.relative(ROOT, target).split(path.sep).join('/');
}

function name(value) {
    if (typeof value !== 'string') fail('שם קובץ לא תקין');
    const clean = value.trim();
    if (!clean || clean === '.' || clean === '..' || /[\/\\\0\x00-\x1f]/.test(clean)) fail('שם קובץ לא תקין');
    return clean;
}

function ensureDir(target) {
    if (!exists(target)) fail('תיקייה לא נמצאה', 404);
    const stat = fs.lstatSync(target);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail('תיקייה לא תקינה');
    return stat;
}

async function ensureBackupDir() {
    if (!exists(BACKUP)) await fs.promises.mkdir(BACKUP, { mode: 0o700 });
    const stat = await fs.promises.lstat(BACKUP);
    if (stat.isSymbolicLink() || !stat.isDirectory()) fail('תיקיית הגיבויים אינה תקינה', 500);
    await fs.promises.chmod(BACKUP, 0o700);
}

async function scanNoLinks(target, depth = 0, counter = { value: 0 }) {
    if (depth > 80 || ++counter.value > 20000) fail('הפעולה חרגה ממגבלת סריקת התיקייה');
    const stat = await fs.promises.lstat(target);
    if (stat.isSymbolicLink()) fail('קישורים סמליים חסומים');
    if (stat.isDirectory()) {
        for (const child of await fs.promises.readdir(target)) {
            await scanNoLinks(path.join(target, child), depth + 1, counter);
        }
    }
}

async function copyMove(sourcePath, destinationPath, move) {
    const source = resolvePath(sourcePath);
    const destination = resolvePath(destinationPath);
    if (source === ROOT || !exists(source)) fail('מקור לא נמצא', 404);
    ensureDir(path.dirname(destination));
    if (destination === source || destination.startsWith(source + path.sep)) fail('יעד בתוך תיקיית המקור');
    if (exists(destination)) fail('היעד כבר קיים');
    await scanNoLinks(source);
    if (move) {
        await fs.promises.rename(source, destination);
    } else if (fs.lstatSync(source).isDirectory()) {
        await fs.promises.cp(source, destination, { recursive: true, errorOnExist: true, force: false, dereference: false });
    } else {
        await fs.promises.copyFile(source, destination, fs.constants.COPYFILE_EXCL);
    }
    return { success: true };
}

async function search(query, folder) {
    if (typeof query !== 'string' || query.trim().length < 2 || query.length > 200) fail('החיפוש דורש בין 2 ל-200 תווים');
    const start = resolvePath(folder || '');
    ensureDir(start);
    const needle = query.trim().toLocaleLowerCase();
    const results = [];
    let visited = 0;
    let truncated = false;

    async function walk(directory, depth) {
        if (depth > 30 || visited >= 20000 || results.length >= 500) { truncated = true; return; }
        const entries = await fs.promises.readdir(directory);
        for (const entry of entries) {
            if (visited >= 20000 || results.length >= 500) { truncated = true; return; }
            if (directory === ROOT && entry === BACKUP_NAME) continue;
            visited += 1;
            const target = path.join(directory, entry);
            const stat = await fs.promises.lstat(target);
            if (stat.isSymbolicLink()) continue;
            if (entry.toLocaleLowerCase().includes(needle)) {
                results.push({ name: entry, path: rel(target), type: stat.isDirectory() ? 'directory' : stat.isFile() ? 'file' : 'other', size: stat.isFile() ? stat.size : null });
            }
            if (stat.isDirectory() && entry !== BACKUP_NAME) await walk(target, depth + 1);
        }
    }
    await walk(start, 0);
    return { results, truncated };
}

async function upload(files, relativePaths, folder) {
    const base = resolvePath(folder || '');
    ensureDir(base);
    if (!Array.isArray(files) || !files.length || files.length > 20) fail('ניתן להעלות עד 20 קבצים בכל בקשה');
    if (!Array.isArray(relativePaths) || relativePaths.length !== files.length) fail('רשימת שמות הקבצים אינה תואמת');

    let total = 0;
    const saved = [];
    const madeDirs = [];

    async function createParents(target) {
        const relative = path.relative(base, target);
        let current = base;
        for (const part of relative.split(path.sep).filter(Boolean)) {
            current = path.join(current, part);
            if (exists(current)) ensureDir(current);
            else {
                await fs.promises.mkdir(current, { mode: 0o755 });
                madeDirs.push(current);
            }
        }
    }

    try {
        for (let i = 0; i < files.length; i += 1) {
            const file = files[i];
            if (!file || typeof file.path !== 'string' || !Number.isFinite(file.size) || file.size < 0) fail('נתוני קובץ לא תקינים');
            total += file.size;
            if (file.size > MAX_FILE || total > MAX_TOTAL) fail('חריגה ממגבלת ההעלאה');
            const raw = relativePaths[i];
            if (typeof raw !== 'string' || raw.length > 1024) fail('נתיב העלאה לא תקין');
            const normalized = raw.replace(/\\/g, '/');
            if (normalized.startsWith('/') || /^[a-z]:/i.test(normalized)) fail('נתיב העלאה מוחלט אינו מורשה');
            const parts = normalized.split('/').filter(Boolean);
            if (!parts.length || parts.some(part => part === '.' || part === '..')) fail('נתיב העלאה לא תקין');
            let parent = base;
            for (const part of parts.slice(0, -1)) parent = path.join(parent, name(part));
            resolvePath(rel(parent));
            await createParents(parent);
            const target = path.join(parent, name(parts[parts.length - 1]));
            resolvePath(rel(target));
            if (exists(target)) fail('הקובץ כבר קיים: ' + rel(target));
            await fs.promises.copyFile(file.path, target, fs.constants.COPYFILE_EXCL);
            saved.push(target);
        }
    } catch (error) {
        for (const target of saved.reverse()) await fs.promises.rm(target, { force: true }).catch(() => {});
        for (const dir of madeDirs.reverse()) await fs.promises.rmdir(dir).catch(() => {});
        throw error;
    }
    return { success: true, count: saved.length };
}

function extractZip(zipRelative, destinationRelative) {
    return new Promise((resolve, reject) => {
        let zipPath;
        let base;
        try {
            zipPath = resolvePath(zipRelative);
            base = resolvePath(destinationRelative || path.dirname(zipRelative));
            if (!exists(zipPath)) fail('קובץ ZIP לא נמצא', 404);
            const stat = fs.lstatSync(zipPath);
            if (stat.isSymbolicLink() || !stat.isFile() || stat.size > MAX_FILE) fail('קובץ ZIP לא תקין או גדול מדי');
            ensureDir(base);
        } catch (error) { reject(error); return; }

        yauzl.open(zipPath, { lazyEntries: true, decodeStrings: true, validateEntrySizes: true }, (openError, zip) => {
            if (openError) { reject(openError); return; }
            let finished = false;
            let count = 0;
            let total = 0;
            const createdFiles = [];
            const createdDirs = [];
            const streams = new Set();

            async function cleanup(error) {
                if (finished) return;
                finished = true;
                try { zip.close(); } catch (ignored) {}
                for (const stream of streams) stream.destroy();
                for (const target of createdFiles.reverse()) await fs.promises.rm(target, { force: true }).catch(() => {});
                for (const dir of createdDirs.reverse()) await fs.promises.rmdir(dir).catch(() => {});
                reject(error);
            }

            async function makeParents(directory) {
                const relative = path.relative(base, directory);
                let current = base;
                for (const part of relative.split(path.sep).filter(Boolean)) {
                    current = path.join(current, part);
                    if (exists(current)) ensureDir(current);
                    else {
                        await fs.promises.mkdir(current, { mode: 0o755 });
                        createdDirs.push(current);
                    }
                }
            }

            zip.on('error', error => cleanup(error));
            zip.on('entry', entry => {
                (async () => {
                    if (++count > 5000) fail('יותר מדי פריטים בקובץ ZIP');
                    const normalized = String(entry.fileName || '').replace(/\\/g, '/');
                    if (!normalized || normalized.includes('\0') || normalized.startsWith('/') || /^[a-z]:/i.test(normalized)) fail('ZIP מכיל נתיב לא תקין');
                    const isDirectory = normalized.endsWith('/');
                    const parts = normalized.split('/').filter(Boolean);
                    if (!parts.length || parts.some(part => part === '.' || part === '..')) fail('ZIP מכיל נתיב מסוכן');
                    const mode = (entry.externalFileAttributes >>> 16) & 0xffff;
                    const type = mode & 0o170000;
                    if (type && type !== 0o100000 && type !== 0o040000) fail('ZIP מכיל קישור סמלי או קובץ מערכת');
                    const size = Number(entry.uncompressedSize) || 0;
                    total += size;
                    if (size > MAX_FILE || total > MAX_TOTAL) fail('תוכן ZIP חורג ממגבלת הגודל');

                    const leaf = name(parts.pop());
                    let parent = base;
                    for (const part of parts) parent = path.join(parent, name(part));
                    resolvePath(rel(parent));
                    await makeParents(parent);
                    const target = path.join(parent, leaf);
                    resolvePath(rel(target));

                    if (isDirectory) {
                        if (exists(target)) ensureDir(target);
                        else {
                            await fs.promises.mkdir(target, { mode: 0o755 });
                            createdDirs.push(target);
                        }
                        zip.readEntry();
                        return;
                    }
                    if (exists(target)) fail('ZIP מנסה לדרוס פריט קיים: ' + rel(target));
                    await new Promise((done, rejectStream) => {
                        zip.openReadStream(entry, (streamError, input) => {
                            if (streamError) { rejectStream(streamError); return; }
                            const output = fs.createWriteStream(target, { flags: 'wx', mode: 0o600 });
                            streams.add(input);
                            streams.add(output);
                            createdFiles.push(target);
                            input.once('error', rejectStream);
                            output.once('error', rejectStream);
                            output.once('finish', () => {
                                streams.delete(input);
                                streams.delete(output);
                                done();
                            });
                            input.pipe(output);
                        });
                    });
                    zip.readEntry();
                })().catch(error => cleanup(error));
            });
            zip.on('end', () => {
                if (finished) return;
                finished = true;
                resolve({ success: true, entries: count, extractedTo: rel(base) });
            });
            zip.readEntry();
        });
    });
}

async function readMetadata(id) {
    if (typeof id !== 'string' || !/^\d+-[a-f0-9]{12,16}$/.test(id)) fail('מזהה גיבוי שגוי');
    await ensureBackupDir();
    const metaFile = path.join(BACKUP, id + '.json');
    const stat = await fs.promises.lstat(metaFile);
    if (stat.isSymbolicLink() || !stat.isFile()) fail('רשומת הגיבוי אינה תקינה');
    const metadata = JSON.parse(await fs.promises.readFile(metaFile, 'utf8'));
    if (!metadata || metadata.id !== id || typeof metadata.path !== 'string') fail('רשומת הגיבוי אינה תקינה');
    return metadata;
}

async function backups() {
    if (!exists(BACKUP)) return { backups: [] };
    ensureDir(BACKUP);
    const result = [];
    for (const filename of await fs.promises.readdir(BACKUP)) {
        if (!/^\d+-[a-f0-9]{12,16}\.json$/.test(filename)) continue;
        try {
            const id = filename.slice(0, -5);
            const metadata = await readMetadata(id);
            const kind = metadata.kind === 'trash' ? 'trash' : 'file';
            const stored = path.join(BACKUP, id + (kind === 'trash' ? '.trash' : '.bak'));
            const stat = await fs.promises.lstat(stored);
            if (stat.isSymbolicLink() || (kind === 'file' && !stat.isFile())) continue;
            result.push({
                id, kind, path: metadata.path, isDirectory: Boolean(metadata.isDirectory),
                size: metadata.size === undefined ? null : metadata.size, createdAt: metadata.createdAt
            });
        } catch (error) { /* Ignore incomplete backup records. */ }
    }
    result.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return { backups: result.slice(0, 500) };
}

async function restore(id) {
    const metadata = await readMetadata(id);
    const target = resolvePath(metadata.path);
    ensureDir(path.dirname(target));
    if (metadata.kind === 'trash') {
        const trashed = path.join(BACKUP, id + '.trash');
        const stat = await fs.promises.lstat(trashed);
        if (stat.isSymbolicLink()) fail('פריט האשפה אינו תקין');
        if (exists(target)) fail('לא ניתן לשחזר: כבר קיים פריט בנתיב המקורי');
        await fs.promises.rename(trashed, target);
        await fs.promises.rm(path.join(BACKUP, id + '.json'), { force: true });
        return { success: true, restored: 'trash', path: metadata.path };
    }

    const source = path.join(BACKUP, id + '.bak');
    const sourceStat = await fs.promises.lstat(source);
    if (sourceStat.isSymbolicLink() || !sourceStat.isFile()) fail('קובץ הגיבוי אינו תקין');
    if (exists(target)) {
        const current = fs.lstatSync(target);
        if (current.isSymbolicLink() || !current.isFile()) fail('יעד השחזור אינו קובץ רגיל');
        const currentId = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
        await fs.promises.copyFile(target, path.join(BACKUP, currentId + '.bak'), fs.constants.COPYFILE_EXCL);
        await fs.promises.writeFile(path.join(BACKUP, currentId + '.json'), JSON.stringify({
            id: currentId, kind: 'file', path: rel(target), size: current.size, createdAt: new Date().toISOString()
        }), { mode: 0o600, flag: 'wx' });
    }
    const temp = path.join(path.dirname(target), '.' + path.basename(target) + '.' + crypto.randomBytes(8).toString('hex') + '.restore');
    try {
        await fs.promises.copyFile(source, temp, fs.constants.COPYFILE_EXCL);
        await fs.promises.rename(temp, target);
    } catch (error) {
        await fs.promises.rm(temp, { force: true }).catch(() => {});
        throw error;
    }
    return { success: true, restored: 'file', path: metadata.path };
}

async function purge(id) {
    const metadata = await readMetadata(id);
    if (metadata.kind !== 'trash') fail('ניתן למחוק לצמיתות רק פריטים מסל המחזור');
    const stored = path.join(BACKUP, id + '.trash');
    const stat = await fs.promises.lstat(stored);
    if (stat.isSymbolicLink()) fail('פריט האשפה אינו תקין');
    await fs.promises.rm(stored, { recursive: true, force: false });
    await fs.promises.rm(path.join(BACKUP, id + '.json'), { force: true });
    return { success: true };
}

module.exports = { copyMove, search, upload, extractZip, backups, restore, purge };
