'use strict';

define('admin/plugins/file-manager', ['api'], function (api) {
    const state = { path: '', editing: null, original: '', dialogResolve: null, toastTimer: null };

    const $ = id => document.getElementById(id);
    const fa = name => {
        const node = document.createElement('i');
        node.className = 'fa ' + name;
        node.setAttribute('aria-hidden', 'true');
        return node;
    };

    function request(method, route, data) {
        return new Promise((resolve, reject) => {
            const callback = (error, response) => {
                if (error) return reject(error);
                resolve(response && response.response ? response.response : response);
            };
            if (method === 'get') api.get(route, data || {}, callback);
            else api.post(route, data || {}, {}, callback);
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

    function button(text, iconName, handler, danger) {
        const node = document.createElement('button');
        node.type = 'button';
        node.className = 'fm-action-btn' + (danger ? ' is-danger' : '');
        if (iconName) node.appendChild(fa(iconName));
        node.appendChild(document.createTextNode(text));
        node.addEventListener('click', handler);
        return node;
    }

    function ask(title, detail, value, placeholder, confirmText) {
        if (state.dialogResolve) state.dialogResolve(null);
        return new Promise(resolve => {
            state.dialogResolve = resolve;
            $('fm-dialog-title').textContent = title;
            $('fm-dialog-description').textContent = detail || '';
            $('fm-dialog-input').value = value || '';
            $('fm-dialog-input').placeholder = placeholder || '';
            $('fm-dialog-confirm').textContent = confirmText || 'אישור';
            $('fm-dialog').hidden = false;
            $('fm-dialog-input').focus();
            $('fm-dialog-input').select();
        });
    }

    function finishDialog(value) {
        const resolve = state.dialogResolve;
        state.dialogResolve = null;
        $('fm-dialog').hidden = true;
        if (resolve) resolve(value);
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

    async function load(folder) {
        state.path = folder || '';
        const pathText = '/' + state.path;
        $('fm-current-path').textContent = pathText;
        $('fm-breadcrumb').textContent = pathText;
        $('fm-up').disabled = !state.path;
        $('fm-item-count').textContent = '…';
        const list = $('fm-file-list');
        list.replaceChildren();
        const loading = document.createElement('div');
        loading.className = 'fm-empty';
        loading.append(fa('fa-circle-notch fa-spin'));
        const bold = document.createElement('strong');
        bold.textContent = 'טוען קבצים';
        const hint = document.createElement('span');
        hint.textContent = 'קורא את תוכן התיקייה';
        loading.append(bold, hint);
        list.appendChild(loading);

        try {
            const result = await request('get', '/plugins/file-manager/list', { path: state.path });
            render(result.entries || []);
        } catch (error) {
            list.replaceChildren();
            const failed = document.createElement('div');
            failed.className = 'fm-empty';
            failed.append(fa('fa-exclamation-triangle'));
            const bold = document.createElement('strong');
            bold.textContent = 'טעינת התיקייה נכשלה';
            failed.appendChild(bold);
            list.appendChild(failed);
            $('fm-item-count').textContent = '—';
            toast(error.message || 'שגיאה בטעינת הקבצים', true);
        }
    }

    function render(entries) {
        const list = $('fm-file-list');
        list.replaceChildren();
        $('fm-item-count').textContent = String(entries.length);

        if (!entries.length) {
            const empty = document.createElement('div');
            empty.className = 'fm-empty';
            empty.append(fa('fa-folder-open'));
            const bold = document.createElement('strong');
            bold.textContent = 'התיקייה ריקה';
            const hint = document.createElement('span');
            hint.textContent = 'אפשר להעלות קבצים או ליצור פריט חדש';
            empty.append(bold, hint);
            list.appendChild(empty);
            return;
        }

        entries.forEach(item => {
            const row = document.createElement('div');
            row.className = 'fm-file-row';

            const fileName = document.createElement('div');
            fileName.className = 'fm-file-name' + (item.type === 'directory' ? ' is-directory' : '');
            const fileIcon = document.createElement('span');
            fileIcon.className = 'fm-file-icon' + (item.type === 'directory' ? ' is-folder' : '');
            fileIcon.appendChild(fa(item.type === 'directory' ? 'fa-folder' : item.type === 'symlink' ? 'fa-link' : 'fa-file-alt'));
            const label = document.createElement('span');
            label.textContent = item.name;
            fileName.append(fileIcon, label);
            if (item.type === 'directory') fileName.addEventListener('click', () => load(item.path));

            const type = document.createElement('span');
            type.className = 'fm-file-type' + (item.type === 'directory' ? ' is-folder' : '');
            type.textContent = item.type === 'directory' ? 'תיקייה' : item.type === 'symlink' ? 'קישור' : 'קובץ';

            const size = document.createElement('span');
            size.className = 'fm-file-meta';
            size.textContent = formatSize(item.size);

            const modified = document.createElement('span');
            modified.className = 'fm-file-meta';
            modified.textContent = formatDate(item.modified);

            const actions = document.createElement('div');
            actions.className = 'fm-file-actions';
            if (item.type === 'file') {
                actions.appendChild(button('עריכה', 'fa-edit', () => openFile(item.path)));
                if (/\.zip$/i.test(item.name)) actions.appendChild(button('חילוץ', 'fa-file-archive', () => extract(item.path)));
            }
            if (item.type === 'file' || item.type === 'directory') {
                actions.appendChild(button('העתקה', 'fa-copy', () => copyMove(item, false)));
                actions.appendChild(button('העברה', 'fa-exchange-alt', () => copyMove(item, true)));
                actions.appendChild(button('שם', 'fa-pen', () => rename(item)));
                actions.appendChild(button('מחיקה', 'fa-trash-alt', () => remove(item), true));
            }
            row.append(fileName, type, size, modified, actions);
            list.appendChild(row);
        });
    }

    async function openFile(folder) {
        try {
            const result = await request('get', '/plugins/file-manager/read', { path: folder });
            state.editing = result.path;
            state.original = result.content;
            $('fm-editor-title').textContent = folder.split('/').pop();
            $('fm-editor-path').textContent = folder;
            $('fm-editor').value = result.content;
            $('fm-editor-status').textContent = formatSize(new Blob([result.content]).size) + ' · UTF-8';
            $('fm-editor-panel').hidden = false;
            $('fm-editor-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (error) {
            toast(error.message || 'לא ניתן לפתוח את הקובץ', true);
        }
    }

    async function save() {
        if (!state.editing) return;
        const content = $('fm-editor').value;
        if (content === state.original) return toast('לא בוצעו שינויים');
        if (new Blob([content]).size > 2 * 1024 * 1024) return toast('הקובץ חורג ממגבלת העריכה של 2MB', true);
        if (!confirm('לשמור את השינויים? לפני הדריסה ייווצר גיבוי אוטומטי.')) return;
        $('fm-save').disabled = true;
        try {
            const result = await request('post', '/plugins/file-manager/write', { path: state.editing, content });
            state.original = content;
            $('fm-editor-status').textContent = 'נשמר בהצלחה · ' + new Date().toLocaleTimeString('he-IL');
            toast(result.backup ? 'הקובץ נשמר ונוצר גיבוי: ' + result.backup : 'הקובץ נשמר בהצלחה');
        } catch (error) {
            toast(error.message || 'שמירת הקובץ נכשלה', true);
        } finally {
            $('fm-save').disabled = false;
        }
    }

    async function createFolder() {
        const value = await ask('יצירת תיקייה', 'הקלד שם לתיקייה החדשה.', '', 'שם התיקייה', 'יצירת תיקייה');
        if (!value || !value.trim()) return;
        try {
            await request('post', '/plugins/file-manager/mkdir', { path: (state.path ? state.path + '/' : '') + value.trim() });
            toast('התיקייה נוצרה בהצלחה');
            await load(state.path);
        } catch (error) { toast(error.message || 'יצירת התיקייה נכשלה', true); }
    }

    async function createFile() {
        const value = await ask('יצירת קובץ', 'הקלד שם כולל סיומת, למשל config.json.', '', 'filename.ext', 'יצירת קובץ');
        if (!value || !value.trim()) return;
        const folder = (state.path ? state.path + '/' : '') + value.trim();
        try {
            await request('post', '/plugins/file-manager/write', { path: folder, content: '' });
            toast('הקובץ נוצר בהצלחה');
            await load(state.path);
            await openFile(folder);
        } catch (error) { toast(error.message || 'יצירת הקובץ נכשלה', true); }
    }

    async function rename(item) {
        const value = await ask('שינוי שם', 'הקלד את השם החדש של הפריט.', item.name, 'שם חדש', 'שמירת השם');
        if (!value || !value.trim() || value.trim() === item.name) return;
        try {
            await request('post', '/plugins/file-manager/rename', { path: item.path, newName: value.trim() });
            toast('שם הפריט עודכן');
            await load(state.path);
        } catch (error) { toast(error.message || 'שינוי השם נכשל', true); }
    }

    async function remove(item) {
        if (!confirm('להעביר את "' + item.name + '" לסל המחזור? ניתן לשחזר אותו דרך גיבויים וסל מחזור.')) return;
        try {
            const result = await request('post', '/plugins/file-manager/delete', { path: item.path });
            toast('הפריט הועבר לסל המחזור. מזהה: ' + result.id);
            await load(state.path);
        } catch (error) { toast(error.message || 'העברת הפריט נכשלה', true); }
    }

    async function copyMove(item, move) {
        const suggestion = move ? '' : (state.path ? state.path + '/' : '') + item.name + '-copy';
        const value = await ask(move ? 'העברת פריט' : 'העתקת פריט', 'הזן נתיב יעד יחסי לתיקיית NodeBB.', suggestion, 'למשל public/uploads/example', move ? 'העברה' : 'העתקה');
        if (!value || !value.trim()) return;
        try {
            await request('post', '/plugins/file-manager/' + (move ? 'move' : 'copy'), { path: item.path, destination: value.trim() });
            toast(move ? 'הפריט הועבר' : 'הפריט הועתק');
            await load(state.path);
        } catch (error) { toast(error.message || 'הפעולה נכשלה', true); }
    }

    async function search() {
        const query = $('fm-search-input').value.trim();
        if (query.length < 2) return toast('יש להזין לפחות שני תווים לחיפוש', true);
        try {
            const result = await request('get', '/plugins/file-manager/search', { q: query, path: state.path });
            render((result.results || []).map(item => ({ ...item, name: item.path })));
            toast(result.truncated ? 'הוצגו תוצאות חלקיות. צמצם את החיפוש.' : 'נמצאו ' + result.results.length + ' תוצאות');
        } catch (error) { toast(error.message || 'החיפוש נכשל', true); }
    }

    async function upload(input) {
        const files = Array.from(input.files || []);
        if (!files.length) return;
        let count = 0;
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
                const result = await request('post', '/plugins/file-manager/upload', form);
                count += result.count || batch.length;
                toast('הועלו ' + count + ' מתוך ' + files.length + ' קבצים');
            }
            toast('ההעלאה הושלמה: ' + count + ' קבצים');
            await load(state.path);
        } catch (error) {
            toast('ההעלאה נעצרה לאחר ' + count + ' קבצים: ' + (error.message || 'שגיאה'), true);
            await load(state.path);
        } finally { input.value = ''; }
    }

    async function extract(folder) {
        if (!confirm('לחלץ את קובץ ה-ZIP לתיקייה הנוכחית? קבצים קיימים לא יידרסו.')) return;
        try {
            const result = await request('post', '/plugins/file-manager/extract', { path: folder, destination: state.path });
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
        loading.textContent = 'טוען גיבויים וסל מחזור...';
        list.appendChild(loading);
        $('fm-backups-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
            name.textContent = item.path;
            const kind = document.createElement('span');
            kind.className = 'fm-backup-kind';
            kind.textContent = item.kind === 'trash' ? (item.isDirectory ? 'תיקייה שנמחקה' : 'סל מחזור') : 'גיבוי גרסה';
            const created = document.createElement('span');
            created.className = 'fm-backup-date';
            created.textContent = formatDate(item.createdAt);
            const actions = document.createElement('div');
            actions.className = 'fm-backup-actions';
            actions.appendChild(button('שחזור', 'fa-undo', () => restore(item)));
            if (item.kind === 'trash') actions.appendChild(button('מחיקה לצמיתות', 'fa-trash-alt', () => purge(item), true));
            row.append(name, kind, created, actions);
            list.appendChild(row);
        });
    }

    async function restore(item) {
        if (!confirm('לשחזר את הפריט? אם כבר קיים פריט באותו נתיב, השחזור לא ידרוס אותו.\n\n' + item.path)) return;
        try {
            await request('post', '/plugins/file-manager/restore', { id: item.id });
            toast('השחזור הושלם בהצלחה');
            await openBackups();
            await load(state.path);
        } catch (error) { toast(error.message || 'השחזור נכשל', true); }
    }

    async function purge(item) {
        if (!confirm('למחוק לצמיתות את הפריט ואת כל תוכנו? פעולה זו אינה ניתנת לשחזור.\n\n' + item.path)) return;
        try {
            await request('post', '/plugins/file-manager/purge', { id: item.id });
            toast('הפריט נמחק לצמיתות');
            await openBackups();
        } catch (error) { toast(error.message || 'המחיקה לצמיתות נכשלה', true); }
    }

    function closeEditor() {
        if ($('fm-editor').value !== state.original && !confirm('יש שינויים שלא נשמרו. לסגור את העורך?')) return;
        $('fm-editor-panel').hidden = true;
        state.editing = null;
        state.original = '';
    }

    function init() {
        const page = document.querySelector('.file-manager-page');
        if (!page || page.dataset.initialized === 'true') return;
        page.dataset.initialized = 'true';

        $('fm-refresh').addEventListener('click', () => load(state.path));
        $('fm-up').addEventListener('click', () => load(state.path.split('/').slice(0, -1).join('/')));
        $('fm-new-folder').addEventListener('click', createFolder);
        $('fm-new-file').addEventListener('click', createFile);
        $('fm-save').addEventListener('click', save);
        $('fm-close-editor').addEventListener('click', closeEditor);
        $('fm-upload-files').addEventListener('click', () => $('fm-files-input').click());
        $('fm-upload-folder').addEventListener('click', () => $('fm-folder-input').click());
        $('fm-files-input').addEventListener('change', event => upload(event.target));
        $('fm-folder-input').addEventListener('change', event => upload(event.target));
        $('fm-search').addEventListener('click', search);
        $('fm-search-input').addEventListener('keydown', event => { if (event.key === 'Enter') search(); });
        $('fm-search-clear').addEventListener('click', () => { $('fm-search-input').value = ''; load(state.path); });
        $('fm-backups').addEventListener('click', openBackups);
        $('fm-close-backups').addEventListener('click', () => { $('fm-backups-panel').hidden = true; });
        $('fm-dialog-cancel').addEventListener('click', () => finishDialog(null));
        $('fm-dialog-confirm').addEventListener('click', () => finishDialog($('fm-dialog-input').value));
        $('fm-dialog-input').addEventListener('keydown', event => {
            if (event.key === 'Enter') finishDialog($('fm-dialog-input').value);
            if (event.key === 'Escape') finishDialog(null);
        });
        $('fm-dialog').addEventListener('click', event => {
            if (event.target === $('fm-dialog')) finishDialog(null);
        });
        load('');
    }

    return { init };
});
