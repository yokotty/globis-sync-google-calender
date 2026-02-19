# Privacy Policy

Last updated: 2026-02-19

This extension ("GLOBIS Google Calendar Sync") is designed to help users register schedules shown on specific GLOBIS VC pages into Google Calendar.

## 1. Data Collection

This extension does not collect, store, or transmit personal data to the extension publisher's external servers.

- No account credentials are collected.
- No browsing history is collected.
- No page data is sent to any server operated by the publisher.

## 2. Data Usage

The extension reads and modifies page DOM only on matched GLOBIS VC pages in order to:

- detect schedule date/time information
- show calendar registration links in the UI
- prepare event payloads for Google Calendar registration

All parsing and UI processing is performed locally in the user's browser.

## 3. Data Sharing

This extension does not sell, share, or transfer user data to third parties for advertising or analytics purposes.

When the user explicitly triggers calendar registration, required schedule fields are sent to Google Calendar API to create events in the user's own Google account.

## 4. Permissions

The extension uses:

- host access for matched GLOBIS VC URLs defined in `manifest.json` (for DOM parsing and UI injection)
- Google OAuth/identity permissions (for creating Google Calendar events)

## 5. Security

No custom backend is used by this extension.

API communication is limited to Google APIs needed for calendar event creation, and only when initiated by user action.

## 6. Changes to This Policy

This policy may be updated when extension behavior changes. The latest version will be published in this repository.

## 7. Contact

For questions regarding this policy, please contact the extension publisher via the repository issue tracker:

- https://github.com/yokotty/globis-my-extension/issues
