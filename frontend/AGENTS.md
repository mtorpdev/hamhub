<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## HamHub i18n rule

All UI work must support the two app languages from the start: English is the default and Danish is the alternative. A UI change is not complete until both `frontend/src/i18n/translations/en.ts` and `frontend/src/i18n/translations/da.ts` contain the new or changed text for pages, subpages, popups, modals, toasts, confirm dialogs, empty states, validation text, tabs, buttons, notification text, and reusable components. Do not auto-translate user content, callsigns, QSO data, forum posts, private messages, article bodies, external API responses, or radio abbreviations.
