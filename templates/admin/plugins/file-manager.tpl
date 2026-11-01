<div class="file-manager-page" dir="rtl">
    <header class="fm-hero">
        <div class="fm-hero-icon"><i class="fa fa-folder-open" aria-hidden="true"></i></div>
        <div class="fm-hero-copy">
            <span class="fm-eyebrow">סביבת ניהול קבצים</span>
            <h1>מנהל הקבצים</h1>
            <p>גישה מאובטחת לקובצי NodeBB, עריכת קוד וניהול הרשאות.</p>
        </div>
        <div class="fm-hero-side">
            <span class="fm-security-label"><i class="fa fa-shield-alt" aria-hidden="true"></i> גישה מאומתת</span>
            <span class="fm-role-label" id="fm-role-label">בודק הרשאות…</span>
        </div>
    </header>

    <div class="fm-overview">
        <div class="fm-overview-card">
            <span class="fm-overview-label">נתיב נוכחי</span>
            <strong id="fm-current-path" class="fm-ltr" dir="ltr">/</strong>
        </div>
        <div class="fm-overview-card">
            <span class="fm-overview-label">פריטים בתיקייה</span>
            <strong id="fm-item-count">—</strong>
        </div>
        <div class="fm-overview-card">
            <span class="fm-overview-label">סביבת עבודה</span>
            <strong><i class="fa fa-server" aria-hidden="true"></i> תיקיית NodeBB בלבד</strong>
        </div>
    </div>

    <section class="fm-workspace">
        <div class="fm-section-heading">
            <div>
                <h2>קבצים ותיקיות</h2>
                <p>בחר קובץ לעריכה מיידית בחלונית הצמודה, ללא גלילה לתחתית העמוד.</p>
            </div>
            <div class="fm-heading-actions">
                <button class="fm-btn fm-btn-light" id="fm-refresh" type="button"><i class="fa fa-sync-alt" aria-hidden="true"></i> רענון</button>
                <button class="fm-btn fm-btn-outline" id="fm-access-open" type="button" hidden><i class="fa fa-user-shield" aria-hidden="true"></i> משתמשים מורשים</button>
            </div>
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

        <div class="fm-workspace-grid" id="fm-workspace-grid">
            <section class="fm-file-pane">
                <div class="fm-path-bar"><i class="fa fa-folder-open" aria-hidden="true"></i><span id="fm-breadcrumb" class="fm-ltr" dir="ltr">/</span></div>
                <div class="fm-list-heading">
                    <span>שם הפריט</span><span>סוג</span><span>גודל</span><span>פעולות</span>
                </div>
                <div id="fm-file-list" class="fm-file-list">
                    <div class="fm-empty"><i class="fa fa-folder-open" aria-hidden="true"></i><strong>טוען את הקבצים</strong><span>מתחבר לתיקיית NodeBB…</span></div>
                </div>
            </section>

            <section class="fm-editor-panel" id="fm-editor-panel" hidden>
                <div class="fm-editor-topbar">
                    <div class="fm-editor-file-icon"><i class="fa fa-file-code" aria-hidden="true"></i></div>
                    <div class="fm-editor-title-wrap">
                        <strong id="fm-editor-title">בחר קובץ לעריכה</strong>
                        <small id="fm-editor-path" class="fm-ltr" dir="ltr"></small>
                    </div>
                    <div class="fm-editor-actions">
                        <button class="fm-icon-btn" id="fm-editor-find" type="button" title="חיפוש בקובץ" aria-label="חיפוש בקובץ"><i class="fa fa-search" aria-hidden="true"></i></button>
                        <button class="fm-icon-btn" id="fm-editor-wrap" type="button" title="גלישת שורות" aria-label="גלישת שורות"><i class="fa fa-align-right" aria-hidden="true"></i></button>
                        <button class="fm-icon-btn" id="fm-editor-fullscreen" type="button" title="מסך מלא" aria-label="מסך מלא"><i class="fa fa-expand" aria-hidden="true"></i></button>
                        <button class="fm-icon-btn" id="fm-editor-close" type="button" title="סגירת העורך" aria-label="סגירת העורך"><i class="fa fa-times" aria-hidden="true"></i></button>
                    </div>
                </div>
                <div class="fm-editor-toolbar">
                    <span class="fm-editor-language" id="fm-editor-language">טוען עורך…</span>
                    <span class="fm-editor-hint">Ctrl + S לשמירה</span>
                </div>
                <div class="fm-editor-host" id="fm-editor-host">
                    <textarea id="fm-editor" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="תוכן קובץ לעריכה"></textarea>
                </div>
                <div class="fm-editor-footer">
                    <span id="fm-editor-status">מוכן לעריכה</span>
                    <span id="fm-editor-lines">0 שורות · שורה 1, עמודה 1</span>
                    <span>UTF-8 · עד 2MB</span>
                </div>
                <div class="fm-editor-savebar">
                    <span id="fm-editor-dirty">אין שינויים שלא נשמרו</span>
                    <div class="fm-editor-save-actions">
                        <button class="fm-btn fm-btn-light" id="fm-editor-discard" type="button">ביטול שינויים</button>
                        <button class="fm-btn fm-btn-primary" id="fm-save" type="button"><i class="fa fa-save" aria-hidden="true"></i> שמירת קובץ</button>
                    </div>
                </div>
            </section>
        </div>
    </section>

    <section class="fm-backups-panel" id="fm-backups-panel" hidden>
        <div class="fm-section-heading">
            <div><h2>גיבויים וסל מחזור</h2><p>גרסאות קודמות ופריטים שנמחקו באופן שניתן לשחזור.</p></div>
            <button class="fm-btn fm-btn-light" id="fm-close-backups" type="button">סגירה</button>
        </div>
        <div id="fm-backups-list"><div class="fm-empty">טוען גיבויים…</div></div>
    </section>

    <section class="fm-access-panel" id="fm-access-panel" hidden>
        <div class="fm-section-heading">
            <div><h2>ניהול משתמשים מורשים</h2><p>בחר משתמש קיים בפורום והענק לו הרשאת צפייה או עריכה.</p></div>
            <button class="fm-btn fm-btn-light" id="fm-access-close" type="button">סגירה</button>
        </div>
        <div class="fm-access-notice"><i class="fa fa-info-circle" aria-hidden="true"></i><span>מנהלי NodeBB מקבלים גישה מלאה אוטומטית. משתמשים מורשים חייבים להתחבר לחשבון הפורום שלהם ולהזין את סיסמת NodeBB לפני כל פעולה שמשנה קבצים.</span></div>
        <div class="fm-user-search-row">
            <div class="fm-search-box">
                <i class="fa fa-user-search" aria-hidden="true"></i>
                <input id="fm-user-search" type="search" placeholder="חיפוש משתמש לפי שם משתמש..." autocomplete="off">
            </div>
            <button class="fm-btn fm-btn-dark" id="fm-user-search-button" type="button">חיפוש משתמש</button>
        </div>
        <div id="fm-user-search-results" class="fm-user-search-results"></div>
        <div class="fm-access-list-heading"><h3>רשימת משתמשים מורשים</h3><span id="fm-access-count">0 משתמשים</span></div>
        <div id="fm-allowed-users" class="fm-allowed-users"><div class="fm-empty">טוען רשימת הרשאות…</div></div>
        <div class="fm-access-savebar">
            <span>השינויים ייכנסו לתוקף מיד לאחר השמירה.</span>
            <button class="fm-btn fm-btn-primary" id="fm-access-save" type="button"><i class="fa fa-save" aria-hidden="true"></i> שמירת הרשאות</button>
        </div>
    </section>

    <div id="fm-dialog" class="fm-modal-overlay" hidden>
        <div class="fm-modal" role="dialog" aria-modal="true" aria-labelledby="fm-dialog-title">
            <div class="fm-modal-icon"><i class="fa fa-pen" aria-hidden="true"></i></div>
            <h2 id="fm-dialog-title">פעולה</h2>
            <p id="fm-dialog-description"></p>
            <input id="fm-dialog-input" type="text" dir="auto" autocomplete="off">
            <div class="fm-modal-actions">
                <button class="fm-btn fm-btn-light" id="fm-dialog-cancel" type="button">ביטול</button>
                <button class="fm-btn fm-btn-primary" id="fm-dialog-confirm" type="button">אישור</button>
            </div>
        </div>
    </div>

    <div id="fm-password-dialog" class="fm-modal-overlay" hidden>
        <div class="fm-modal" role="dialog" aria-modal="true" aria-labelledby="fm-password-title">
            <div class="fm-modal-icon is-secure"><i class="fa fa-lock" aria-hidden="true"></i></div>
            <span class="fm-modal-eyebrow">אימות אבטחה של NodeBB</span>
            <h2 id="fm-password-title">נדרש אימות סיסמה</h2>
            <p id="fm-password-description">להמשך הפעולה, הזן את הסיסמה של חשבון הפורום שלך.</p>
            <label class="fm-password-label" for="fm-password-input">סיסמת חשבון NodeBB</label>
            <input id="fm-password-input" type="password" dir="ltr" autocomplete="current-password" placeholder="הקלד סיסמה">
            <div class="fm-modal-error" id="fm-password-error" hidden></div>
            <div class="fm-modal-actions">
                <button class="fm-btn fm-btn-light" id="fm-password-cancel" type="button">ביטול</button>
                <button class="fm-btn fm-btn-primary" id="fm-password-confirm" type="button"><i class="fa fa-shield-alt" aria-hidden="true"></i> אימות וביצוע</button>
            </div>
            <small class="fm-password-footnote">הסיסמה נבדקת ישירות מול NodeBB ואינה נשמרת בתוסף.</small>
        </div>
    </div>

    <div id="fm-confirm-dialog" class="fm-modal-overlay" hidden>
        <div class="fm-modal" role="dialog" aria-modal="true" aria-labelledby="fm-confirm-title">
            <div class="fm-modal-icon is-warning"><i class="fa fa-exclamation-triangle" aria-hidden="true"></i></div>
            <h2 id="fm-confirm-title">אישור פעולה</h2>
            <p id="fm-confirm-description"></p>
            <div class="fm-modal-actions">
                <button class="fm-btn fm-btn-light" id="fm-confirm-cancel" type="button">ביטול</button>
                <button class="fm-btn fm-btn-danger" id="fm-confirm-accept" type="button">אישור</button>
            </div>
        </div>
    </div>

    <div id="fm-message" class="fm-toast" role="status" aria-live="polite" hidden></div>
</div>
