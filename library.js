'use strict';

const routeHelpers = require.main.require('./src/routes/helpers');
const controllerHelpers = require.main.require('./src/controllers/helpers');
const user = require.main.require('./src/user');
const winston = require.main.require('winston');
const upload = require.main.require('./src/middleware/multer');
const FileManager = require('./lib/file-manager');
const Extra = require('./lib/file-manager-extra');

const plugin = {};

async function isAdministrator(req) {
    return Boolean(req.uid > 0 && await user.isAdministrator(req.uid));
}

plugin.init = async function ({ router, middleware }) {
    routeHelpers.setupAdminPageRoute(
        router,
        '/admin/plugins/file-manager',
        [middleware.ensureLoggedIn, async (req, res, next) => {
            if (!await isAdministrator(req)) return res.status(403).send('Forbidden');
            return next();
        }],
        (req, res) => res.render('admin/plugins/file-manager', { title: 'מנהל הקבצים' })
    );
    plugin.addRoutes({ router, middleware, helpers: controllerHelpers });
};

plugin.addRoutes = function ({ router, middleware, helpers }) {
    const adminOnly = async (req, res, next) => {
        try {
            if (!await isAdministrator(req)) {
                return helpers.formatApiResponse(403, res, new Error('[[error:no-privileges]]'));
            }
            return next();
        } catch (error) {
            winston.error('[file-manager] Administrator check failed: ' + (error.stack || error));
            return helpers.formatApiResponse(500, res, new Error('שגיאה בבדיקת הרשאות מנהל'));
        }
    };

    const endpoint = handler => async (req, res) => {
        try {
            return helpers.formatApiResponse(200, res, await handler(req));
        } catch (error) {
            const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
            if (status === 500) winston.error('[file-manager] Operation failed: ' + (error.stack || error));
            const message = status === 500 ? 'אירעה שגיאה פנימית בפעולת מנהל הקבצים' : (error.message || 'הפעולה נכשלה');
            return helpers.formatApiResponse(status, res, new Error(message));
        }
    };

    const get = (route, handler) => routeHelpers.setupApiRoute(router, 'get', route, [adminOnly], endpoint(handler));
    const post = (route, handler) => routeHelpers.setupApiRoute(router, 'post', route, [adminOnly], endpoint(handler));

    get('/api/v3/plugins/file-manager/list', req => FileManager.list(req.query.path || ''));
    get('/api/v3/plugins/file-manager/read', req => FileManager.read(req.query.path));
    get('/api/v3/plugins/file-manager/search', req => Extra.search(req.query.q, req.query.path || ''));
    get('/api/v3/plugins/file-manager/backups', () => Extra.backups());

    post('/api/v3/plugins/file-manager/write', req => FileManager.write(req.body.path, req.body.content));
    post('/api/v3/plugins/file-manager/mkdir', req => FileManager.mkdir(req.body.path));
    post('/api/v3/plugins/file-manager/rename', req => FileManager.rename(req.body.path, req.body.newName));
    post('/api/v3/plugins/file-manager/delete', req => FileManager.remove(req.body.path));
    post('/api/v3/plugins/file-manager/copy', req => Extra.copyMove(req.body.path, req.body.destination, false));
    post('/api/v3/plugins/file-manager/move', req => Extra.copyMove(req.body.path, req.body.destination, true));
    post('/api/v3/plugins/file-manager/extract', req => Extra.extractZip(req.body.path, req.body.destination || ''));
    post('/api/v3/plugins/file-manager/restore', req => Extra.restore(req.body.id));
    post('/api/v3/plugins/file-manager/purge', req => Extra.purge(req.body.id));

    // NodeBB 4.x setupApiRoute attaches multer before plugin-specific middleware.
    // This dedicated route validates the administrator BEFORE accepting multipart bytes.
    router.post(
        '/api/v3/plugins/file-manager/upload',
        middleware.autoLocale,
        middleware.applyBlacklist,
        middleware.authenticateRequest,
        middleware.maintenanceMode,
        middleware.registrationComplete,
        middleware.pluginHooks,
        middleware.logApiUsage,
        adminOnly,
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
