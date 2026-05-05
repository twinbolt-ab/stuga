# Changelog

## [0.3.38] - 2026-05-05

A small polish release with a fix for one of the in-app links.

**Bug Fixes**
- Fixed the "Rate the app" link so it now opens the correct App Store page


## [0.3.37] - 2026-04-29

This release is all behind-the-scenes work to keep Stuga shipping smoothly — no user-facing changes this time.


## [0.3.36] - 2026-04-29

A few small refinements in this release.

- Layout and room order now reset properly when you log out
- Removed climate and covers from the UI for now while we polish them
- Behind-the-scenes cleanups for a smoother experience


## [0.3.35] - 2026-02-10

This is a small maintenance release focused on bug fixes and reliability.

**Bug Fixes**
- Fixed device type settings not saving properly when navigating between screens
- Fixed external links not opening correctly on iOS and Android
- Removed an empty "Other" tab that could appear when no floors are set up
- Fixed redirect issues with certain web links


## [0.3.34] - 2026-02-10

This release focuses on stability and fixing a handful of annoying bugs.

**Bug Fixes**
- Fixed device type settings not saving properly when navigating between screens
- Fixed external links not opening correctly on iOS and Android
- Removed an empty "Other" tab that could appear when no floors are set up


## [0.3.33] - 2026-02-10

This release fixes several bugs and improves the overall experience.

**Bug Fixes**
- Fixed device type settings not saving properly when navigating between screens
- Fixed external links not opening correctly on iOS and Android
- Removed an empty "Other" tab that could appear when no floors are set up


## [0.3.32] - 2026-02-10

This release cleans up a few rough edges and fixes some annoying bugs.

**Improvements**
- The "Other" tab no longer shows up when you don't have any floors set up

**Bug Fixes**
- Device type settings (like setting a light as a fan) now save properly and stick around as you navigate
- Links to external sites now open correctly on iOS and Android instead of getting stuck


## [0.3.31] - 2026-02-10

This release squashes a handful of bugs and tidies things up.

**Bug Fixes**
- Fixed device settings (like device type) not saving properly when navigating between screens
- Fixed external links not opening correctly on iOS and Android
- Removed an empty "Other" tab that could appear when your home has no floors set up


## [0.3.30] - 2026-02-06

This update fixes a couple of annoying bugs to make things smoother.

**Bug Fixes**
- Fixed swiping between floors on the Favorites tab
- Fixed the selection ring not showing correctly on room cards


## [0.3.29] - 2026-02-03

This release brings a smoother experience when organizing your favorites.

**Improvements**
- Added a loading indicator when toggling custom order on or off
- Simplified settings with a single "Custom room & device order" option

**Bug Fixes**
- Fixed an issue where items would jump around when reordering favorites
- Improved visual consistency in favorites edit mode


## [0.3.28] - 2026-02-02

This update brings the all-new **Favorites view** – a dedicated tab where you can pin your most-used devices and scenes for quick access. We're also rolling out a few improvements from earlier today that you might have missed.

**New Features**
- Favorites tab for instant access to your most important controls
- Drag and drop to reorder devices, scenes, and sensors in any room
- Select multiple items and move them together
- Choose to keep your room and device order local or sync it to Home Assistant (Settings → Advanced)
- The first temperature sensor now shows on the room card
- News section in settings to stay up to date with Stuga
- Quick links to give feedback and join discussions (Settings menu)

**Improvements**
- Faster dashboard loading with cached layouts
- Smoother login flow with instant redirect after connecting
- Clearer indication of where hidden devices are synced
- Simplified room order settings
- Better visual feedback when selecting multiple devices

**Bug Fixes**
- Fixed crash on Huawei and other non-Google Play Services Android devices


## [0.3.27] - 2026-02-02

This update brings a much-requested feature: you can now reorder devices, scenes, and sensors within your rooms! We've also added a news section to settings and made several quality-of-life improvements.

**New Features**
- Drag and drop to reorder devices, scenes, and sensors in any room
- Choose to keep your room and device order local or sync it to Home Assistant via labels (Settings → Advanced)
- The first temperature sensor will be the one that shows in the room card
- Select multiple items and move them together
- News section in settings to stay up to date with Stuga

**Improvements**
- Clearer indication of where hidden devices are synced
- Simplified room order settings
- Better visual feedback when selecting multiple devices


## [0.3.26] - 2026-01-30

This release brings a refreshed settings experience and several quality-of-life improvements.
**Improvements**
- Settings now opens as a full-screen menu sliding in from the right for easier navigation
- Settings button moved to the top-right corner with a cleaner icon
- Added a logout option when connection is lost, so you can switch servers more easily
- Improved room reordering with better touch-based swiping
- Cleaner layout when your home doesn't have multiple floors
**Bug Fixes**
- Fixed rooms sometimes not appearing when assigned to a missing floor
- Hidden technical entities (config/diagnostic) that aren't meant for daily use


## [0.3.25] - 2026-01-30

This release brings a refreshed settings experience and several quality-of-life improvements.

**Improvements**

- Settings now opens as a full-screen menu sliding in from the right for easier navigation
- Settings button moved to the top-right corner with a cleaner icon
- Added a logout option when connection is lost, so you can switch servers more easily
- Improved room reordering with better touch-based swiping
- Cleaner layout when your home doesn't have multiple floors

