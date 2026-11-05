#!/bin/sh
# Compose interpolates $ inside environment values and drops pieces of ADMIN_USERS.
# This file is mounted as-is and applied after that interpolation.
# Accept either literal bcrypt ($2b$…) or compose-escaped ($$2b$$…) in the mount —
# collapsing $$ → $ so a mistaken copy of .env.admin into .env.admin.literal
# does not break admin login (hashes no longer start with $2, plaintext compare fails).
set -e
if [ -f /run/mll-admin.env ]; then
  ADMIN_USERS=$(node -e 'const fs=require("fs"); const s=fs.readFileSync("/run/mll-admin.env","utf8"); const i=s.indexOf("="); if (i < 0) process.exit(1); let v=s.slice(i + 1).replace(/\n$/, ""); if (v.includes("$$")) v=v.split("$$").join("$"); process.stdout.write(v);')
  export ADMIN_USERS
fi
exec ./docker-entrypoint.sh
