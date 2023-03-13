#!/bin/bash
set -euxo pipefail
cd `/usr/bin/dirname $0`

# _OPTS="--dryrun"
_OPTS=""

aws --profile metaverse-dev-deploy s3 sync ${_OPTS} \
      --region ap-northeast-1 \
      --delete \
      --exclude "*.DS_Store" \
      --exclude "temp/*" \
      --exclude "*.clean" \
      --cache-control "max-age=60"\
      ./dist s3://static.verseengine.cloud/examples/avatar-viewer/dist

aws --profile metaverse-dev-deploy s3 sync ${_OPTS} \
      --region ap-northeast-1 \
      --delete \
      --exclude "*.DS_Store" \
      --exclude "*.clean" \
      --cache-control "max-age=31536000" \
      ./example/asset/animation s3://static.verseengine.cloud/examples/avatar-viewer/app/asset/animation

aws --profile metaverse-dev-deploy s3 cp \
example/avatar.html s3://static.verseengine.cloud/examples/avatar-viewer/app/index.html
aws --profile metaverse-dev-deploy s3 cp \
example/setup.js s3://static.verseengine.cloud/examples/avatar-viewer/app/setup.js