**Bug Fixes**

- Fixed rooms sometimes not appearing when assigned to a missing floor
- Hidden technical entities (config/diagnostic) that aren't meant for daily use


## [0.3.24] - 2026-01-29

This release contains only internal build system fixes - no user-facing changes.

**Technical**
- Fixed build configuration for Android releases


## [0.3.23] - 2026-01-29

This release focuses on behind-the-scenes improvements to our release process.

- No user-facing changes in this version - just internal fixes to make future releases smoother


## [0.3.22] - 2026-01-28

This release brings temperature display improvements and better support for Android sideloading.

**Improvements**
- Temperature now displays in your preferred unit (Celsius or Fahrenheit) based on your Home Assistant settings
- Android users can now download the APK directly for sideloading or use with Obtainium

**Bug fix**
- Removed accidental advertising ID from Android manifesto


## [0.3.21] - 2026-01-28

This release brings temperature display improvements and better support for Android sideloading.

**Improvements**
- Temperature now displays in your preferred unit (Celsius or Fahrenheit) based on your Home Assistant settings
- Android users can now download the APK directly for sideloading or use with Obtainium


## [0.3.20] - 2026-01-26

Control which smart home devices appear in your Home Assistant dashboard with new device visibility options.

**New Features**
- You can now choose to hide devices either just in Stuga or in Home Assistant too - giving you more control over what shows up where

**Improvements**
- Better error messages when there are SSL/TLS or DNS connection issues, making it easier to troubleshoot connection problems


## [0.3.19] - 2026-01-25

Improved Home Assistant connection setup with smarter URL detection for both local and remote access.

**Improvements**
- Smarter URL handling when setting up your connection - the app now automatically tries different protocols (http/https) and suggests alternatives if your initial URL doesn't work
- When multiple connection options are found, you can now easily pick the one that works best for you

**Bug Fixes**
- Fixed an issue where the setup wizard wouldn't scroll properly when the keyboard appeared
- Fixed a timing issue that could cause connection testing to behave unexpectedly


## [0.3.18] - 2026-01-25

Stability improvements and bug fixes for the Home Assistant dashboard app on Android devices.

**Improvements**
- Added connection diagnostics to help troubleshoot connectivity issues
- Updated privacy policy to reflect our crash reporting practices

**Bug Fixes**
- Fixed compatibility issues on Huawei Android 12 devices
- Fixed modal sheets sometimes closing unexpectedly when swiping
- Fixed slider controls flickering while dragging
- Fixed icon picker scrolling issues on Android
- Fixed room card layout and sizing inconsistencies


## [0.3.17] - 2026-01-23

Display temperature and humidity sensors in your Home Assistant room cards with new customization options.

**Improvements**
- Redesigned floor editing with a cleaner, more intuitive interface
- Room cards now show humidity alongside temperature
- New settings to show or hide temperature and humidity in room cards
- You can now exclude specific lights or switches from the room toggle
- Simplified grid layout with a cleaner 2-column default

**Bug Fixes**
- Switches now behave correctly based on their device type when toggling rooms


## [0.3.16] - 2026-01-23

Bug fixes for the Home Assistant mobile dashboard.

**Bug Fixes**
- Fixed video containers getting squashed when scrolling on phones


## [0.3.15] - 2026-01-22

Android app improvements for the Home Assistant dashboard with better compatibility and app store presence.

**Improvements**
- Improved Android app versioning for more reliable updates
- Added screenshot gallery to the landing page
- Added promotional video to app store listing
- Updated screenshots and visuals
- Improved compatibility with newer Android devices
- Improved app store listings with better descriptions and metadata

**Bug Fixes**
- Fixed Android app build issues


## [0.3.6] - 2026-01-22

Organize your smart home by floors with improved navigation and editing in the Home Assistant dashboard.

**Improvements**
- Show floor name when swiping between floors
- Add floating 'Create floor' button when editing floors
- Swipe to dismiss dropdowns and pickers on mobile
- Smoother drag and drop when reordering room cards
- Better contrast for accent colored buttons
- New segmented control for hide options (replaces dropdown)

**Bug Fixes**
- Fix keyboard covering search results on iOS
- Fix cards jumping when starting to drag during reorder
- Fix dragging cards between floors
- Fix duplicate login messages
- Fix connection status showing incorrectly on empty floors


## [0.3.5] - 2026-01-21

Simplified Home Assistant login with easier authentication method selection.

**Improvements**
- Simplified the login method selection during setup

**Bug Fixes**
- Fixed missing text for switching between login methods


## [0.3.4] - 2026-01-21

Drag and drop room organization for your Home Assistant dashboard with multi-select and cross-floor support.

**Improvements**
- Added multi-room drag selection with visual stacking when selecting multiple rooms
- Added ghost placeholders showing where rooms will be placed during drag
- Added ability to drag rooms between floors by holding over a floor tab
- Added option to disable room ordering in Advanced settings
- Improved visual consistency of floor tabs in edit mode

**Bug Fixes**
- Fixed floor edit mode exit causing unexpected page animation
- Fixed edit mode sometimes opening on the wrong floor
