Google Apps Script Setup (Branded + Auto Reply)

1. Open your Google Sheet.
2. Go to Extensions -> Apps Script.
3. Replace the script code with contents of Code.gs from this folder.

4. Update these constants in Code.gs:
- NOTIFY_EMAIL = your admin email
- SCHOOL_WEBSITE = your website URL
- SCHOOL_LOGO_URL = public logo URL (optional)
- SCHOOL_NAME, SCHOOL_NAME_MR
- ADMISSION_YEAR
- SCHOOL_PHONE, SCHOOL_ALT_PHONE, SCHOOL_WHATSAPP
- SCHOOL_ADDRESS, SCHOOL_HOURS

5. Deploy as Web App:
- Deploy -> New deployment -> Web app
- Execute as: Me
- Who has access: Anyone
- Deploy and copy the Web App URL

6. In your website index.html, set FORM_WEBHOOK_URL to that Web App URL.

7. Test once with a real email in the form.

Expected output:
- Data saved in Admissions sheet
- Admin gets branded notification email
- Parent gets branded bilingual auto-reply (English + Marathi)

When you update script in future:
- Deploy -> Manage deployments -> Edit -> Deploy new version
