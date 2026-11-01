'use strict';

define('admin/plugins/file-manager', ['api'], function (api) {
    const state = {
        path: '',
        homePath: '',
        role: 'viewer',
        canEdit: false,
        canManageAccess: false,
        editor: null,
        editorReady: false,
        editorLoading: null,
        editing: null,
        original: '',
        dirty: false,
        allowedUsers: [],
        searchResults: [],
        dialogResolve: null,
        passwordResolve: null,
        confirmResolve: null,
        toastTimer: null,
        wrapped: false,
        fullScreen: false,
        selectedItem: null,
        viewMode: 'list',
        fmPasswordConfigured: false,
        uploadController: null,
        uploadActive: false,
        previewRequestId: 0
    };

    const $ = id => document.getElementById(id);

    function fa(name) {
        const node = document.createElement('i');
        node.className = 'fa ' + name;
        node.setAttribute('aria-hidden', 'true');
        return node;
    }

    function request(method, route, data, headers) {
        return new Promise((resolve, reject) => {
            const callback = (error, response) => {
                if (error) return reject(error);
                resolve(response && response.response ? response.response : response);
            };
            if (method === 'get') api.get(route, data || {}, callback);
            else api.post(route, data || {}, headers || {}, callback);
        });
    }

    function toast(text, error) {
        const node = $('fm-message');
        node.textContent = text;
        node.hidden = false;
        node.classList.toggle('error', Boolean(error));
        clearTimeout(state.toastTimer);
        state.toastTimer = setTimeout(() => { node.hidden = true; }, 5000);
    }

    function makeButton(text, iconName, handler, danger) {
        const node = document.createElement('button');
        node.type = 'button';
        node.className = 'fm-action-btn' + (danger ? ' is-danger' : '');
        if (iconName) node.appendChild(fa(iconName));
        node.appendChild(document.createTextNode(text));
        node.addEventListener('click', event => { event.stopPropagation(); handler(event); });
        return node;
    }

    function askValue(title, description, value, placeholder, confirmText) {
        if (state.dialogResolve) state.dialogResolve(null);
        return new Promise(resolve => {
            state.dialogResolve = resolve;
            $('fm-dialog-title').textContent = title;
            $('fm-dialog-description').textContent = description || '';
            $('fm-dialog-input').type = 'text';
            $('fm-dialog-input').value = value || '';
            $('fm-dialog-input').placeholder = placeholder || '';
            $('fm-dialog-confirm').textContent = confirmText || 'אישור';
            $('fm-dialog').hidden = false;
            $('fm-dialog-input').focus();
            $('fm-dialog-input').select();
        });
    }

    function finishValueDialog(value) {
        const resolve = state.dialogResolve;
        state.dialogResolve = null;
        $('fm-dialog').hidden = true;
        if (resolve) resolve(value);
    }

    function askPassword(description, passwordKind) {
        if (state.passwordResolve) state.passwordResolve(null);
        return new Promise(resolve => {
            state.passwordResolve = resolve;
            const kind = passwordKind === 'nodebb' ? 'nodebb' : 'file-manager';
            $('fm-password-title').textContent = kind === 'nodebb' ? 'אימות סיסמת NodeBB' : 'נדרש מפתח אישי';
            $('fm-password-label-text').textContent = kind === 'nodebb' ? 'סיסמת חשבון NodeBB' : 'סיסמת מנהל הקבצים';
            $('fm-password-description').textContent = description || (kind === 'nodebb' ? 'הזן את סיסמת חשבון NodeBB שלך.' : 'הזן את סיסמת מנהל הקבצים האישית שלך.');
            $('fm-password-input').value = '';
            $('fm-password-error').hidden = true;
            $('fm-password-confirm').disabled = false;
            $('fm-password-dialog').hidden = false;
            $('fm-password-input').focus();
        });
    }

    function finishPasswordDialog(value) {
        const resolve = state.passwordResolve;
        state.passwordResolve = null;
        $('fm-password-dialog').hidden = true;
        $('fm-password-input').value = '';
        if (resolve) resolve(value);
    }

    function askConfirmation(title, description, confirmText) {
        if (state.confirmResolve) state.confirmResolve(false);
        return new Promise(resolve => {
            state.confirmResolve = resolve;
            $('fm-confirm-title').textContent = title;
            $('fm-confirm-description').textContent = description;
            $('fm-confirm-accept').textContent = confirmText || 'אישור';
            $('fm-confirm-dialog').hidden = false;
        });
    }

    function finishConfirmation(value) {
        const resolve = state.confirmResolve;
        state.confirmResolve = null;
        $('fm-confirm-dialog').hidden = true;
        if (resolve) resolve(Boolean(value));
    }

    async function securePost(route, data, description) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
            let password = await askPassword(description, 'nodebb');
            if (password === null) return null;
            try {
                return await request('post', route, data || {}, { 'x-password-confirmation': password });
            } catch (error) {
                const message = String(error && error.message || '');
                const rejected = /invalid password|invalid-password|password|סיסמ|אימות/i.test(message);
                if (!rejected || attempt === 2) throw error;
                toast('הסיסמה לא אושרה. נסה שוב.', true);
            } finally {
                password = '';
            }
        }
        return null;
    }

    async function secureFilePost(route, data, description) {
        if (!state.fmPasswordConfigured) {
            toast('לפני שינוי קבצים יש להגדיר סיסמת מנהל קבצים אישית.', true);
            openVaultDialog();
            return null;
        }
        for (let attempt = 0; attempt < 3; attempt += 1) {
            let password = await askPassword(description || 'הזן את סיסמת מנהל הקבצים האישית שלך.', 'file-manager');
            if (password === null) return null;
            try {
                return await request('post', route, data || {}, { 'x-file-manager-password': password });
            } catch (error) {
                const message = String(error && error.message || '');
                const rejected = /file manager password|password|סיסמ|מפתח מנהל הקבצים/i.test(message);
                if (!rejected || attempt === 2) throw error;
                toast('סיסמת מנהל הקבצים לא אושרה. נסה שוב.', true);
            } finally {
                password = '';
            }
        }
        return null;
    }

    async function loadSecurityStatus() {
        const result = await request('get', '/plugins/file-manager/credentials/status', {});
        state.fmPasswordConfigured = Boolean(result.configured);
        $('fm-vault-status').textContent = state.fmPasswordConfigured ? 'מפתח אישי מוגדר' : 'נדרש להגדיר מפתח אישי';
        $('fm-vault-status').classList.toggle('is-warning', !state.fmPasswordConfigured);
        $('fm-vault-open').textContent = state.fmPasswordConfigured ? 'שינוי סיסמה' : 'הגדרת סיסמה';
    }

    function openVaultDialog() {
        $('fm-vault-password').value = '';
        $('fm-vault-confirm').value = '';
        $('fm-vault-error').hidden = true;
        $('fm-vault-dialog').hidden = false;
        $('fm-vault-password').focus();
    }

    async function saveVaultPassword() {
        const password = $('fm-vault-password').value;
        const confirmation = $('fm-vault-confirm').value;
        if ([...password].length < 12) {
            $('fm-vault-error').textContent = 'יש לבחור סיסמה ארוכה של 12 תווים לפחות. עדיף משפט סיסמה ייחודי.';
            $('fm-vault-error').hidden = false;
            return;
        }
        if (password !== confirmation) {
            $('fm-vault-error').textContent = 'שתי הסיסמאות אינן זהות.';
            $('fm-vault-error').hidden = false;
            return;
        }
        try {
            const result = await securePost('/plugins/file-manager/credentials', { newPassword: password, confirmation },
                'כדי להגדיר או להחליף את המפתח האישי, הזן תחילה את סיסמת החשבון שלך ב־NodeBB.');
            if (!result) return;
            $('fm-vault-dialog').hidden = true;
            await loadSecurityStatus();
            toast('סיסמת מנהל הקבצים האישית נשמרה בהצלחה');
        } catch (error) {
            $('fm-vault-error').textContent = error.message || 'שמירת הסיסמה נכשלה';
            $('fm-vault-error').hidden = false;
        } finally {
            $('fm-vault-password').value = '';
            $('fm-vault-confirm').value = '';
        }
    }

    async function resetUserPassword(item) {
        const approved = await askConfirmation('איפוס מפתח משתמש', 'לאפס את סיסמת מנהל הקבצים של ' + item.username + '? המשתמש יידרש להגדיר מפתח אישי חדש.', 'איפוס מפתח');
        if (!approved) return;
        try {
            const result = await securePost('/plugins/file-manager/credentials/reset', { uid: item.uid },
                'איפוס מפתח משתמש הוא פעולה רגישה. הזן את סיסמת NodeBB של מנהל המערכת.');
            if (!result) return;
            toast('המפתח אופס. המשתמש יוכל להגדיר מפתח חדש.');
            await openAccessPanel();
        } catch (error) { toast(error.message || 'איפוס המפתח נכשל', true); }
    }

    function formatSize(bytes) {
        if (bytes === null || bytes === undefined) return '—';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    function formatDate(value) {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('he-IL');
    }

    function updateRoleUI() {
        const root = document.querySelector('.file-manager-page');
        root.classList.toggle('fm-readonly', !state.canEdit);

        const roleText = state.role === 'admin' ? 'מנהל מערכת · גישה מלאה' :
            state.role === 'editor' ? 'משתמש מורשה · עריכה' : 'משתמש מורשה · צפייה בתיקייה הציבורית';

        $('fm-role-label').textContent = roleText;
        $('fm-access-open').hidden = !state.canManageAccess;
        $('fm-backups').hidden = !state.canEdit;
        document.querySelectorAll('[data-admin-only]').forEach(node => { node.hidden = state.role === 'viewer'; });
        const rootQuickButton = document.querySelector('.fm-nav-button[data-path=""]');
        if (rootQuickButton) rootQuickButton.hidden = state.role === 'viewer';

        [
            'fm-new-folder',
            'fm-new-file',
            'fm-upload-files',
            'fm-upload-folder'
        ].forEach(id => { $(id).hidden = !state.canEdit; });

        if (state.editor && typeof state.editor.setOption === 'function') {
            state.editor.setOption('readOnly', !state.canEdit);
        }
        if (!state.canEdit && state.editor) {
            $('fm-save').disabled = true;
            $('fm-editor-discard').disabled = true;
        }
    }

    async function loadPermissions() {
        const result = await request('get', '/plugins/file-manager/permissions', {});
        state.role = result.role || 'viewer';
        state.homePath = result.homePath || '';
        state.canEdit = Boolean(result.canEdit);
        state.canManageAccess = Boolean(result.canManageAccess);
        updateRoleUI();
    }

    function loadStaticUrl(relative) {
        const prefix = (config.relative_path || '') + '/plugins/nodebb-plugin-file-manager/vendor/';
        return prefix + relative;
    }

    function loadCss(relative) {
        const href = loadStaticUrl(relative);
        if (document.querySelector('link[data-fm-css="' + href + '"]')) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.dataset.fmCss = href;
        document.head.appendChild(link);
    }

    let codeMirrorPathConfigured = false;

    function loadAmdModule(relative) {
        const moduleId = 'fm-vendor/' + relative.replace(/\.js$/, '');
        if (!codeMirrorPathConfigured) {
            const vendorRoot = loadStaticUrl('').replace(/\/$/, '');
            require.config({ paths: { 'fm-vendor': vendorRoot } });
            codeMirrorPathConfigured = true;
        }
        return new Promise((resolve, reject) => {
            require([moduleId], module => resolve(module), error => {
                const detail = error && (error.requireModules || error.message);
                reject(new Error('טעינת רכיב העורך נכשלה (' + relative + '): ' + String(detail || 'שגיאת AMD')));
            });
        });
    }

    async function ensureEditor() {
        if (state.editorReady) return;
        if (state.editorLoading) return state.editorLoading;

        state.editorLoading = (async () => {
            [
                'lib/codemirror.css',
                'theme/material-darker.css',
                'addon/fold/foldgutter.css',
                'addon/dialog/dialog.css',
                'addon/display/fullscreen.css'
            ].forEach(loadCss);

            const core = await loadAmdModule('lib/codemirror.js');
            const CodeMirror = core && core.default ? core.default : core;
            if (!CodeMirror || typeof CodeMirror.fromTextArea !== 'function') {
                throw new Error('ספריית העורך נטענה אך אינה זמינה');
            }
            window.CodeMirror = CodeMirror;

            const modules = [
                'mode/xml/xml.js',
                'mode/javascript/javascript.js',
                'mode/css/css.js',
                'mode/htmlmixed/htmlmixed.js',
                'mode/clike/clike.js',
                'mode/php/php.js',
                'mode/python/python.js',
                'mode/shell/shell.js',
                'mode/yaml/yaml.js',
                'mode/markdown/markdown.js',
                'mode/sql/sql.js',
                'addon/edit/closebrackets.js',
                'addon/edit/matchbrackets.js',
                'addon/edit/matchtags.js',
                'addon/edit/closetag.js',
                'addon/selection/active-line.js',
                'addon/display/fullscreen.js',
                'addon/fold/foldcode.js',
                'addon/fold/foldgutter.js',
                'addon/fold/brace-fold.js',
                'addon/fold/xml-fold.js',
                'addon/search/searchcursor.js',
                'addon/dialog/dialog.js',
                'addon/search/search.js',
                'addon/comment/comment.js',
                'addon/comment/continuecomment.js'
            ];
            for (const modulePath of modules) {
                await loadAmdModule(modulePath);
            }

            state.editor = CodeMirror.fromTextArea($('fm-editor'), {
                mode: 'text/plain',
                theme: 'material-darker',
                lineNumbers: true,
                lineWrapping: false,
                indentUnit: 4,
                tabSize: 4,
                indentWithTabs: false,
                matchBrackets: true,
                autoCloseBrackets: true,
                styleActiveLine: true,
                matchTags: { bothTags: true },
                autoCloseTags: true,
                foldGutter: true,
                gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
                extraKeys: {
                    'Ctrl-S': () => saveFile(),
                    'Cmd-S': () => saveFile(),
                    'Ctrl-F': 'findPersistent',
                    'Cmd-F': 'findPersistent',
                    'Ctrl-/': 'toggleComment',
                    'Cmd-/': 'toggleComment',
                    'Tab': cm => {
                        if (cm.somethingSelected()) cm.indentSelection('add');
                        else cm.replaceSelection(' '.repeat(cm.getOption('indentUnit')), 'end');
                    }
                }
            });

            state.editor.on('change', () => updateEditorStatus());
            state.editor.on('cursorActivity', () => updateEditorStatus());
            state.editorReady = true;
            updateRoleUI();
        })();

        try {
            await state.editorLoading;
        } finally {
            state.editorLoading = null;
        }
    }

    function detectMode(filename) {
        const extension = String(filename || '').split('.').pop().toLowerCase();
        const modes = {
            js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
            json: { name: 'javascript', json: true },
            html: 'htmlmixed', htm: 'htmlmixed', tpl: 'htmlmixed',
            xml: 'application/xml', svg: 'xml',
            css: 'css', scss: 'css', less: 'css',
            php: 'application/x-httpd-php',
            py: 'python',
            sh: 'shell', bash: 'shell',
            yml: 'yaml', yaml: 'yaml',
            md: 'markdown', markdown: 'markdown',
            sql: 'text/x-sql'
        };
        return modes[extension] || 'text/plain';
    }

    function updateEditorStatus() {
        if (!state.editor && !$('fm-editor')) return;
        const content = state.editor ? state.editor.getValue() : $('fm-editor').value;
        let line = 1;
        let column = 1;
        let lines = 1;
        if (state.editor) {
            const cursor = state.editor.getCursor();
            lines = state.editor.lineCount();
            line = cursor.line + 1;
            column = cursor.ch + 1;
        } else {
            const before = content.slice(0, $('fm-editor').selectionStart || 0);
            line = before.split('\n').length;
            column = before.length - before.lastIndexOf('\n');
            lines = content.split('\n').length;
        }
        $('fm-editor-lines').textContent = lines + ' שורות · שורה ' + line + ', עמודה ' + column;
        state.dirty = content !== state.original;
        $('fm-editor-dirty').textContent = state.dirty ? 'יש שינויים שטרם נשמרו' : 'אין שינויים שלא נשמרו';
        $('fm-editor-dirty').classList.toggle('fm-editor-dirty', state.dirty);
        $('fm-editor-status').textContent = state.dirty ? 'נערך · טרם נשמר' : 'הקובץ מסונכרן';
        $('fm-save').disabled = !state.canEdit || !state.dirty;
        $('fm-editor-discard').disabled = !state.dirty;
    }

    function setEditorMode(filename) {
        if (!state.editor) return;
        const mode = detectMode(filename);
        state.editor.setOption('mode', mode);
        $('fm-editor-language').textContent = typeof mode === 'string' ? mode : 'JSON / JavaScript';
    }

    async function load(folder) {
        state.path = folder || '';
        state.selectedItem = null;
        $('fm-preview-title').textContent = 'תצוגה מקדימה';
        $('fm-preview-meta').textContent = '';
        $('fm-preview-image').hidden = true;
        $('fm-preview-content').replaceChildren();
        $('fm-preview-empty').hidden = false;
        $('fm-preview-empty').textContent = 'בחר קובץ כדי לראות פרטים או תצוגה מקדימה.';
        $('fm-preview-edit').hidden = true;
        document.querySelectorAll('.fm-nav-button').forEach(button => button.classList.toggle('is-active', button.dataset.path === state.path));
        $('fm-current-path').textContent = '/' + state.path;
        $('fm-breadcrumb').textContent = '/' + state.path;
        $('fm-up').disabled = !state.path || state.path === state.homePath;

        const list = $('fm-file-list');
        list.replaceChildren();
        const loading = document.createElement('div');
        loading.className = 'fm-empty';
        loading.appendChild(fa('fa-circle-notch fa-spin'));
        const bold = document.createElement('strong');
        bold.textContent = 'טוען קבצים';
        const hint = document.createElement('span');
        hint.textContent = 'קורא את תוכן התיקייה';
        loading.append(bold, hint);
        list.appendChild(loading);

        try {
            const result = await request('get', '/plugins/file-manager/list', { path: state.path });
            renderFiles(result.entries || []);
        } catch (error) {
            list.replaceChildren();
            const failed = document.createElement('div');
            failed.className = 'fm-empty';
            failed.appendChild(fa('fa-exclamation-triangle'));
            const bold = document.createElement('strong');
            bold.textContent = 'טעינת התיקייה נכשלה';
            failed.appendChild(bold);
            list.appendChild(failed);
            $('fm-item-count').textContent = '—';
            toast(error.message || 'שגיאה בטעינת הקבצים', true);
        }
    }

    function fileIcon(item) {
        if (item.type === 'directory') return 'fa-folder';
        if (item.type === 'symlink') return 'fa-link';
        const ext = String(item.name || '').split('.').pop().toLowerCase();
        if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'svg', 'ico'].includes(ext)) return 'fa-file-image';
        if (['zip', 'gz', 'tar', '7z', 'rar'].includes(ext)) return 'fa-file-archive';
        if (['js', 'mjs', 'cjs', 'json', 'php', 'py', 'html', 'htm', 'css', 'scss', 'xml', 'sql', 'sh', 'yml', 'yaml', 'md'].includes(ext)) return 'fa-file-code';
        if (ext === 'pdf') return 'fa-file-pdf';
        return 'fa-file-alt';
    }

    async function selectItem(item) {
        const previewRequestId = ++state.previewRequestId;
        state.selectedItem = item;
        document.querySelectorAll('.fm-file-row.is-selected').forEach(row => row.classList.remove('is-selected'));
        const selectedPath = String(item.path || '');
        const row = Array.from(document.querySelectorAll('.fm-file-row')).find(node => node.dataset.path === selectedPath);
        if (row) row.classList.add('is-selected');

        $('fm-preview-title').textContent = item.name || selectedPath.split('/').pop();
        $('fm-preview-meta').textContent = item.type === 'directory' ? 'תיקייה' : formatSize(item.size) + ' · ' + formatDate(item.modified);
        $('fm-preview-content').replaceChildren();
        $('fm-preview-empty').hidden = true;
        $('fm-preview-image').hidden = true;
        $('fm-preview-edit').hidden = false;
        $('fm-preview-edit').textContent = item.type === 'directory' ? 'פתח תיקייה' : (state.canEdit ? 'ערוך קובץ' : 'פתח לצפייה');

        if (item.type === 'directory') {
            $('fm-preview-content').appendChild(fa('fa-folder-open'));
            const note = document.createElement('p');
            note.textContent = 'לחץ פעמיים על התיקייה או על הכפתור כדי לפתוח אותה.';
            $('fm-preview-content').appendChild(note);
            return;
        }

        if (item.type !== 'file') {
            $('fm-preview-empty').hidden = false;
            $('fm-preview-empty').textContent = 'אין תצוגה מקדימה לפריט זה.';
            $('fm-preview-edit').hidden = true;
            return;
        }

        const loading = document.createElement('div');
        loading.className = 'fm-preview-loading';
        loading.append(fa('fa-circle-notch fa-spin'), document.createTextNode(' טוען תצוגה מקדימה…'));
        $('fm-preview-content').appendChild(loading);
        try {
            const result = await request('get', '/plugins/file-manager/preview', { path: item.path });
            if (previewRequestId !== state.previewRequestId) return;
            $('fm-preview-content').replaceChildren();
            if (result.kind === 'image') {
                $('fm-preview-image').src = 'data:' + result.mime + ';base64,' + result.data;
                $('fm-preview-image').alt = item.name;
                $('fm-preview-image').hidden = false;
            } else if (result.kind === 'text') {
                const pre = document.createElement('pre');
                pre.className = 'fm-preview-code';
                pre.dir = 'ltr';
                pre.textContent = result.content;
                $('fm-preview-content').appendChild(pre);
                if (result.truncated) {
                    const note = document.createElement('small');
                    note.textContent = 'התצוגה קוצרה. פתח את הקובץ כדי לראות את כולו.';
                    $('fm-preview-content').appendChild(note);
                }
            } else {
                $('fm-preview-empty').hidden = false;
                $('fm-preview-empty').textContent = 'אין תצוגה מקדימה לסוג הקובץ הזה. אפשר לפתוח אותו בעורך אם הוא קובץ טקסט נתמך.';
            }
        } catch (error) {
            if (previewRequestId !== state.previewRequestId) return;
            $('fm-preview-content').replaceChildren();
            $('fm-preview-empty').hidden = false;
            $('fm-preview-empty').textContent = error.message || 'לא ניתן להציג תצוגה מקדימה.';
        }
    }

    function renderFiles(entries) {
        const list = $('fm-file-list');
        list.replaceChildren();
        list.classList.toggle('is-grid', state.viewMode === 'grid');
        $('fm-item-count').textContent = String(entries.length);

        if (!entries.length) {
            const empty = document.createElement('div');
            empty.className = 'fm-empty';
            empty.append(fa('fa-folder-open'));
            const title = document.createElement('strong');
            title.textContent = 'התיקייה ריקה';
            const hint = document.createElement('span');
            hint.textContent = 'אפשר להעלות קבצים או ליצור פריט חדש';
            empty.append(title, hint);
            list.appendChild(empty);
            return;
        }

        entries.forEach(item => {
            const row = document.createElement('div');
            row.className = 'fm-file-row';
            row.dataset.path = item.path;
            row.tabIndex = 0;
            if (state.selectedItem && state.selectedItem.path === item.path) row.classList.add('is-selected');

            const name = document.createElement('div');
            name.className = 'fm-file-name' + (item.type === 'directory' ? ' is-directory' : '');
            const fileIconNode = document.createElement('span');
            fileIconNode.className = 'fm-file-icon' + (item.type === 'directory' ? ' is-folder' : '');
            fileIconNode.appendChild(fa(fileIcon(item)));
            const label = document.createElement('span');
            label.className = 'fm-file-name-label';
            label.dir = 'auto';
            label.textContent = item.name;
            name.append(fileIconNode, label);

            const type = document.createElement('span');
            type.className = 'fm-file-type' + (item.type === 'directory' ? ' is-folder' : '');
            type.textContent = item.type === 'directory' ? 'תיקייה' : item.type === 'symlink' ? 'קישור' :
                item.type === 'other' ? 'אחר' : (String(item.name).split('.').pop().toUpperCase() || 'קובץ');

            const size = document.createElement('span');
            size.className = 'fm-file-meta';
            size.textContent = formatSize(item.size);

            const modified = document.createElement('span');
            modified.className = 'fm-file-modified';
            modified.textContent = formatDate(item.modified);

            const actions = document.createElement('div');
            actions.className = 'fm-file-actions';
            if (item.type === 'file') {
                actions.appendChild(makeButton(state.canEdit ? 'עריכה' : 'צפייה', state.canEdit ? 'fa-edit' : 'fa-eye', () => openFile(item.path)));
                if (state.canEdit && /\.zip$/i.test(item.name)) actions.appendChild(makeButton('חילוץ', 'fa-file-archive', () => extractZip(item.path)));
            }
            if (state.canEdit && (item.type === 'file' || item.type === 'directory')) {
                actions.appendChild(makeButton('העתקה', 'fa-copy', () => copyMove(item, false)));
                actions.appendChild(makeButton('העברה', 'fa-exchange-alt', () => copyMove(item, true)));
                actions.appendChild(makeButton('שינוי שם', 'fa-pen', () => renameItem(item)));
                actions.appendChild(makeButton('מחיקה', 'fa-trash-alt', () => removeItem(item), true));
            }

            row.append(name, type, size, modified, actions);
            row.addEventListener('click', () => selectItem(item));
            row.addEventListener('dblclick', () => {
                if (item.type === 'directory') load(item.path);
                else if (item.type === 'file') openFile(item.path);
            });
            row.addEventListener('keydown', event => {
                if (event.key === 'Enter') {
                    if (item.type === 'directory') load(item.path);
                    else if (item.type === 'file') openFile(item.path);
                }
            });
            list.appendChild(row);
        });
    }

    async function openFile(folder) {
        let fileResult = null;
        try {
            fileResult = await request('get', '/plugins/file-manager/read', { path: folder });
            state.editing = fileResult.path;
            state.original = fileResult.content;
            $('fm-editor-panel').hidden = false;
            $('fm-workspace-grid').classList.add('has-editor');
            $('fm-editor-title').textContent = folder.split('/').pop();
            $('fm-editor-path').textContent = folder;
            await ensureEditor();
            state.editor.setValue(fileResult.content);
            state.editor.clearHistory();
            setEditorMode(folder);
            state.editor.setOption('readOnly', !state.canEdit);
            updateEditorStatus();
            state.editor.refresh();
            state.editor.focus();
            if (window.innerWidth <= 900) $('fm-editor-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (error) {
            // Keep the plain textarea usable as a fallback if the editor assets fail to load.
            $('fm-editor-panel').hidden = false;
            $('fm-workspace-grid').classList.add('has-editor');
            $('fm-editor').value = fileResult ? fileResult.content : '';
            $('fm-editor').readOnly = !state.canEdit;
            $('fm-editor-language').textContent = 'עורך טקסט בסיסי (גיבוי)';
            if ($('fm-editor').dataset.fmFallbackBound !== 'true') {
                $('fm-editor').addEventListener('input', updateEditorStatus);
                $('fm-editor').addEventListener('keyup', updateEditorStatus);
                $('fm-editor').addEventListener('click', updateEditorStatus);
                $('fm-editor').dataset.fmFallbackBound = 'true';
            }
            updateEditorStatus();
            toast('טעינת עורך הקוד נכשלה. נפתח עורך גיבוי: ' + (error.message || 'שגיאה'), true);
        }
    }

    async function saveFile() {
        if (!state.editing || !state.canEdit) return;
        const content = state.editor ? state.editor.getValue() : $('fm-editor').value;
        if (content === state.original) return toast('לא בוצעו שינויים');
        if (new Blob([content]).size > 2 * 1024 * 1024) return toast('הקובץ חורג ממגבלת העריכה של 2MB', true);

        try {
            const result = await secureFilePost('/plugins/file-manager/write', {
                path: state.editing,
                content
            }, 'כדי לשמור שינויים בקובץ, הזן את סיסמת מנהל הקבצים האישית שלך.');
            if (!result) return;
            state.original = content;
            if (state.editor) state.editor.clearHistory();
            updateEditorStatus();
            toast(result.backup ? 'הקובץ נשמר ונוצר גיבוי: ' + result.backup : 'הקובץ נשמר בהצלחה');
        } catch (error) {
            toast(error.message || 'שמירת הקובץ נכשלה', true);
        }
    }

    async function createFolder() {
        const value = await askValue('יצירת תיקייה', 'הקלד שם לתיקייה החדשה.', '', 'שם התיקייה', 'יצירת תיקייה');
        if (!value || !value.trim()) return;
        try {
            const result = await secureFilePost('/plugins/file-manager/mkdir', {
                path: (state.path ? state.path + '/' : '') + value.trim()
            }, 'אימות סיסמה נדרש לפני יצירת תיקייה.');
            if (!result) return;
            toast('התיקייה נוצרה בהצלחה');
            await load(state.path);
        } catch (error) { toast(error.message || 'יצירת התיקייה נכשלה', true); }
    }

    async function createFile() {
        const value = await askValue('יצירת קובץ', 'הקלד שם כולל סיומת, למשל config.json.', '', 'filename.ext', 'יצירת קובץ');
        if (!value || !value.trim()) return;
        const folder = (state.path ? state.path + '/' : '') + value.trim();
        try {
            const result = await secureFilePost('/plugins/file-manager/write', { path: folder, content: '' }, 'אימות סיסמה נדרש לפני יצירת קובץ חדש.');
            if (!result) return;
            toast('הקובץ נוצר בהצלחה');
            await load(state.path);
            await openFile(folder);
        } catch (error) { toast(error.message || 'יצירת הקובץ נכשלה', true); }
    }

    async function renameItem(item) {
        const value = await askValue('שינוי שם', 'הקלד את השם החדש של הפריט.', item.name, 'שם חדש', 'שמירת השם');
        if (!value || !value.trim() || value.trim() === item.name) return;
        try {
            const result = await secureFilePost('/plugins/file-manager/rename', {
                path: item.path,
                newName: value.trim()
            }, 'אימות סיסמה נדרש לפני שינוי שם.');
            if (!result) return;
            toast('שם הפריט עודכן');
            await load(state.path);
        } catch (error) { toast(error.message || 'שינוי השם נכשל', true); }
    }

    async function removeItem(item) {
        const approved = await askConfirmation('העברה לסל המחזור', 'להעביר את "' + item.name + '" לסל המחזור? אפשר לשחזר אותו בהמשך.', 'העבר לסל המחזור');
        if (!approved) return;
        try {
            const result = await secureFilePost('/plugins/file-manager/delete', { path: item.path }, 'אימות סיסמה נדרש לפני העברת פריט לסל המחזור.');
            if (!result) return;
            toast('הפריט הועבר לסל המחזור');
            await load(state.path);
        } catch (error) { toast(error.message || 'העברת הפריט נכשלה', true); }
    }

    async function copyMove(item, move) {
        const suggested = move ? '' : (state.path ? state.path + '/' : '') + item.name + '-copy';
        const value = await askValue(move ? 'העברת פריט' : 'העתקת פריט', 'הזן נתיב יעד יחסי לתיקיית NodeBB.', suggested, 'למשל public/uploads/example', move ? 'העברה' : 'העתקה');
        if (!value || !value.trim()) return;
        try {
            const result = await secureFilePost('/plugins/file-manager/' + (move ? 'move' : 'copy'), {
                path: item.path,
                destination: value.trim()
            }, 'אימות סיסמה נדרש לפני העתקה או העברה.');
            if (!result) return;
            toast(move ? 'הפריט הועבר' : 'הפריט הועתק');
            await load(state.path);
        } catch (error) { toast(error.message || 'הפעולה נכשלה', true); }
    }

    async function searchFiles() {
        const query = $('fm-search-input').value.trim();
        if (query.length < 2) return toast('יש להזין לפחות שני תווים לחיפוש', true);
        try {
            const result = await request('get', '/plugins/file-manager/search', { q: query, path: state.path });
            renderFiles((result.results || []).map(item => ({ ...item, name: String(item.path).split('/').pop() })));
            toast(result.truncated ? 'הוצגו תוצאות חלקיות. צמצם את החיפוש.' : 'נמצאו ' + result.results.length + ' תוצאות');
        } catch (error) { toast(error.message || 'החיפוש נכשל', true); }
    }

    async function uploadFiles(input) {
        const files = Array.from(input.files || []);
        if (!files.length) return;
        if (!state.fmPasswordConfigured) {
            input.value = '';
            toast('יש להגדיר תחילה סיסמת מנהל קבצים אישית.', true);
            openVaultDialog();
            return;
        }

        let password = await askPassword('הזן את סיסמת מנהל הקבצים כדי לאשר את ההעלאה.', 'file-manager');
        if (password === null) {
            input.value = '';
            return;
        }

        let count = 0;
        state.uploadController = new AbortController();
        state.uploadActive = true;
        $('fm-upload-progress-wrap').hidden = false;
        $('fm-upload-progress').value = 0;
        $('fm-upload-progress-label').textContent = 'מתחיל העלאה של ' + files.length + ' קבצים…';
        $('fm-upload-cancel').disabled = false;

        try {
            for (let offset = 0; offset < files.length; offset += 20) {
                const batch = files.slice(offset, offset + 20);
                const form = new FormData();
                const paths = [];
                batch.forEach(file => {
                    form.append('files', file, file.name);
                    paths.push(file.webkitRelativePath || file.name);
                });
                form.append('relativePaths', JSON.stringify(paths));
                form.append('path', state.path);

                const response = await fetch((config.relative_path || '') + '/api/v3/plugins/file-manager/upload', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'x-csrf-token': config.csrf_token,
                        'x-file-manager-password': password
                    },
                    body: form,
                    signal: state.uploadController.signal
                });
                const raw = await response.json().catch(() => ({}));
                const result = raw && raw.response ? raw.response : raw;
                if (!response.ok) {
                    const message = result && result.status && result.status.message || result.error || response.statusText;
                    const error = new Error(message || 'ההעלאה נכשלה');
                    error.status = response.status;
                    throw error;
                }
                count += result.count || batch.length;
                const percent = Math.round((count / files.length) * 100);
                $('fm-upload-progress').value = percent;
                $('fm-upload-progress-label').textContent = 'הועלו ' + count + ' מתוך ' + files.length + ' קבצים (' + percent + '%)';
            }
            toast('ההעלאה הושלמה: ' + count + ' קבצים');
        } catch (error) {
            if (error.name === 'AbortError') {
                toast('ההעלאה בוטלה לאחר ' + count + ' קבצים. ייתכן שהמנה האחרונה כבר הושלמה בשרת.');
            } else {
                toast('ההעלאה נעצרה לאחר ' + count + ' קבצים: ' + (error.message || 'שגיאה'), true);
            }
        } finally {
            password = '';
            state.uploadActive = false;
            state.uploadController = null;
            $('fm-upload-progress-wrap').hidden = true;
            $('fm-upload-cancel').disabled = true;
            input.value = '';
            await load(state.path);
        }
    }

    async function extractZip(folder) {
        const approved = await askConfirmation('חילוץ ארכיון ZIP', 'לחלץ את הארכיון לתיקייה הנוכחית? קבצים קיימים לא יידרסו.', 'חלץ ארכיון');
        if (!approved) return;
        try {
            const result = await secureFilePost('/plugins/file-manager/extract', {
                path: folder,
                destination: state.path
            }, 'אימות סיסמה נדרש לפני חילוץ ארכיון.');
            if (!result) return;
            toast('החילוץ הושלם: ' + result.entries + ' פריטים');
            await load(state.path);
        } catch (error) { toast(error.message || 'חילוץ ZIP נכשל', true); }
    }

    async function openBackups() {
        $('fm-backups-panel').hidden = false;
        const list = $('fm-backups-list');
        list.replaceChildren();
        const loading = document.createElement('div');
        loading.className = 'fm-empty';
        loading.textContent = 'טוען גיבויים וסל מחזור…';
        list.appendChild(loading);

        try {
            const result = await request('get', '/plugins/file-manager/backups', {});
            renderBackups(result.backups || []);
        } catch (error) { toast(error.message || 'טעינת הגיבויים נכשלה', true); }
    }

    function renderBackups(items) {
        const list = $('fm-backups-list');
        list.replaceChildren();
        if (!items.length) {
            const empty = document.createElement('div');
            empty.className = 'fm-empty';
            empty.append(fa('fa-history'));
            const bold = document.createElement('strong');
            bold.textContent = 'אין כרגע גיבויים או פריטים בסל המחזור';
            empty.appendChild(bold);
            list.appendChild(empty);
            return;
        }

        items.forEach(item => {
            const row = document.createElement('div');
            row.className = 'fm-backup-row';
            const name = document.createElement('div');
            name.className = 'fm-backup-name';
            name.dir = 'auto';
            name.textContent = item.path;
            const kind = document.createElement('span');
            kind.className = 'fm-backup-kind';
            kind.textContent = item.kind === 'trash' ? (item.isDirectory ? 'תיקייה שנמחקה' : 'סל מחזור') : 'גיבוי גרסה';
            const created = document.createElement('span');
            created.className = 'fm-backup-date';
            created.textContent = formatDate(item.createdAt);
            const actions = document.createElement('div');
            actions.className = 'fm-backup-actions';
            if (state.canEdit) {
                actions.appendChild(makeButton('שחזור', 'fa-undo', () => restoreBackup(item)));
                if (item.kind === 'trash') actions.appendChild(makeButton('מחיקה לצמיתות', 'fa-trash-alt', () => purgeBackup(item), true));
            }
            row.append(name, kind, created, actions);
            list.appendChild(row);
        });
    }

    async function restoreBackup(item) {
        const approved = await askConfirmation('שחזור פריט', 'לשחזר את הפריט? אם כבר קיים פריט באותו נתיב, השחזור לא ידרוס אותו.\n' + item.path, 'שחזור');
        if (!approved) return;
        try {
            const result = await secureFilePost('/plugins/file-manager/restore', { id: item.id }, 'אימות סיסמה נדרש לפני שחזור גיבוי.');
            if (!result) return;
            toast('השחזור הושלם בהצלחה');
            await openBackups();
            await load(state.path);
        } catch (error) { toast(error.message || 'השחזור נכשל', true); }
    }

    async function purgeBackup(item) {
        const approved = await askConfirmation('מחיקה לצמיתות', 'למחוק לצמיתות את הפריט ואת כל תוכנו? לא ניתן לשחזר פעולה זו.\n' + item.path, 'מחיקה לצמיתות');
        if (!approved) return;
        try {
            const result = await secureFilePost('/plugins/file-manager/purge', { id: item.id }, 'אימות סיסמה נדרש לפני מחיקה לצמיתות.');
            if (!result) return;
            toast('הפריט נמחק לצמיתות');
            await openBackups();
        } catch (error) { toast(error.message || 'המחיקה לצמיתות נכשלה', true); }
    }

    async function openAccessPanel() {
        if (!state.canManageAccess) return;
        $('fm-access-panel').hidden = false;
        $('fm-user-search-results').replaceChildren();
        try {
            const result = await request('get', '/plugins/file-manager/access', {});
            state.allowedUsers = result.users || [];
            renderAllowedUsers();
        } catch (error) { toast(error.message || 'טעינת רשימת ההרשאות נכשלה', true); }
    }

    async function searchUsers() {
        const query = $('fm-user-search').value.trim();
        if (query.length < 2) return toast('יש להזין לפחות שני תווים לחיפוש משתמש', true);
        const results = $('fm-user-search-results');
        results.replaceChildren();
        const loading = document.createElement('div');
        loading.className = 'fm-empty';
        loading.textContent = 'מחפש משתמשים בפורום…';
        results.appendChild(loading);
        try {
            const response = await request('get', '/plugins/file-manager/users/search', { q: query });
            state.searchResults = response.users || [];
            renderUserSearchResults();
        } catch (error) {
            results.replaceChildren();
            toast(error.message || 'חיפוש המשתמשים נכשל', true);
        }
    }

    function renderUserSearchResults() {
        const results = $('fm-user-search-results');
        results.replaceChildren();
        if (!state.searchResults.length) return;

        state.searchResults.forEach(user => {
            const row = document.createElement('div');
            row.className = 'fm-user-search-result';
            const name = document.createElement('div');
            name.className = 'fm-user-search-name';
            const avatar = document.createElement('span');
            avatar.className = 'fm-user-avatar';
            if (user.picture) {
                const img = document.createElement('img');
                img.src = user.picture;
                img.alt = '';
                avatar.appendChild(img);
            } else {
                avatar.appendChild(fa('fa-user'));
            }
            const text = document.createElement('span');
            text.textContent = user.username;
            text.dir = 'auto';
            name.append(avatar, text);

            const add = document.createElement('button');
            add.type = 'button';
            add.className = 'fm-btn fm-btn-light';
            add.textContent = state.allowedUsers.some(item => String(item.uid) === String(user.uid)) ? 'כבר מורשה' : 'הוספת משתמש';
            add.disabled = state.allowedUsers.some(item => String(item.uid) === String(user.uid));
            add.addEventListener('click', () => {
                if (state.allowedUsers.some(item => String(item.uid) === String(user.uid))) return;
                state.allowedUsers.push({
                    uid: String(user.uid),
                    username: user.username,
                    userslug: user.userslug,
                    picture: user.picture,
                    hasPassword: false,
                    role: 'viewer'
                });
                renderAllowedUsers();
                renderUserSearchResults();
            });
            row.append(name, add);
            results.appendChild(row);
        });
    }

    function renderAllowedUsers() {
        const list = $('fm-allowed-users');
        list.replaceChildren();
        $('fm-access-count').textContent = state.allowedUsers.length + ' משתמשים';

        if (!state.allowedUsers.length) {
            const empty = document.createElement('div');
            empty.className = 'fm-empty';
            empty.append(fa('fa-user-lock'));
            const bold = document.createElement('strong');
            bold.textContent = 'לא הוגדרו משתמשים מורשים';
            const hint = document.createElement('span');
            hint.textContent = 'רק מנהלי NodeBB יכולים להיכנס עד להוספת משתמשים.';
            empty.append(bold, hint);
            list.appendChild(empty);
            return;
        }

        state.allowedUsers.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'fm-allowed-user';
            const name = document.createElement('div');
            name.className = 'fm-allowed-user-name';
            name.textContent = item.username || ('משתמש ' + item.uid);
            const uid = document.createElement('span');
            uid.className = 'fm-allowed-user-uid';
            uid.textContent = 'UID ' + item.uid;
            name.appendChild(uid);

            const select = document.createElement('select');
            select.setAttribute('aria-label', 'רמת הרשאה עבור ' + (item.username || item.uid));
            [
                { value: 'viewer', label: 'צפייה בלבד' },
                { value: 'editor', label: 'צפייה ועריכה' }
            ].forEach(optionData => {
                const option = document.createElement('option');
                option.value = optionData.value;
                option.textContent = optionData.label;
                select.appendChild(option);
            });
            select.value = item.role === 'editor' ? 'editor' : 'viewer';
            select.addEventListener('change', () => { state.allowedUsers[index].role = select.value; });

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'fm-action-btn is-danger';
            remove.append(fa('fa-user-times'), document.createTextNode(' הסרה'));
            remove.addEventListener('click', () => {
                state.allowedUsers.splice(index, 1);
                renderAllowedUsers();
                renderUserSearchResults();
            });
            const keyStatus = document.createElement('span');
            keyStatus.className = item.hasPassword ? 'fm-key-status is-set' : 'fm-key-status is-missing';
            keyStatus.textContent = item.hasPassword ? 'מפתח מוגדר' : 'ללא מפתח';

            const reset = document.createElement('button');
            reset.type = 'button';
            reset.className = 'fm-action-btn';
            reset.textContent = item.hasPassword ? 'איפוס מפתח' : 'ללא מפתח';
            reset.disabled = !item.hasPassword;
            reset.addEventListener('click', event => { event.stopPropagation(); resetUserPassword(item); });

            row.append(name, select, keyStatus, reset, remove);
            list.appendChild(row);
        });
    }

    async function saveAccessList() {
        try {
            const payload = state.allowedUsers.map(item => ({
                uid: String(item.uid),
                role: item.role === 'editor' ? 'editor' : 'viewer'
            }));
            const result = await securePost('/plugins/file-manager/access', { allowedUsers: payload },
                'שינוי הרשאות גישה הוא פעולה רגישה. הזן את סיסמת חשבון המנהל שלך.');
            if (!result) return;
            toast('רשימת המשתמשים המורשים נשמרה');
            await openAccessPanel();
        } catch (error) { toast(error.message || 'שמירת ההרשאות נכשלה', true); }
    }

    async function closeEditor() {
        const dirty = state.editor ? state.editor.getValue() !== state.original : $('fm-editor').value !== state.original;
        if (dirty) {
            const approved = await askConfirmation('סגירת העורך', 'יש שינויים שלא נשמרו. לסגור את העורך ולאבד אותם?', 'סגירה ללא שמירה');
            if (!approved) return;
        }
        $('fm-editor-panel').hidden = true;
        $('fm-workspace-grid').classList.remove('has-editor');
        state.editing = null;
        state.original = '';
        state.dirty = false;
    }

    async function discardEditorChanges() {
        const currentContent = state.editor ? state.editor.getValue() : $('fm-editor').value;
        if (currentContent === state.original) return;
        const approved = await askConfirmation('ביטול שינויים', 'להחזיר את תוכן העורך לגרסה האחרונה שנשמרה?', 'ביטול שינויים');
        if (!approved) return;
        if (state.editor) {
            state.editor.setValue(state.original);
            state.editor.clearHistory();
        } else {
            $('fm-editor').value = state.original;
        }
        updateEditorStatus();
    }

    function toggleWrap() {
        if (!state.editor) return;
        state.wrapped = !state.wrapped;
        state.editor.setOption('lineWrapping', state.wrapped);
        $('fm-editor-wrap').classList.toggle('is-active', state.wrapped);
    }

    function toggleFullScreen() {
        if (!state.editor) return;
        state.fullScreen = !state.fullScreen;
        state.editor.setOption('fullScreen', state.fullScreen);
        $('fm-editor-fullscreen').classList.toggle('is-active', state.fullScreen);
        $('fm-editor-fullscreen').innerHTML = state.fullScreen ? '<i class="fa fa-compress" aria-hidden="true"></i>' : '<i class="fa fa-expand" aria-hidden="true"></i>';
        state.editor.refresh();
    }

    function init() {
        const page = document.querySelector('.file-manager-page');
        if (!page || page.dataset.initialized === 'true') return;
        page.dataset.initialized = 'true';

        $('fm-refresh').addEventListener('click', () => load(state.path));
        $('fm-up').addEventListener('click', () => {
            if (!state.path || state.path === state.homePath) return;
            const parent = state.path.split('/').slice(0, -1).join('/');
            load(parent || state.homePath);
        });
        $('fm-new-folder').addEventListener('click', createFolder);
        $('fm-new-file').addEventListener('click', createFile);
        $('fm-upload-files').addEventListener('click', () => $('fm-files-input').click());
        $('fm-upload-folder').addEventListener('click', () => $('fm-folder-input').click());
        $('fm-files-input').addEventListener('change', event => uploadFiles(event.target));
        $('fm-folder-input').addEventListener('change', event => uploadFiles(event.target));
        $('fm-search').addEventListener('click', searchFiles);
        $('fm-search-input').addEventListener('keydown', event => { if (event.key === 'Enter') searchFiles(); });
        $('fm-search-clear').addEventListener('click', () => { $('fm-search-input').value = ''; load(state.path); });
        $('fm-backups').addEventListener('click', openBackups);
        $('fm-upload-cancel').addEventListener('click', () => {
            if (state.uploadController) state.uploadController.abort();
        });
        $('fm-vault-open').addEventListener('click', openVaultDialog);
        $('fm-vault-save').addEventListener('click', saveVaultPassword);
        $('fm-vault-cancel').addEventListener('click', () => { $('fm-vault-dialog').hidden = true; });
        $('fm-vault-dialog').addEventListener('click', event => {
            if (event.target === $('fm-vault-dialog')) $('fm-vault-dialog').hidden = true;
        });
        $('fm-vault-confirm').addEventListener('keydown', event => { if (event.key === 'Enter') saveVaultPassword(); });
        $('fm-close-backups').addEventListener('click', () => { $('fm-backups-panel').hidden = true; });
        $('fm-access-open').addEventListener('click', openAccessPanel);
        $('fm-access-close').addEventListener('click', () => { $('fm-access-panel').hidden = true; });
        $('fm-user-search-button').addEventListener('click', searchUsers);
        $('fm-user-search').addEventListener('keydown', event => { if (event.key === 'Enter') searchUsers(); });
        $('fm-access-save').addEventListener('click', saveAccessList);

        $('fm-save').addEventListener('click', saveFile);
        $('fm-editor-close').addEventListener('click', closeEditor);
        $('fm-editor-discard').addEventListener('click', discardEditorChanges);
        $('fm-editor-wrap').addEventListener('click', toggleWrap);
        $('fm-editor-fullscreen').addEventListener('click', toggleFullScreen);
        $('fm-editor-find').addEventListener('click', () => { if (state.editor) state.editor.execCommand('findPersistent'); });
        $('fm-preview-edit').addEventListener('click', () => {
            if (!state.selectedItem) return;
            if (state.selectedItem.type === 'directory') load(state.selectedItem.path);
            else openFile(state.selectedItem.path);
        });
        $('fm-view-list').addEventListener('click', () => {
            state.viewMode = 'list';
            $('fm-view-list').classList.add('is-active');
            $('fm-view-grid').classList.remove('is-active');
            request('get', '/plugins/file-manager/list', { path: state.path }).then(result => renderFiles(result.entries || []))
                .catch(error => toast(error.message || 'טעינת התיקייה נכשלה', true));
        });
        $('fm-view-grid').addEventListener('click', () => {
            state.viewMode = 'grid';
            $('fm-view-grid').classList.add('is-active');
            $('fm-view-list').classList.remove('is-active');
            request('get', '/plugins/file-manager/list', { path: state.path }).then(result => renderFiles(result.entries || []))
                .catch(error => toast(error.message || 'טעינת התיקייה נכשלה', true));
        });
        document.querySelectorAll('.fm-nav-button').forEach(button => {
            button.addEventListener('click', () => load(button.dataset.path || state.homePath));
        });

        $('fm-dialog-cancel').addEventListener('click', () => finishValueDialog(null));
        $('fm-dialog-confirm').addEventListener('click', () => finishValueDialog($('fm-dialog-input').value));
        $('fm-dialog-input').addEventListener('keydown', event => {
            if (event.key === 'Enter') finishValueDialog($('fm-dialog-input').value);
            if (event.key === 'Escape') finishValueDialog(null);
        });
        $('fm-dialog').addEventListener('click', event => {
            if (event.target === $('fm-dialog')) finishValueDialog(null);
        });

        $('fm-password-cancel').addEventListener('click', () => finishPasswordDialog(null));
        $('fm-password-confirm').addEventListener('click', () => {
            const password = $('fm-password-input').value;
            if (!password) {
                $('fm-password-error').textContent = 'יש להזין סיסמה.';
                $('fm-password-error').hidden = false;
                return;
            }
            finishPasswordDialog(password);
        });
        $('fm-password-input').addEventListener('keydown', event => {
            if (event.key === 'Enter') $('fm-password-confirm').click();
            if (event.key === 'Escape') finishPasswordDialog(null);
        });
        $('fm-password-dialog').addEventListener('click', event => {
            if (event.target === $('fm-password-dialog')) finishPasswordDialog(null);
        });

        $('fm-confirm-cancel').addEventListener('click', () => finishConfirmation(false));
        $('fm-confirm-accept').addEventListener('click', () => finishConfirmation(true));
        $('fm-confirm-dialog').addEventListener('click', event => {
            if (event.target === $('fm-confirm-dialog')) finishConfirmation(false);
        });

        Promise.resolve()
            .then(loadPermissions)
            .then(loadSecurityStatus)
            .then(() => load(state.homePath))
            .catch(error => {
                toast(error.message || 'טעינת ההרשאות נכשלה', true);
            });
    }

    return { init };
});
