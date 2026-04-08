#!/bin/bash
sed -i '/<<<<<<< HEAD/d' .jules/warden.md
sed -i '/2026-04-03 — Assessment & Lifecycle/,/Updated minor\/patch dependencies dotenv./d' .jules/warden.md
sed -i '/=======/d' .jules/warden.md
sed -i '/>>>>>>> 29a9c8b (chore(lifecycle): assure, prune, and sync docs)/d' .jules/warden.md
