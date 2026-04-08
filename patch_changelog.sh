#!/bin/bash
sed -i '/<<<<<<< HEAD/d' CHANGELOG.md
sed -i '/## \[1.1.8\] - 2026-04-03/d' CHANGELOG.md
sed -i '/\* \*\*Dependencies:\*\* Safely bumped patch version of `dotenv` dependency and verified survival. No regressions found, zero dead code pruned./d' CHANGELOG.md
sed -i '/=======/d' CHANGELOG.md
sed -i '/>>>>>>> 29a9c8b (chore(lifecycle): assure, prune, and sync docs)/d' CHANGELOG.md
