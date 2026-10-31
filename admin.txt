'use strict';

define('admin/plugins/file-manager', ['api'], function (api) {
    const state = {
        currentPath: '',
        editingPath: null,
        originalContent: ''
    };

    function request(method, endpoint, data) {
        return new Promise((resolve, reject) => {
            const callback = (err, result) => {
                if (err) return reject(err);
                resolve(result && result.response ? result.response : result);
            };

            if (method === 'get') {
                api.get(endpoint, data || {}, callback);
            } else {
                api.post(endpoint, data || {}, callback);
            }
        });
    }

    function errorMessage(error, fallback) {
        return (error && (error.message || error.response && error.response.message)) || fallback;
    }

    function showMessage(message, isError = false) {
        const box = document.getElementById('fm-message');
        box.textContent = message;
        box.hidden = false;
        box.classList.toggle('error', isError);

        window.clearTimeout(showMessage.timer);
        showMessage.timer = window.setTimeout(() => {
            box.hidden = true;
        }, 5000);
    }

    function formatSize(bytes) {
        if (bytes === null || bytes === undefined) return '-';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function createButton(label, className, action) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.textContent = label;
        button.addEventListener('click', action);
        return button;
    }

    async function loadDirectory(path) {
        const list = document.getElementById('fm-file-list');
        list.textContent = 'טוען קבצים...';

        try {
            const result = await request('get', '/plugins/file-manager/list', { path });
            state.currentPath = result.currentPath || '';
            document.getElementById('fm-current-path').textContent = '/' + state.currentPath;
            list.replaceChildren();

            if (!result.entries || !result.entries.length) {
                const empty = document.createElement('div');
                empty.className = 'fm-empty';
                empty.textContent = 'התיקייה ריקה';
                list.appendChild(empty);
                return;
            }

            result.entries.forEach(entry => {
                const row = document.createElement('div');
                row.className = 'fm-file-row';

                const name = document.createElement('div');
                name.className = 'fm-file-name';

                const icon = document.createElement('i');
                icon.className = entry.type === 'directory'
                    ? 'fa fa-folder'
                    : entry.type === 'symlink'
                        ? 'fa fa-link'
                        : 'fa fa-file-code';

                const nameText = document.createElement('span');
                nameText.textContent = entry.name;
                name.append(icon, nameText);

                if (entry.type === 'directory') {
                    name.classList.add('is-directory');
                    name.addEventListener('click', () => loadDirectory(entry.path));
                }

                const type = document.createElement('span');
                type.textContent = entry.type === 'directory' ? 'תיקייה'
                    : entry.type === 'symlink' ? 'קישור סמלי'
                        : entry.type === 'file' ? 'קובץ' : 'אחר';

                const size = document.createElement('span');
                size.textContent = formatSize(entry.size);

                const actions = document.createElement('div');
                actions.className = 'fm-actions';

                if (entry.type === 'file') {
                    actions.appendChild(createButton('עריכה', 'btn btn-xs btn-primary', () => openFile(entry.path)));
                }

                if (entry.type !== 'symlink' && entry.type !== 'other') {
                    actions.appendChild(createButton('שינוי שם', 'btn btn-xs btn-default', () => renameEntry(entry)));
                    actions.appendChild(createButton('מחיקה', 'btn btn-xs btn-danger', () => deleteEntry(entry)));
                }

                row.append(name, type, size, actions);
                list.appendChild(row);
            });
        } catch (error) {
            list.textContent = 'שגיאה בטעינת התיקייה';
            showMessage(errorMessage(error, 'לא ניתן לטעון את התיקייה'), true);
        }
    }

    async function openFile(path) {
        try {
            const result = await request('get', '/plugins/file-manager/read', { path });
            state.editingPath = result.path;
            state.originalContent = result.content;

            document.getElementById('fm-editor-title').textContent = path.split('/').pop();
            document.getElementById('fm-editor-path').textContent = path;
            document.getElementById('fm-editor').value = result.content;
            document.getElementById('fm-editor-status').textContent = 'הקובץ נטען';
            document.getElementById('fm-editor-panel').hidden = false;
            document.getElementById('fm-editor').focus();
        } catch (error) {
            showMessage(errorMessage(error, 'לא ניתן לפתוח את הקובץ'), true);
        }
    }

    async function saveFile() {
        if (!state.editingPath) return;

        const content = document.getElementById('fm-editor').value;
        if (content === state.originalContent) {
            showMessage('לא בוצעו שינויים בקובץ');
            return;
        }

        if (!window.confirm('לשמור את השינויים בקובץ? תיווצר תחילה גרסת גיבוי.')) return;

        try {
            const result = await request('post', '/plugins/file-manager/write', {
                path: state.editingPath,
                content
            });

            state.originalContent = content;
            document.getElementById('fm-editor-status').textContent = 'נשמר בהצלחה';
            showMessage(result.backup
                ? 'הקובץ נשמר. נוצר גיבוי: ' + result.backup
                : 'הקובץ נשמר בהצלחה');
            loadDirectory(state.currentPath);
        } catch (error) {
            showMessage(errorMessage(error, 'שמירת הקובץ נכשלה'), true);
        }
    }

    async function createFolder() {
        const name = window.prompt('מה יהיה שם התיקייה החדשה?');
        if (!name) return;

        const path = state.currentPath ? state.currentPath + '/' + name : name;

        try {
            await request('post', '/plugins/file-manager/mkdir', { path });
            showMessage('התיקייה נוצרה בהצלחה');
            loadDirectory(state.currentPath);
        } catch (error) {
            showMessage(errorMessage(error, 'יצירת התיקייה נכשלה'), true);
        }
    }

    async function renameEntry(entry) {
        const newName = window.prompt('הזן שם חדש:', entry.name);
        if (!newName || newName === entry.name) return;

        try {
            await request('post', '/plugins/file-manager/rename', {
                path: entry.path,
                newName
            });
            showMessage('השם שונה בהצלחה');
            loadDirectory(state.currentPath);
        } catch (error) {
            showMessage(errorMessage(error, 'שינוי השם נכשל'), true);
        }
    }

    async function deleteEntry(entry) {
        const confirmed = window.confirm(
            'למחוק את "' + entry.name + '"?\n\nהמחיקה עלולה להיות בלתי הפיכה.'
        );
        if (!confirmed) return;

        try {
            await request('post', '/plugins/file-manager/delete', { path: entry.path });
            showMessage('הפריט נמחק');
            loadDirectory(state.currentPath);
        } catch (error) {
            showMessage(errorMessage(error, 'המחיקה נכשלה'), true);
        }
    }

    function closeEditor() {
        const editor = document.getElementById('fm-editor');
        if (editor.value !== state.originalContent &&
            !window.confirm('יש שינויים שלא נשמרו. לסגור בכל זאת?')) {
            return;
        }

        state.editingPath = null;
        state.originalContent = '';
        document.getElementById('fm-editor-panel').hidden = true;
    }

    function init() {
        const page = document.querySelector('.file-manager-page');
        if (!page || page.dataset.initialized === 'true') return;
        page.dataset.initialized = 'true';

        document.getElementById('fm-refresh').addEventListener('click', () => loadDirectory(state.currentPath));
        document.getElementById('fm-up').addEventListener('click', () => {
            if (!state.currentPath) return;
            const parts = state.currentPath.split('/');
            parts.pop();
            loadDirectory(parts.join('/'));
        });
        document.getElementById('fm-new-folder').addEventListener('click', createFolder);
        document.getElementById('fm-save').addEventListener('click', saveFile);
        document.getElementById('fm-close-editor').addEventListener('click', closeEditor);

        loadDirectory('');
    }

    return { init };
});
