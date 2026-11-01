<div class="file-manager-page" dir="rtl" lang="he">
    <header class="fm-topbar">
        <div class="fm-brand">
            <span class="fm-brand-icon"><i class="fa fa-folder-open" aria-hidden="true"></i></span>
            <div class="fm-brand-copy">
                <h1>מנהל הקבצים</h1>
                <p>סביבת ניהול קבצים מאובטחת של NodeBB</p>
            </div>
        </div>
        <div class="fm-topbar-actions">
            <span id="fm-vault-status" class="fm-vault-status is-warning">בודק מצב אבטחה…</span>
            <button class="fm-btn fm-btn-light" id="fm-vault-open" type="button"><i class="fa fa-key" aria-hidden="true"></i> הגדרת סיסמה</button>
            <button class="fm-btn fm-btn-light" id="fm-access-open" type="button" hidden><i class="fa fa-users" aria-hidden="true"></i> משתמשים מורשים</button>
            <span class="fm-role-label" id="fm-role-label">בודק הרשאות…</span>
        </div>
    </header>

    <main class="fm-explorer-window">
        <section class="fm-ribbon">
            <div class="fm-ribbon-actions">
                <div class="fm-command-group">
                    <button class="fm-command" id="fm-new-folder" type="button" title="תיקייה חדשה"><i class="fa fa-folder-plus" aria-hidden="true"></i><span>תיקייה חדשה</span></button>
                    <button class="fm-command" id="fm-new-file" type="button" title="קובץ חדש"><i class="fa fa-file-alt" aria-hidden="true"></i><span>קובץ חדש</span></button>
                </div>
                <span class="fm-ribbon-separator"></span>
                <div class="fm-command-group">
                    <button class="fm-command" id="fm-upload-files" type="button" title="העלאת קבצים"><i class="fa fa-cloud-upload-alt" aria-hidden="true"></i><span>העלאת קבצים</span></button>
                    <button class="fm-command" id="fm-upload-folder" type="button" title="העלאת תיקייה"><i class="fa fa-folder-open" aria-hidden="true"></i><span>העלאת תיקייה</span></button>
                </div>
                <span class="fm-ribbon-separator"></span>
                <div class="fm-command-group">
                    <button class="fm-command" id="fm-backups" type="button" title="גיבויים וסל מחזור"><i class="fa fa-history" aria-hidden="true"></i><span>גיבויים וסל מחזור</span></button>
                    <button class="fm-command" id="fm-refresh" type="button" title="רענון"><i class="fa fa-sync-alt" aria-hidden="true"></i><span>רענון</span></button>
                </div>
            </div>
            <div class="fm-toolbar-lower">
                <div class="fm-address-bar">
                    <button class="fm-address-up" id="fm-up" type="button" title="תיקייה קודמת" aria-label="תיקייה קודמת"><i class="fa fa-arrow-up" aria-hidden="true"></i></button>
                    <span class="fm-address-icon"><i class="fa fa-folder" aria-hidden="true"></i></span>
                    <span class="fm-address-label">נתיב:</span>
                    <span id="fm-breadcrumb" class="fm-ltr" dir="ltr">/</span>
                    <span class="fm-address-count" id="fm-item-count">— פריטים</span>
                </div>
                <div class="fm-search-box fm-explorer-search">
                    <i class="fa fa-search" aria-hidden="true"></i>
                    <input id="fm-search-input" type="search" placeholder="חיפוש בתיקייה ובתיקיות המשנה" autocomplete="off">
                    <button id="fm-search-clear" type="button" title="ניקוי חיפוש" aria-label="ניקוי חיפוש"><i class="fa fa-times" aria-hidden="true"></i></button>
                    <button class="fm-search-submit" id="fm-search" type="button">חיפוש</button>
                </div>
            </div>
            <div class="fm-upload-progress" id="fm-upload-progress-wrap" hidden>
                <div class="fm-upload-progress-top">
                    <span id="fm-upload-progress-label">מעלה קבצים…</span>
                    <button class="fm-btn fm-btn-danger fm-upload-cancel" id="fm-upload-cancel" type="button" disabled><i class="fa fa-ban" aria-hidden="true"></i> ביטול העלאה</button>
                </div>
                <progress id="fm-upload-progress" max="100" value="0"></progress>
            </div>
            <input id="fm-files-input" type="file" multiple hidden>
            <input id="fm-folder-input" type="file" webkitdirectory directory multiple hidden>
        </section>

        <div class="fm-workspace-grid" id="fm-workspace-grid">
            <aside class="fm-navigation">
                <div class="fm-nav-section">
                    <div class="fm-nav-heading"><i class="fa fa-star" aria-hidden="true"></i> גישה מהירה</div>
                    <button class="fm-nav-button is-active" type="button" data-path=""><i class="fa fa-home" aria-hidden="true"></i><span>תיקיית NodeBB</span></button>
                    <button class="fm-nav-button" type="button" data-path="public"><i class="fa fa-globe" aria-hidden="true"></i><span>קבצים ציבוריים</span></button>
                    <button class="fm-nav-button" type="button" data-path="public/uploads"><i class="fa fa-cloud-upload-alt" aria-hidden="true"></i><span>העלאות</span></button>
                </div>
                <div class="fm-nav-section" data-admin-only>
                    <div class="fm-nav-heading"><i class="fa fa-server" aria-hidden="true"></i> תיקיות מערכת</div>
                    <button class="fm-nav-button" type="button" data-path="src"><i class="fa fa-code" aria-hidden="true"></i><span>src</span></button>
                    <button class="fm-nav-button" type="button" data-path="plugins"><i class="fa fa-puzzle-piece" aria-hidden="true"></i><span>plugins</span></button>
                    <button class="fm-nav-button" type="button" data-path="node_modules"><i class="fa fa-cubes" aria-hidden="true"></i><span>node_modules</span></button>
                </div>
                <div class="fm-nav-footer">
                    <i class="fa fa-shield-alt" aria-hidden="true"></i>
                    <span>גישה לפי הרשאות אישיות</span>
                </div>
            </aside>

            <section class="fm-file-pane">
                <div class="fm-pane-heading">
                    <div>
                        <strong>תוכן התיקייה</strong>
                        <span id="fm-current-path" class="fm-current-path fm-ltr" dir="ltr">/</span>
                    </div>
                    <div class="fm-view-switch" aria-label="תצוגת קבצים">
                        <button id="fm-view-list" class="is-active" type="button" title="תצוגת פרטים" aria-label="תצוגת פרטים"><i class="fa fa-list" aria-hidden="true"></i></button>
                        <button id="fm-view-grid" type="button" title="תצוגת סמלים" aria-label="תצוגת סמלים"><i class="fa fa-th-large" aria-hidden="true"></i></button>
                    </div>
                </div>
                <div class="fm-list-heading">
                    <span>שם</span><span>סוג</span><span>גודל</span><span>תאריך שינוי</span><span>פעולות</span>
                </div>
                <div id="fm-file-list" class="fm-file-list">
                    <div class="fm-empty"><i class="fa fa-folder-open" aria-hidden="true"></i><strong>טוען קבצים ותיקיות</strong><span>מתחבר לסביבת NodeBB…</span></div>
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
                        <button class="fm-icon-btn" id="fm-editor-wrap" type="button" title="גלישת שורות" aria-label="גלישת שורות"><i class="fa fa-text-width" aria-hidden="true"></i></button>
                        <button class="fm-icon-btn" id="fm-editor-fullscreen" type="button" title="מסך מלא" aria-label="מסך מלא"><i class="fa fa-expand" aria-hidden="true"></i></button>
                        <button class="fm-icon-btn" id="fm-editor-close" type="button" title="סגירה" aria-label="סגירת העורך"><i class="fa fa-times" aria-hidden="true"></i></button>
                    </div>
                </div>
                <div class="fm-editor-toolbar">
                    <span class="fm-editor-language" id="fm-editor-language">עורך קוד</span>
                    <span class="fm-editor-hint">Ctrl + S לשמירה · Ctrl + F לחיפוש</span>
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

            <aside class="fm-preview-panel">
                <div class="fm-preview-heading">
                    <div><i class="fa fa-eye" aria-hidden="true"></i><strong>תצוגה מקדימה</strong></div>
                    <span class="fm-preview-caption">פרטי הפריט הנבחר</span>
                </div>
                <div class="fm-preview-file-heading">
                    <span class="fm-preview-file-icon"><i class="fa fa-file" aria-hidden="true"></i></span>
                    <div><strong id="fm-preview-title">לא נבחר קובץ</strong><small id="fm-preview-meta"></small></div>
                </div>
                <div class="fm-preview-stage">
                    <img id="fm-preview-image" alt="" hidden>
                    <div id="fm-preview-empty" class="fm-preview-empty">בחר קובץ כדי לראות פרטים או תצוגה מקדימה.</div>
                    <div id="fm-preview-content" class="fm-preview-content"></div>
                </div>
                <div class="fm-preview-actions">
                    <button class="fm-btn fm-btn-primary" id="fm-preview-edit" type="button" hidden><i class="fa fa-external-link-alt" aria-hidden="true"></i> פתח פריט</button>
                </div>
            </aside>
        </div>
    </main>

    <section class="fm-overlay-panel fm-backups-panel" id="fm-backups-panel" hidden>
        <div class="fm-overlay-heading">
            <div><span class="fm-overlay-kicker">שחזור וניהול נתונים</span><h2>גיבויים וסל מחזור</h2><p>גיבויים קודמים ופריטים שנמחקו שניתן לשחזר.</p></div>
            <button class="fm-icon-close" id="fm-close-backups" type="button" aria-label="סגירה"><i class="fa fa-times" aria-hidden="true"></i></button>
        </div>
        <div id="fm-backups-list"><div class="fm-empty">טוען גיבויים…</div></div>
    </section>

    <section class="fm-overlay-panel fm-access-panel" id="fm-access-panel" hidden>
        <div class="fm-overlay-heading">
            <div><span class="fm-overlay-kicker">הרשאות ואבטחה</span><h2>משתמשים מורשים</h2><p>הוסף משתמשי פורום, קבע הרשאות ואפס מפתחות אישיים בעת הצורך.</p></div>
            <button class="fm-icon-close" id="fm-access-close" type="button" aria-label="סגירה"><i class="fa fa-times" aria-hidden="true"></i></button>
        </div>
        <div class="fm-access-notice"><i class="fa fa-shield-alt" aria-hidden="true"></i><span>לכל משתמש יש מפתח אישי נפרד למנהל הקבצים. המפתח אינו זהה לסיסמת NodeBB. מנהלים יכולים לאפס מפתח של משתמש, אך אינם יכולים לראות את הסיסמה שלו.</span></div>
        <div class="fm-user-search-row">
            <div class="fm-search-box">
                <i class="fa fa-search" aria-hidden="true"></i>
                <input id="fm-user-search" type="search" placeholder="חיפוש משתמש לפי שם משתמש..." autocomplete="off">
            </div>
            <button class="fm-btn fm-btn-primary" id="fm-user-search-button" type="button"><i class="fa fa-search" aria-hidden="true"></i> חיפוש</button>
        </div>
        <div id="fm-user-search-results" class="fm-user-search-results"></div>
        <div class="fm-access-list-heading"><h3>רשימת משתמשים מורשים</h3><span id="fm-access-count">0 משתמשים</span></div>
        <div id="fm-allowed-users" class="fm-allowed-users"><div class="fm-empty">טוען רשימת הרשאות…</div></div>
        <div class="fm-access-savebar">
            <span>רק מנהלי קבצים שאושרו במפתח השרת יכולים לנהל את הרשימה. תפקיד מנהל קבצים מעניק גישה מלאה למערכת.</span>
            <button class="fm-btn fm-btn-primary" id="fm-access-save" type="button"><i class="fa fa-save" aria-hidden="true"></i> שמירת הרשאות</button>
        </div>
    </section>

    <div id="fm-bootstrap-dialog" class="fm-modal-overlay" hidden>
        <div class="fm-modal fm-vault-modal" role="dialog" aria-modal="true" aria-labelledby="fm-bootstrap-title">
            <div class="fm-modal-icon is-secure"><i class="fa fa-server" aria-hidden="true"></i></div>
            <span class="fm-modal-eyebrow">אימות מול השרת</span>
            <h2 id="fm-bootstrap-title">הפעלת מנהל הקבצים</h2>
            <p>למנהלי NodeBB אין גישה אוטומטית. כדי להפוך את החשבון שלך למנהל קבצים, יש להזין את מפתח האתחול שנשמר בקובץ מוגן בשרת, ולאמת גם את סיסמת חשבון NodeBB שלך.</p>
            <label class="fm-password-label" for="fm-bootstrap-key">מפתח האתחול של השרת</label>
            <input id="fm-bootstrap-key" type="password" dir="ltr" autocomplete="off" placeholder="מפתח סודי בן 32 תווים לפחות">
            <div class="fm-modal-error" id="fm-bootstrap-error" hidden></div>
            <div class="fm-modal-actions">
                <button class="fm-btn fm-btn-primary" id="fm-bootstrap-submit" type="button"><i class="fa fa-shield-alt" aria-hidden="true"></i> אימות והפעלת גישה</button>
            </div>
            <small class="fm-password-footnote">המפתח אינו נשמר בדפדפן. לאחר האימות, הגישה תינתן רק לחשבונות שאישרת במפורש.</small>
        </div>
    </div>

    <div id="fm-vault-dialog" class="fm-modal-overlay" hidden>
        <div class="fm-modal fm-vault-modal" role="dialog" aria-modal="true" aria-labelledby="fm-vault-title">
            <div class="fm-modal-icon is-secure"><i class="fa fa-key" aria-hidden="true"></i></div>
            <span class="fm-modal-eyebrow">מפתח אבטחה אישי ונפרד</span>
            <h2 id="fm-vault-title">סיסמת מנהל הקבצים</h2>
            <p>הגדר סיסמה אישית שתשמש לאישור פעולות בקבצים. היא נפרדת מסיסמת NodeBB ונשמרת בשרת כ־hash עם salt ייחודי.</p>
            <label class="fm-password-label" for="fm-vault-password">סיסמה חדשה</label>
            <input id="fm-vault-password" type="password" dir="ltr" autocomplete="new-password" placeholder="לפחות 12 תווים">
            <label class="fm-password-label" for="fm-vault-confirm">אימות סיסמה</label>
            <input id="fm-vault-confirm" type="password" dir="ltr" autocomplete="new-password" placeholder="הקלד שוב את הסיסמה">
            <div class="fm-modal-error" id="fm-vault-error" hidden></div>
            <div class="fm-modal-actions">
                <button class="fm-btn fm-btn-light" id="fm-vault-cancel" type="button">ביטול</button>
                <button class="fm-btn fm-btn-primary" id="fm-vault-save" type="button"><i class="fa fa-shield-alt" aria-hidden="true"></i> שמירת מפתח</button>
            </div>
            <small class="fm-password-footnote">לשמירה תידרש גם סיסמת NodeBB שלך. אין אפשרות לשחזר את המפתח הישן, רק להחליף אותו.</small>
        </div>
    </div>

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
            <span class="fm-modal-eyebrow">אימות אבטחה של מנהל הקבצים</span>
            <h2 id="fm-password-title">נדרש מפתח אישי</h2>
            <p id="fm-password-description">להמשך הפעולה, הזן את סיסמת מנהל הקבצים האישית שלך.</p>
            <label class="fm-password-label" id="fm-password-label-text" for="fm-password-input">סיסמת מנהל הקבצים</label>
            <input id="fm-password-input" type="password" dir="ltr" autocomplete="current-password" placeholder="הקלד סיסמה">
            <div class="fm-modal-error" id="fm-password-error" hidden></div>
            <div class="fm-modal-actions">
                <button class="fm-btn fm-btn-light" id="fm-password-cancel" type="button">ביטול</button>
                <button class="fm-btn fm-btn-primary" id="fm-password-confirm" type="button"><i class="fa fa-shield-alt" aria-hidden="true"></i> אימות וביצוע</button>
            </div>
            <small class="fm-password-footnote">המפתח נבדק בשרת ואינו נשמר בדפדפן.</small>
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
