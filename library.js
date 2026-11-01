'use strict';

const crypto = require('crypto');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const routeHelpers = require.main.require('./src/routes/helpers');
const controllerHelpers = require.main.require('./src/controllers/helpers');
const user = require.main.require('./src/user');
const meta = require.main.require('./src/meta');
const winston = require.main.require('winston');
const upload = require.main.require('./src/middleware/multer');
const FileManager = require('./lib/file-manager');
const Extra = require('./lib/file-manager-extra');

const plugin = {};
const PLUGIN_ID = 'nodebb-plugin-file-manager';
const MAX_ALLOWED_USERS = 100;
const FM_PASSWORD_MIN_LENGTH = 12;
const FM_PASSWORD_MAX_LENGTH = 256;
const FM_PASSWORD_LOCK_MS = 15 * 60 * 1000;
const FM_PASSWORD_MAX_ATTEMPTS = 5;
const FM_SESSION_TTL_MS = 15 * 60 * 1000;
const passwordFailures = new Map();
const BOOTSTRAP_SECRET_FILE = path.join(os.homedir(), '.nodebb-file-manager-bootstrap');
let settingsWriteQueue = Promise.resolve();

async function getPluginSettings() {
    const settings = await meta.settings.get(PLUGIN_ID);
    return settings && typeof settings === 'object' ? settings : {};
}

async function updatePluginSettings(patch) {
    const write = settingsWriteQueue.then(async () => {
        const current = await getPluginSettings();
        await meta.settings.set(PLUGIN_ID, { ...current, ...patch });
    });
    settingsWriteQueue = write.catch(() => {});
    await write;
}

async function deriveFileManagerPassword(password, salt) {
    return new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, 64, {
            N: 16384,
            r: 8,
            p: 1,
            maxmem: 64 * 1024 * 1024
        }, (error, derivedKey) => error ? reject(error) : resolve(derivedKey));
    });
}

async function getFileManagerCredentials() {
    const settings = await getPluginSettings();
    return settings.credentials && typeof settings.credentials === 'object' ? settings.credentials : {};
}

async function verifyFileManagerPassword(uid, password) {
    const credentials = await getFileManagerCredentials();
    const record = credentials[String(uid)];
    if (!record || typeof record.salt !== 'string' || typeof record.hash !== 'string') return false;

    const salt = Buffer.from(record.salt, 'hex');
    const expected = Buffer.from(record.hash, 'hex');
    if (salt.length !== 16 || expected.length !== 64) return false;

    const actual = await deriveFileManagerPassword(password, salt);
    return crypto.timingSafeEqual(actual, expected);
}

async function getAllowedUsers() {
    const settings = await getPluginSettings();
    return Array.isArray(settings.allowedUsers) ? settings.allowedUsers : [];
}

async function getFileManagerAdmins() {
    const settings = await getPluginSettings();
    return Array.isArray(settings.managerAdmins) ? settings.managerAdmins.map(String) : [];
}

async function isFileManagerAdmin(uid) {
    if (!uid || uid < 1) return false;
    const [admins, allowed] = await Promise.all([getFileManagerAdmins(), getAllowedUsers()]);
    return admins.includes(String(uid)) || allowed.some(item => String(item.uid) === String(uid) && item.role === 'manager');
}

async function getRole(uid) {
    if (await isFileManagerAdmin(uid)) return 'admin';
    const allowed = await getAllowedUsers();
    const entry = allowed.find(item => String(item.uid) === String(uid));
    return entry && ['viewer', 'editor'].includes(entry.role) ? entry.role : null;
}

async function isAdministrator(req) {
    return Boolean(req.uid > 0 && await user.isAdministrator(req.uid));
}

async function getBootstrapSecret() {
    let stat;
    try {
        stat = await fs.stat(BOOTSTRAP_SECRET_FILE);
    } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }
    if (!stat.isFile() || (stat.mode & 0o077) !== 0) {
        throw new Error('קובץ מפתח האתחול חייב להיות קובץ רגיל בהרשאות 0600');
    }
    const secret = (await fs.readFile(BOOTSTRAP_SECRET_FILE, 'utf8')).replace(/[\r\n]+$/, '');
    if (Buffer.byteLength(secret, 'utf8') < 32 || Buffer.byteLength(secret, 'utf8') > 256) {
        throw new Error('מפתח האתחול בשרת חייב להכיל בין 32 ל־256 בתים');
    }
    return secret;
}

