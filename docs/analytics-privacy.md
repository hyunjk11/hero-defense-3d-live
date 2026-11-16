# Basic web analytics

Stream: G-QZCC28G70N. Scope: visits, sessions, device/browser statistics.
No player identity, nickname, email, save, inventory or custom game events are supplied.
Page URL/title/referrer are fixed constants; query strings and fragments are never supplied.
Local/preview hosts, fragments, unknown/test query parameters, DNT, Global Privacy Control,
GA opt-out and pre-existing denied analytics consent skip loading.
No analytics consent grant is added. Existing consent integrations remain authoritative.

## Required stream configuration before publication
- Turn Enhanced Measurement OFF, including history page views, form interactions,
  scrolls, outbound clicks, downloads and search tracking.
- Keep user-provided data collection OFF (including automatic detection).
- Keep Google signals/advertising personalization OFF and no connected advertising tags.
- Verify privacy/consent requirements appropriate to the intended audience; this module
  does not replace a consent-management platform or privacy notice.

## Verification
Use a test property or blocked/intercepted network requests for QA, not real player data.
Confirm collect requests carry only the fixed `dl`, `dt`, empty `dr`, no user_id/user_data,
no page query/hash or DOM text. Confirm one page_view per document and normal game loading
when the Google loader fails. GA may additionally produce its standard session/engagement
metadata. This implementation does not enable gameplay or conversion events.

Official references:
- https://developers.google.com/analytics/devguides/collection/ga4/reference/config
- https://developers.google.com/analytics/devguides/collection/ga4/views
- https://developers.google.com/tag-platform/security/guides/privacy
- https://developers.google.com/tag-platform/security/guides/consent
