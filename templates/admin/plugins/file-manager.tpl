<div class="file-manager-page">
    <header class="fm-hero">
        <div class="fm-hero-icon"><i class="fa fa-folder-open" aria-hidden="true"></i></div>
        <div class="fm-hero-copy">
            <span class="fm-eyebrow">כלי ניהול מערכת</span>
            <h1>מנהל הקבצים</h1>
            <p>ניהול קובצי NodeBB, עריכה, גיבויים והעברת קבצים ממקום אחד.</p>
        </div>
        <div class="fm-security-label"><i class="fa fa-shield-alt" aria-hidden="true"></i><span>גישה למנהלי הפורום בלבד</span></div>
    </header>

    <div class="fm-overview">
        <div class="fm-overview-card">
            <span class="fm-overview-label">מיקום נוכחי</span>
            <strong id="fm-current-path" dir="ltr">/</strong>
        </div>
        <div class="fm-overview-card">
            <span class="fm-overview-label">פריטים בתיקייה</span>
            <strong id="fm-item-count">—</strong>
        </div>
        <div class="fm-overview-card">
            <span class="fm-overview-label">תחום גישה</span>
            <strong><i class="fa fa-server" aria-hidden="true"></i> תיקיית NodeBB בלבד</strong>
        </div>
    </div>

    <section class="fm-workspace">
        <div class="fm-section-heading">
            <div><h2>קבצים ותיקיות</h2><p>בחר תיקייה כדי להיכנס אליה, או פתח קובץ לעריכה.</p></div>
            <button class="fm-btn fm-btn-light" id="fm-refresh" type="button"><i class="fa fa-sync-alt" aria-hidden="true"></i> רענון</button>
        </div>

        <div class="fm-toolbar">
            <div class="fm-toolbar-main">
                <button class="fm-btn fm-btn-light" id="fm-up" type="button"><i class="fa fa-level-up-alt" aria-hidden="true"></i> תיקייה קודמת</button>
                <button class="fm-btn fm-btn-primary" id="fm-new-folder" type="button"><i class="fa fa-folder-plus" aria-hidden="true"></i> תיקייה חדשה</button>
                <button class="fm-btn fm-btn-light" id="fm-new-file" type="button"><i class="fa fa-file" aria-hidden="true"></i> קובץ חדש</button>
                <button class="fm-btn fm-btn-light" id="fm-upload-files" type="button"><i class="fa fa-cloud-upload-alt" aria-hidden="true"></i> העלאת קבצים</button>
                <button class="fm-btn fm-btn-light" id="fm-upload-folder" type="button"><i class="fa fa-folder-open" aria-hidden="true"></i> העלאת תיקייה</button>
                <button class="fm-btn fm-btn-outline" id="fm-backups" type="button"><i class="fa fa-history" aria-hidden="true"></i> גיבויים וסל מחזור</button>
            </div>
            <input id="fm-files-input" type="file" multiple hidden>
            <input id="fm-folder-input" type="file" webkitdirectory directory multiple hidden>
        </div>

        <div class="fm-search-row">
            <div class="fm-search-box">
                <i class="fa fa-search" aria-hidden="true"></i>
                <input id="fm-search-input" type="search" placeholder="חיפוש קובץ או תיקייה לפי שם..." autocomplete="off">
                <button id="fm-search-clear" type="button" title="ניקוי חיפוש" aria-label="ניקוי חיפוש"><i class="fa fa-times" aria-hidden="true"></i></button>
            </div>
            <button class="fm-btn fm-btn-dark" id="fm-search" type="button">חיפוש</button>
        </div>

        <div class="fm-file-browser">
            <div class="fm-path-bar"><i class="fa fa-folder-open" aria-hidden="true"></i><span id="fm-breadcrumb" dir="ltr">/</span></div>
            <div class="fm-list-heading"><span>שם הפריט</span><span>סוג</span><span>גודל</span><span>עודכן</span><span>פעולות</span></div>
            <div id="fm-file-list"><div class="fm-empty"><i class="fa fa-folder-open" aria-hidden="true"></i><strong>טוען את הקבצים</strong><span>מתחבר לתיקיית NodeBB...</span></div></div>
        </div>
    </section>

    <section class="fm-backups-panel" id="fm-backups-panel" hidden>
        <div class="fm-section-heading">
            <div><h2>גיבויים וסל מחזור</h2><p>קבצים שנשמרו לפני דריסה ופריטים שהועברו לסל המחזור.</p></div>
            <button class="fm-btn fm-btn-light" id="fm-close-backups" type="button">סגירה</button>
        </div>
        <div id="fm-backups-list"><div class="fm-empty">טוען גיבויים...</div></div>
    </section>

    <section class="fm-editor-panel" id="fm-editor-panel" hidden>
        <div class="fm-editor-topbar">
            <div class="fm-editor-file-icon"><i class="fa fa-file-code" aria-hidden="true"></i></div>
            <div class="fm-editor-title-wrap"><strong id="fm-editor-title">עריכת קובץ</strong><small id="fm-editor-path" dir="ltr"></small></div>
            <div class="fm-editor-actions">
                <button class="fm-btn fm-btn-primary" id="fm-save" type="button"><i class="fa fa-save" aria-hidden="true"></i> שמירת שינויים</button>
                <button class="fm-btn fm-btn-light" id="fm-close-editor" type="button">סגירה</button>
            </div>
        </div>
        <textarea id="fm-editor" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="תוכן הקובץ"></textarea>
        <div class="fm-editor-footer"><span id="fm-editor-status">מוכן לעריכה</span><span>עריכת טקסט עד 2MB · גיבוי אוטומטי לפני שמירה</span></div>
    </section>

    <div id="fm-dialog" class="fm-dialog-overlay" hidden>
        <div class="fm-dialog" role="dialog" aria-modal="true" aria-labelledby="fm-dialog-title">
            <div class="fm-dialog-icon"><i class="fa fa-pen" aria-hidden="true"></i></div>
            <h2 id="fm-dialog-title">פעולה</h2>
            <p id="fm-dialog-description"></p>
            <input id="fm-dialog-input" type="text" autocomplete="off">
            <div class="fm-dialog-actions">
                <button class="fm-btn fm-btn-light" id="fm-dialog-cancel" type="button">ביטול</button>
                <button class="fm-btn fm-btn-primary" id="fm-dialog-confirm" type="button">אישור</button>
            </div>
        </div>
    </div>

    <div id="fm-message" class="fm-toast" role="status" aria-live="polite" hidden></div>
</div>
