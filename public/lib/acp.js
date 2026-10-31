'use strict';

require(['hooks'], function (hooks) {
    function initializeFileManagerPage() {
        if (!document.querySelector('.file-manager-page')) {
            return;
        }

        require(['admin/plugins/file-manager'], function (FileManagerPage) {
            if (FileManagerPage && typeof FileManagerPage.init === 'function') {
                FileManagerPage.init();
            }
        });
    }

    hooks.on('action:ajaxify.end', initializeFileManagerPage);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeFileManagerPage, { once: true });
    } else {
        initializeFileManagerPage();
    }
});
