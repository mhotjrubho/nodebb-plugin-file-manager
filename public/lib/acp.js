'use strict';

require(['hooks'], function (hooks) {
    hooks.on('filter:script.load', function (data) {
        if (data.tpl_url !== 'admin/plugins/file-manager') {
            return data;
        }

        // NodeBB 4.x resolves the page template as a webpack module by default.
        // This plugin page is an AMD module bundled in scripts-admin instead.
        data.scripts = [function () {
            require(['admin/plugins/file-manager'], function (FileManagerPage) {
                if (FileManagerPage && typeof FileManagerPage.init === 'function') {
                    FileManagerPage.init();
                }
            });
        }];

        return data;
    });
});
