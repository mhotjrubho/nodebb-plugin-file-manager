<div class="file-manager-page">
    <div class="file-manager-header">
        <div>
            <h1>מנהל הקבצים</h1>
            <p>ניהול קובצי מערכת הפורום מתוך לוח הבקרה</p>
        </div>
    </div>

    <div class="file-manager-toolbar">
        <button class="btn btn-default" id="fm-up" type="button">
            <i class="fa fa-arrow-up"></i> תיקייה קודמת
        </button>
        <button class="btn btn-primary" id="fm-new-folder" type="button">
            <i class="fa fa-folder-plus"></i> תיקייה חדשה
        </button>
        <button class="btn btn-default" id="fm-refresh" type="button">
            <i class="fa fa-refresh"></i> רענון
        </button>
    </div>

    <div class="file-manager-path">
        <i class="fa fa-folder-open"></i>
        <span id="fm-current-path">/</span>
    </div>

    <div class="file-manager-list">
        <div class="fm-list-heading">
            <span>שם</span>
            <span>סוג</span>
            <span>גודל</span>
            <span>פעולות</span>
        </div>
        <div id="fm-file-list">
            <div class="fm-empty">טוען קבצים...</div>
        </div>
    </div>

    <section class="file-manager-editor" id="fm-editor-panel" hidden>
        <div class="fm-editor-header">
            <div>
                <strong id="fm-editor-title">עריכת קובץ</strong>
                <small id="fm-editor-path"></small>
            </div>
            <div class="fm-editor-actions">
                <button class="btn btn-primary" id="fm-save" type="button">שמירת שינויים</button>
                <button class="btn btn-default" id="fm-close-editor" type="button">סגירה</button>
            </div>
        </div>
        <textarea id="fm-editor" spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
        <div class="fm-editor-footer">
            <span id="fm-editor-status">מוכן</span>
            <span>מגבלת עריכה: 2MB</span>
        </div>
    </section>

    <div id="fm-message" class="fm-message" role="status" hidden></div>
</div>
