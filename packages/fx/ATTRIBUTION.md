# Attribution

`@aicl/fx` vendors and adapts components from the MIT-licensed projects below.
Each vendored file starts with a header naming its source path and commit.
Adapted means: imports rewritten to relative paths, shadcn colour names kept
(they resolve to AICL tokens in `src/fx.css`), and AI-chat specific props added.

| Project | Source | Pinned commit | Licence |
|---|---|---|---|
| Shaders | https://github.com/shader-effects-inc/shaders | `935f71a7789f` (npm `shaders@4`, used as a dependency, not vendored; telemetry disabled) | MIT, Copyright (c) 2026 Shader Effects Inc. |
| Spell UI | https://github.com/xxtomm/spell-ui | `fffe96db7b67` | MIT, Copyright (c) 2025 Spell UI |
| Cult UI | https://github.com/nolly-studio/cult-ui | `67a66c6ac1cd` | MIT, Copyright (c) 2023 Jordan-Gilliam |
| uselayouts | https://github.com/iurvish/uselayouts | `07cc4f4fb8e0` | MIT, Copyright (c) 2025 Urvish Mali |

## Vendored files

<!-- One row per file: | src/vendor/... | project | source path | -->
| File | Project | Source path |
|---|---|---|

## MIT licence text

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
