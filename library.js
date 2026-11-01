'use strict';

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

async function getAllowedUsers() {
    const settings = await meta.settings.get(PLUGIN_ID);
    return Array.isArray(settings.allowedUsers) ? settings.allowedUsers : [];
}

async function getRole(uid) {
    if (uid > 0 && await user.isAdministrator(uid)) return 'admin';
    const allowed = await getAllowedUsers();
    const entry = allowed.find(item => String(item.uid) === String(uid));
    return entry && ['viewer', 'editor'].includes(entry.role) ? entry.role : null;
}

async function isAdministrator(req) {
    return Boolean(req.uid > 0 && await user.isAdministrator(req.uid));
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
        if (!/^[1-9]\d{0,11}$/.test(uid) || !['viewer', 'editor'].includes(role)) {
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
    await meta.settings.set(PLUGIN_ID, { allowedUsers });
    return allowedUsers;
}

plugin.init = async function ({ router, middleware }) {
    const pageAccess = async (req, res, next) => {
        try {
            if (!await getRole(req.uid)) return res.status(403).send('אין לך הרשאה לגשת למנהל הקבצים');
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

    const managerAccess = async (req, res, next) => {
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
            if (!await isAdministrator(req)) return deny(res, 403, '[[error:no-privileges]]');
            return next();
        } catch (error) {
            winston.error('[file-manager] Administrator check failed: ' + (error.stack || error));
            return deny(res, 500, 'שגיאה בבדיקת הרשאות מנהל');
        }
    };

    // NodeBB validates the current account password through its own authentication provider.
    const requireCurrentPassword = middleware.requirePasswordAuth;

    const get = (route, guards, handler) =>
        routeHelpers.setupApiRoute(router, 'get', route, guards, endpoint(handler));
    const post = (route, guards, handler) =>
        routeHelpers.setupApiRoute(router, 'post', route, guards, endpoint(handler));

    get('/api/v3/plugins/file-manager/permissions', [managerAccess], async req => ({
        role: req.fileManagerRole,
        canManageAccess: req.fileManagerRole === 'admin',
        canEdit: req.fileManagerRole === 'admin' || req.fileManagerRole === 'editor'
    }));

    get('/api/v3/plugins/file-manager/list', [managerAccess], req => FileManager.list(req.query.path || ''));
    get('/api/v3/plugins/file-manager/read', [managerAccess], req => FileManager.read(req.query.path));
    get('/api/v3/plugins/file-manager/search', [managerAccess], req => Extra.search(req.query.q, req.query.path || ''));
    get('/api/v3/plugins/file-manager/backups', [managerAccess], () => Extra.backups());

    // Access management is administrator-only. Search returns only public profile fields.
    get('/api/v3/plugins/file-manager/access', [adminOnly], async () => {
        const allowed = await getAllowedUsers();
        const uids = allowed.map(item => Number(item.uid));
        const users = uids.length ? await user.getUsersWithFields(uids, ['uid', 'username', 'userslug', 'picture'], 0) : [];
        const byUid = new Map(users.filter(Boolean).map(item => [String(item.uid), item]));
        return {
            users: allowed.map(item => {
                const profile = byUid.get(String(item.uid));
                return profile ? {
                    uid: String(item.uid),
                    username: profile.username,
                    userslug: profile.userslug,
                    picture: profile.picture,
                    role: item.role
                } : null;
            }).filter(Boolean)
        };
    });

    get('/api/v3/plugins/file-manager/users/search', [adminOnly], async req => {
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

    post('/api/v3/plugins/file-manager/access', [adminOnly, requireCurrentPassword], async req => {
        const allowedUsers = await saveAllowedUsers(req.body.allowedUsers);
        winston.info('[file-manager:audit] Access list updated by uid ' + req.uid + ' (' + allowedUsers.length + ' allowed users)');
        return { success: true, count: allowedUsers.length };
    });

    // All file-system mutations require the current user's NodeBB password again.
    post('/api/v3/plugins/file-manager/write', [editorAccess, requireCurrentPassword], req =>
        FileManager.write(req.body.path, req.body.content));
    post('/api/v3/plugins/file-manager/mkdir', [editorAccess, requireCurrentPassword], req =>
        FileManager.mkdir(req.body.path));
    post('/api/v3/plugins/file-manager/rename', [editorAccess, requireCurrentPassword], req =>
        FileManager.rename(req.body.path, req.body.newName));
    post('/api/v3/plugins/file-manager/delete', [editorAccess, requireCurrentPassword], req =>
        FileManager.remove(req.body.path));
    post('/api/v3/plugins/file-manager/copy', [editorAccess, requireCurrentPassword], req =>
        Extra.copyMove(req.body.path, req.body.destination, false));
    post('/api/v3/plugins/file-manager/move', [editorAccess, requireCurrentPassword], req =>
        Extra.copyMove(req.body.path, req.body.destination, true));
    post('/api/v3/plugins/file-manager/extract', [editorAccess, requireCurrentPassword], req =>
        Extra.extractZip(req.body.path, req.body.destination || ''));
    post('/api/v3/plugins/file-manager/restore', [editorAccess, requireCurrentPassword], req =>
        Extra.restore(req.body.id));
    post('/api/v3/plugins/file-manager/purge', [editorAccess, requireCurrentPassword], req =>
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
        requireCurrentPassword,
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
