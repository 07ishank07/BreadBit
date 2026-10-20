# Third-party notices

BreadBit adapts the public [Velxio](https://github.com/davidmonterocrespo24/velxio) project by David Montero Crespo and contributors, pinned in `upstream.lock.json`. The original source and notices remain in `vendor/velxio`. See its `LICENSE` (GNU AGPL version 3) and `COMMERCIAL_LICENSE.md`. No commercial agreement or private build entitlement is assumed.

The root `LICENSE` is a verbatim copy of the upstream AGPLv3 license text. Packaging a derivative must retain corresponding source and required notices. All dependency licenses remain their own; this file is an inventory starting point, not a completed redistribution audit.

The pinned frontend uses React, Monaco, Zustand, AVR8js, RP2040js, Wokwi elements, ngspice-related assets and other packages listed in `package-lock.json`. Preserve their licenses and generated asset notices when packaging. Firmware images and non-Uno board assets are carried from upstream for development compatibility and require a release-specific redistribution/qualification audit.

BreadBit's Tauri/Rust dependencies are listed in `apps/desktop/src-tauri/Cargo.toml`; a Cargo lockfile and native SBOM must be generated on the qualified build host. The development icon is generated locally by `scripts/generate-placeholder-icon.mjs`.

AAS selection records are declarations of engineering guidance. They neither relicense project dependencies nor certify compliance.
