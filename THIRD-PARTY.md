# Third-party components

Market Maker vendors one third-party library so the game runs offline. It is
owned by its own authors and licensed under its own terms, which are
reproduced in full below. The licence in `LICENSE` covers the rest of this
repository and does not apply to anything listed here.

## three.js r128

- File: `vendor/three.min.js`
- Version: r128
- Home: https://threejs.org
- Copyright 2010-2021 three.js authors
- Licence: MIT (SPDX-License-Identifier: MIT)

```
The MIT License

Copyright © 2010-2021 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

The licence banner is also preserved at the top of `vendor/three.min.js` and
must stay there.

## Everything else

There are no other dependencies, no package manager, no build step and no
runtime network access. All textures and audio are generated in code at load
time, so there are no third-party asset files to account for.
