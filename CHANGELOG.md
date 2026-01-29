# Changelog

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
