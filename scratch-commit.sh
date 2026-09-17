#!/bin/bash
git add src/lib/ public/samples/ src/app/ src/components/ scripts/ package.json package-lock.json README.md
# make sure the newly generated screenshots are added too
git add public/screenshots/
git commit -m "refactor(ui): unify typography scale, clean dependencies, and update documentation

- Bumped all text sizes by one logical step across the application (e.g. text-xs -> text-sm, text-sm -> text-base) to improve readability and conform to a unified design system hierarchy.
- Removed unused dependencies (clsx, tailwind-merge).
- Applied Prettier code formatting globally.
- Updated README.md with direct visual dashboard and hero screenshots.
- Cleaned up obsolete console logs."