function safeSecretEquals(expected, supplied) {
    if (typeof supplied !== 'string' || !supplied) return false;
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(supplied, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function saveAllowedUsers(input) {
    if (!Array.isArray(input) || input.length > MAX_ALLOWED_USERS) {
        const error = new Error('ניתן להגדיר עד 100 משתמשים מורשים');
        error.status = 400;
        throw error;
    }

    const unique = new Map();
    for (const item of input) {
        const uid = String(item && item.uid || '').trim();
        const role = String(item && item.role || 'viewer');
        if (!/^[1-9]\d{0,11}$/.test(uid) || !['viewer', 'editor', 'manager'].includes(role)) {
            const error = new Error('רשימת המשתמשים המורשים אינה תקינה');
            error.status = 400;
            throw error;
        }
        if (unique.has(uid)) continue;
        if (!await user.exists(Number(uid))) {
            const error = new Error('אחד המשתמשים ברשימה אינו קיים בפורום');
            error.status = 400;
            throw error;
        }
        unique.set(uid, { uid, role });
    }

    const allowedUsers = Array.from(unique.values());
    await updatePluginSettings({ allowedUsers });
    return allowedUsers;
}

plugin.init = async function ({ router, middleware }) {
    const pageAccess = async (req, res, next) => {
        try {
            if (!await getRole(req.uid) && !await isAdministrator(req)) return res.status(403).send('אין לך הרשאה לגשת למנהל הקבצים');
            return next();
        } catch (error) {
            winston.error('[file-manager] Page access check failed: ' + (error.stack || error));
            return res.status(500).send('שגיאה בבדיקת הרשאות');
        }
    };

    routeHelpers.setupAdminPageRoute(
        router,
        '/admin/plugins/file-manager',
        [middleware.ensureLoggedIn, pageAccess],
        (req, res) => res.render('admin/plugins/file-manager', { title: 'מנהל הקבצים' })
    );

    plugin.addRoutes({ router, middleware, helpers: controllerHelpers });
};

plugin.addRoutes = function ({ router, middleware, helpers }) {
    const endpoint = handler => async (req, res) => {
        try {
            return helpers.formatApiResponse(200, res, await handler(req));
        } catch (error) {
            const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
            if (status === 500) {
                winston.error('[file-manager] Operation failed: ' + (error.stack || error));
            }
            const message = status === 500 ? 'אירעה שגיאה פנימית בפעולת מנהל הקבצים' : (error.message || 'הפעולה נכשלה');
            return helpers.formatApiResponse(status, res, new Error(message));
        }
    };

    const deny = (res, status, message) => helpers.formatApiResponse(status, res, new Error(message));

    const managerIdentity = async (req, res, next) => {
        try {
            const role = await getRole(req.uid);
            if (!role) return deny(res, 403, '[[error:no-privileges]]');
            req.fileManagerRole = role;
            return next();
        } catch (error) {
            winston.error('[file-manager] Access check failed: ' + (error.stack || error));
            return deny(res, 500, 'שגיאה בבדיקת הרשאות מנהל הקבצים');
        }
    };

    const managerAccess = async (req, res, next) => {
        try {
            const role = req.fileManagerRole || await getRole(req.uid);
            if (!role) return deny(res, 403, '[[error:no-privileges]]');
            if (role === 'viewer') {
                const requestedPath = String(req.query.path || '').replace(/\\/g, '/');
                const insidePublic = requestedPath === 'public' || requestedPath.startsWith('public/');
                if (!insidePublic) {
                    return deny(res, 403, 'הרשאת צפייה מוגבלת לתיקייה public בלבד');
                }
            }
            req.fileManagerRole = role;
            return next();
        } catch (error) {
            winston.error('[file-manager] Path permission check failed: ' + (error.stack || error));
            return deny(res, 500, 'שגיאה בבדיקת הרשאות נתיב');
        }
    };

    const editorAccess = async (req, res, next) => {
        try {
            const role = await getRole(req.uid);
            if (!role || (role !== 'admin' && role !== 'editor')) {
                return deny(res, 403, 'אין לך הרשאת עריכה במנהל הקבצים');
            }
            req.fileManagerRole = role;
            return next();
        } catch (error) {
            winston.error('[file-manager] Editor permission check failed: ' + (error.stack || error));
            return deny(res, 500, 'שגיאה בבדיקת הרשאות עריכה');
        }
    };

    const adminOnly = async (req, res, next) => {
        try {
            if (!await isFileManagerAdmin(req.uid)) return deny(res, 403, '[[error:no-privileges]]');
            return next();
        } catch (error) {
            winston.error('[file-manager] Administrator check failed: ' + (error.stack || error));
            return deny(res, 500, 'שגיאה בבדיקת הרשאות מנהל');
        }
    };

    // NodeBB's own password is used only to configure or reset the separate File Manager key.
    const requireCurrentPassword = middleware.requirePasswordAuth;

    const requireFileManagerPassword = async (req, res, next) => {
        try {
            const uid = String(req.uid);
            const now = Date.now();
            const supplied = req.headers['x-file-manager-password'];
            const credentials = await getFileManagerCredentials();
            const record = credentials[uid];

            if (!record || typeof record.salt !== 'string' || typeof record.hash !== 'string') {
                return deny(res, 403, 'טרם הוגדרה לך סיסמת מנהל קבצים. הגדר אותה לפני הכניסה למנהל הקבצים.');
            }

            const credentialVersion = record.salt + ':' + record.hash;
            const sessionAuth = req.session && req.session.fileManagerAuth;

            // A successful unlock grants a short-lived session. A password reset changes
            // the credential version and immediately invalidates previously unlocked sessions.
            if (supplied === undefined || supplied === null || supplied === '') {
                const sessionValid = sessionAuth &&
                    sessionAuth.uid === uid &&
                    sessionAuth.credentialVersion === credentialVersion &&
                    Number.isFinite(sessionAuth.authenticatedAt) &&
                    now - sessionAuth.authenticatedAt >= 0 &&
                    now - sessionAuth.authenticatedAt < FM_SESSION_TTL_MS;

                if (sessionValid) return next();
                return deny(res, 401, 'פג תוקף האימות. יש להזין שוב את סיסמת מנהל הקבצים.');
            }

            if (typeof supplied !== 'string' || Buffer.byteLength(supplied, 'utf8') > FM_PASSWORD_MAX_LENGTH) {
                return deny(res, 401, 'נדרש מפתח סיסמת מנהל הקבצים תקין');
            }

            const key = uid + ':' + String(req.ip || 'unknown');
            let attempts = passwordFailures.get(key);

            if (attempts && attempts.lockedUntil > now) {
                return deny(res, 429, 'יותר מדי ניסיונות. נסה שוב בעוד 15 דקות.');
            }
            if (!attempts || (now - attempts.startedAt) > FM_PASSWORD_LOCK_MS) {
                attempts = { count: 0, startedAt: now, lockedUntil: 0 };
            }

            const valid = await verifyFileManagerPassword(uid, supplied);
            if (!valid) {
                attempts.count += 1;
                if (attempts.count >= FM_PASSWORD_MAX_ATTEMPTS) {
                    attempts.lockedUntil = now + FM_PASSWORD_LOCK_MS;
                    attempts.count = 0;
                }
                passwordFailures.set(key, attempts);
                if (passwordFailures.size > 5000) {
                    for (const [attemptKey, entry] of passwordFailures) {
                        if (entry.lockedUntil < now && now - entry.startedAt > FM_PASSWORD_LOCK_MS) {
                            passwordFailures.delete(attemptKey);
                        }
                    }
                }
                return deny(res, attempts.lockedUntil ? 429 : 401,
                    attempts.lockedUntil ? 'יותר מדי ניסיונות. הגישה ננעלה ל־15 דקות.' : 'סיסמת מנהל הקבצים שגויה');
            }

            if (!req.session) {
                return deny(res, 500, 'לא נוצרה הפעלת משתמש תקינה בשרת. יש להתחבר מחדש.');
            }

            passwordFailures.delete(key);
            req.session.fileManagerAuth = {
                uid,
                credentialVersion,
                authenticatedAt: now
            };
            return next();
        } catch (error) {
            winston.error('[file-manager] File Manager password verification failed: ' + (error.stack || error));
            return deny(res, 500, 'שגיאה באימות סיסמת מנהל הקבצים');
        }
    };

    const get = (route, guards, handler) =>
        routeHelpers.setupApiRoute(router, 'get', route, guards, endpoint(handler));
    const post = (route, guards, handler) =>
        routeHelpers.setupApiRoute(router, 'post', route, guards, endpoint(handler));

    get('/api/v3/plugins/file-manager/bootstrap/status', [], async req => {
        if (await getRole(req.uid)) return { required: false, configured: false };
        if (!await isAdministrator(req)) {
            const error = new Error('[[error:no-privileges]]');
            error.status = 403;
            throw error;
        }
        return { required: true, configured: Boolean(await getBootstrapSecret()) };
    });

    post('/api/v3/plugins/file-manager/bootstrap', [requireCurrentPassword], async req => {
        if (!await isAdministrator(req)) {
            const error = new Error('רק מנהל NodeBB יכול לבצע אתחול ראשוני');
            error.status = 403;
            throw error;
        }
        const secret = await getBootstrapSecret();
        if (!secret) {
            const error = new Error('מפתח האתחול לא הוגדר בשרת. יש ליצור את קובץ המפתח לפי הוראות ההתקנה.');
            error.status = 503;
            throw error;
        }
        if (!safeSecretEquals(secret, req.body && req.body.bootstrapKey)) {
            const error = new Error('מפתח האתחול של השרת שגוי');
            error.status = 401;
            throw error;
        }
        const managerAdmins = await getFileManagerAdmins();
        const uid = String(req.uid);
        if (!managerAdmins.includes(uid)) {
            managerAdmins.push(uid);
            await updatePluginSettings({ managerAdmins });
        }
        winston.info('[file-manager:audit] Bootstrap manager authorized uid ' + uid);
        return { success: true, role: 'admin' };
    });

    get('/api/v3/plugins/file-manager/permissions', [managerIdentity], async req => ({
        role: req.fileManagerRole,
        homePath: req.fileManagerRole === 'viewer' ? 'public' : '',
        canManageAccess: req.fileManagerRole === 'admin',
        canEdit: req.fileManagerRole === 'admin' || req.fileManagerRole === 'editor'
    }));

    get('/api/v3/plugins/file-manager/credentials/status', [managerIdentity], async req => {
        const credentials = await getFileManagerCredentials();
        const record = credentials[String(req.uid)];
        return {
            configured: Boolean(record && record.salt && record.hash),
            updatedAt: record && record.updatedAt ? record.updatedAt : null
        };
    });

    post('/api/v3/plugins/file-manager/unlock', [managerIdentity, requireFileManagerPassword], async () => ({
        success: true,
        expiresInMs: FM_SESSION_TTL_MS
    }));

    post('/api/v3/plugins/file-manager/credentials', [managerIdentity, requireCurrentPassword], async req => {
        const password = req.body && req.body.newPassword;
        const confirmation = req.body && req.body.confirmation;
        if (typeof password !== 'string' || typeof confirmation !== 'string' ||
            [...password].length < FM_PASSWORD_MIN_LENGTH ||
            Buffer.byteLength(password, 'utf8') > FM_PASSWORD_MAX_LENGTH ||
            password.includes(String.fromCharCode(0)) || password !== confirmation) {
            const error = new Error('הסיסמה חייבת להכיל לפחות 12 תווים, להיות זהה בשני השדות ולא לחרוג מ־256 בתים');
            error.status = 400;
            throw error;
        }

        const salt = crypto.randomBytes(16);
        const hash = await deriveFileManagerPassword(password, salt);
        const credentials = await getFileManagerCredentials();
        credentials[String(req.uid)] = {
            salt: salt.toString('hex'),
            hash: hash.toString('hex'),
            updatedAt: new Date().toISOString()
        };
        await updatePluginSettings({ credentials });
        passwordFailures.delete(String(req.uid) + ':' + String(req.ip || 'unknown'));
        winston.info('[file-manager:audit] File Manager password configured for uid ' + req.uid);
        return { success: true, configured: true };
    });

    post('/api/v3/plugins/file-manager/credentials/reset', [adminOnly, requireFileManagerPassword, requireCurrentPassword], async req => {
        const uid = String(req.body && req.body.uid || '');
        if (!/^[1-9]\d{0,11}$/.test(uid) || !await user.exists(Number(uid))) {
            const error = new Error('משתמש היעד אינו תקין');
            error.status = 400;
            throw error;
        }
        const credentials = await getFileManagerCredentials();
        delete credentials[uid];
        await updatePluginSettings({ credentials });
        for (const key of passwordFailures.keys()) {
            if (key.startsWith(uid + ':')) passwordFailures.delete(key);
        }
        winston.info('[file-manager:audit] File Manager password reset by admin uid ' + req.uid + ' for uid ' + uid);
        return { success: true };
    });

    get('/api/v3/plugins/file-manager/list', [managerAccess, requireFileManagerPassword], req => FileManager.list(req.query.path || ''));
    get('/api/v3/plugins/file-manager/preview', [managerAccess, requireFileManagerPassword], req => FileManager.preview(req.query.path || ''));
    get('/api/v3/plugins/file-manager/read', [managerAccess, requireFileManagerPassword], req => FileManager.read(req.query.path));
    get('/api/v3/plugins/file-manager/search', [managerAccess, requireFileManagerPassword], req => Extra.search(req.query.q, req.query.path || ''));
    get('/api/v3/plugins/file-manager/backups', [editorAccess, requireFileManagerPassword], () => Extra.backups());

    // Access management is administrator-only. Search returns only public profile fields.
    get('/api/v3/plugins/file-manager/access', [adminOnly, requireFileManagerPassword], async () => {
        const allowed = await getAllowedUsers();
        const uids = allowed.map(item => Number(item.uid));
        const users = uids.length ? await user.getUsersWithFields(uids, ['uid', 'username', 'userslug', 'picture'], 0) : [];
        const byUid = new Map(users.filter(Boolean).map(item => [String(item.uid), item]));
        const credentials = await getFileManagerCredentials();
        return {
            users: allowed.map(item => {
                const profile = byUid.get(String(item.uid));
                return profile ? {
                    uid: String(item.uid),
                    username: profile.username,
                    userslug: profile.userslug,
                    picture: profile.picture,
                    role: item.role,
                    hasPassword: Boolean(credentials[String(item.uid)])
                } : null;
            }).filter(Boolean)
        };
    });

    get('/api/v3/plugins/file-manager/users/search', [adminOnly, requireFileManagerPassword], async req => {
        const query = String(req.query.q || '').trim();
        if (query.length < 2 || query.length > 60) return { users: [] };
        const result = await user.search({
            uid: req.uid,
            query,
            searchBy: 'username',
            hardCap: 12,
            paginate: false
        });
        return {
            users: (result.users || [])
                .filter(item => item && /^\d+$/.test(String(item.uid)) && Number(item.uid) > 0)
                .slice(0, 12)
                .map(item => ({
                    uid: String(item.uid),
                    username: String(item.username || ''),
                    userslug: String(item.userslug || ''),
                    picture: String(item.picture || '')
                }))
        };
    });

    post('/api/v3/plugins/file-manager/access', [adminOnly, requireFileManagerPassword, requireCurrentPassword], async req => {
        const allowedUsers = await saveAllowedUsers(req.body.allowedUsers);
        winston.info('[file-manager:audit] Access list updated by uid ' + req.uid + ' (' + allowedUsers.length + ' allowed users)');
        return { success: true, count: allowedUsers.length };
    });

    // File-system mutations require the user's separate File Manager password.
    post('/api/v3/plugins/file-manager/write', [editorAccess, requireFileManagerPassword], req =>
        FileManager.write(req.body.path, req.body.content));
    post('/api/v3/plugins/file-manager/mkdir', [editorAccess, requireFileManagerPassword], req =>
        FileManager.mkdir(req.body.path));
    post('/api/v3/plugins/file-manager/rename', [editorAccess, requireFileManagerPassword], req =>
        FileManager.rename(req.body.path, req.body.newName));
    post('/api/v3/plugins/file-manager/delete', [editorAccess, requireFileManagerPassword], req =>
        FileManager.remove(req.body.path));
    post('/api/v3/plugins/file-manager/copy', [editorAccess, requireFileManagerPassword], req =>
        Extra.copyMove(req.body.path, req.body.destination, false));
    post('/api/v3/plugins/file-manager/move', [editorAccess, requireFileManagerPassword], req =>
        Extra.copyMove(req.body.path, req.body.destination, true));
    post('/api/v3/plugins/file-manager/extract', [editorAccess, requireFileManagerPassword], req =>
        Extra.extractZip(req.body.path, req.body.destination || ''));
    post('/api/v3/plugins/file-manager/restore', [editorAccess, requireFileManagerPassword], req =>
        Extra.restore(req.body.id));
    post('/api/v3/plugins/file-manager/purge', [editorAccess, requireFileManagerPassword], req =>
        Extra.purge(req.body.id));

    // On NodeBB 4.16.x setupApiRoute places multer before plugin guards.
    // This custom upload route checks account, role and password before parsing multipart bytes.
    router.post(
        '/api/v3/plugins/file-manager/upload',
        middleware.autoLocale,
        middleware.applyBlacklist,
        middleware.authenticateRequest,
        middleware.maintenanceMode,
        middleware.registrationComplete,
        middleware.pluginHooks,
        middleware.logApiUsage,
        editorAccess,
        requireFileManagerPassword,
        upload.any(),
        endpoint(req => {
            let paths;
            try {
                paths = JSON.parse(req.body.relativePaths || '[]');
            } catch (error) {
                const invalid = new Error('רשימת שמות הקבצים אינה תקינה');
                invalid.status = 400;
                throw invalid;
            }
            return Extra.upload(req.files, paths, req.body.path || '');
        })
    );
};

plugin.addAdminNavigation = function (header) {
    header.plugins = header.plugins || [];
    header.plugins.push({
        route: '/plugins/file-manager',
        icon: 'fa-folder-open',
        name: 'מנהל קבצים'
    });
    return header;
};

module.exports = plugin;
