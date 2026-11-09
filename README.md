# mcq-hero

- Author: [Richard McQuiston](mailto:richard.mcquiston@gmail.com)
- Website: https://richardmcquiston.com/

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/P1V529Z7ZP)

## Table of Contents

| [Overview](#overview) | [Getting Started](#getting-started) | [Buy Me a Coffee](#buy-me-a-coffee) | [License](#license) | [Copyright](#copyright) |

## Overview

Makes the McQForYouDesign Etsy hero image: a 4000x3000 (4:3) branded overlay on a product photo, plus a 270px thumbnail to check legibility. The badge and Josefin Sans Bold font are bundled, so nothing is downloaded at run time except Playwright's browser.

[Back to Top](#table-of-contents)

## Getting Started

### Prerequisites

- Node 18 or newer
- Python 3 with `pillow` and `numpy` (`pip install pillow numpy`)
- Playwright's Chromium, once: `npx playwright install chromium`

### Installation

No install needed:

```bash
npx github:RichardMcQuiston01/mcq-hero --help
```

### Usage

```bash
npx github:RichardMcQuiston01/mcq-hero --image in.jpg --title "Laser Cut Jig Pack #1" --type digital --label "xTool F1/F2" --out hero.jpg
```

### What it does

1. **Prep** (`prep_photo.py`, Pillow and numpy): fixes orientation, optional rotate or straighten, crops to 4:3, mild global lighting. It never retouches, removes, blurs, fills or regenerates anything.
2. **Compose** (`make_hero.js`, Playwright): sage `#5B714D` 450px title band with a gold `#CDB276` underline, white Josefin Sans Bold all-caps title (auto-shrunk, two lines if long), 30px sage frame, badge bottom-left, cream `#F3EBD6` machine pill bottom-right, and a gold Digital Download tag for digital items only.

Everything the design needs is bundled in `assets/`: the badge PNG and Josefin Sans Bold (SIL OFL, from `@fontsource/josefin-sans` 5.3.0, license in `assets/fonts/OFL.txt`). Nothing is downloaded at run time except Playwright's browser, once.

### Options

| Option                                      | Meaning                                                           |
| ------------------------------------------- | ----------------------------------------------------------------- |
| `--image`, `--title`, `--type`              | Required. `--type` is `digital` or `physical`.                    |
| `--label`                                   | Machine pill text, for example `xTool F1/F2`. Omit for no pill.   |
| `--out`                                     | Output path. Default: `<image>_hero.jpg` beside the source photo. |
| `--rotate N`                                | 90, 180 or 270 for sideways photos, or a small angle to straighten (positive is counter-clockwise). |
| `--crop`, `--light`, `--wb`                 | `auto` (default) or `none`.                                       |
| `--no-prep`                                 | Skip photo prep and use the image as given.                       |
| `--badge`, `--font`, `--caps`, `--size`, `--quality` | Overrides for the bundled badge and font, caps (`true`), size (`4000x3000`) and JPEG quality (`92`). |

It prints one JSON report: `output`, `thumbnailCheck`, `titleFontSizePx`, `titleLines`, `photo`, `badge`, `warnings`, and `prep` (the prep steps applied). View the thumbnail first; open the full image only when `warnings` is not empty.

### Badge

`assets/mcq-badge-clean.png` (2000x2000 transparent circle) is the real badge. If it is missing the compositor draws a simplified stand-in and adds a warning.

[Back to Top](#table-of-contents)

## Buy Me a Coffee

If this app, code, or repository has helped you or someone you know, please consider donating. I appreciate any help to offset the costs of development and/or AI Credits.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/P1V529Z7ZP)

[Back to Top](#table-of-contents)

## License

Apache 2. The bundled Josefin Sans font is licensed under the SIL Open Font License 1.1 (see `assets/fonts/OFL.txt`).

[Back to Top](#table-of-contents)

## Copyright

(c)2026 Richard McQuiston. All rights reserved.

[Back to Top](#table-of-contents)
