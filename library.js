'use strict';

const routeHelpers = require.main.require('./src/routes/helpers');
const user = require.main.require('./src/user');
const FileManager = require('./lib/file-manager');

const plugin = {};

async function isAdministrator(req) {
    return Boolean(req.uid > 0 && await user.isAdministrator(req.uid));
}

plugin.init = async function ({ router, middleware }) {
    routeHelpers.setupAdminPageRoute(
        router,
        '/admin/plugins/file-manager',
        [middleware.ensureLoggedIn, async (req, res, next) => {
            if (!await isAdministrator(req)) {
                return res.status(403).send('Forbidden');
            }
            return next();
        }],
        (req, res) => {
            res.render('admin/plugins/file-manager', {
                title: 'מנהל הקבצים'
            });
        }
    );
};

plugin.addRoutes = async function ({ router, middleware, helpers }) {
    const ensureAdministrator = async (req, res, next) => {
        if (!await isAdministrator(req)) {
            return helpers.formatApiResponse(
                403,
                res,
                new Error('[[error:no-privileges]]')
            );
        }
        return next();
    };

    const adminOnly = [middleware.ensureLoggedIn, ensureAdministrator];

    const endpoint = (handler) => async (req, res) => {
        try {
            const result = await handler(req);
            return helpers.formatApiResponse(200, res, result);
        } catch (err) {
            return helpers.formatApiResponse(
                err.status || 400,
                res,
                new Error(err.message || 'File manager operation failed')
            );
        }
    };

    routeHelpers.setupApiRoute(
        router,
        'get',
        '/file-manager/list',
        adminOnly,
        endpoint(req => FileManager.list(req.query.path || ''))
    );

    routeHelpers.setupApiRoute(
        router,
        'get',
        '/file-manager/read',
        adminOnly,
        endpoint(req => FileManager.read(req.query.path))
    );

    routeHelpers.setupApiRoute(
        router,
        'post',
        '/file-manager/write',
        adminOnly,
        endpoint(req => FileManager.write(req.body.path, req.body.content))
    );

    routeHelpers.setupApiRoute(
        router,
        'post',
        '/file-manager/mkdir',
        adminOnly,
        endpoint(req => FileManager.mkdir(req.body.path))
    );

    routeHelpers.setupApiRoute(
        router,
        'post',
        '/file-manager/rename',
        adminOnly,
        endpoint(req => FileManager.rename(req.body.path, req.body.newName))
    );

    routeHelpers.setupApiRoute(
        router,
        'post',
        '/file-manager/delete',
        adminOnly,
        endpoint(req => FileManager.remove(req.body.path))
    );
};

plugin.addAdminNavigation = function (header) {
    header.plugins.push({
        route: '/plugins/file-manager',
        icon: 'fa-folder-open',
        name: 'מנהל קבצים'
    });

    return header;
};

module.exports = plugin;
