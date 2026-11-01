# syntax = docker/dockerfile:1.27

ARG NODE_VERSION=26.12.1-trixie

# build assets & compile TypeScript

FROM --platform=$BUILDPLATFORM node:${NODE_VERSION} AS native-builder

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
	--mount=type=cache,target=/var/lib/apt,sharing=locked \
	rm -f /etc/apt/apt.conf.d/docker-clean \
	; echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' > /etc/apt/apt.conf.d/keep-cache \
	&& apt-get update \
	&& apt-get install -yqq --no-install-recommends \
	build-essential

WORKDIR /cherrypick

COPY ["pnpm-lock.yaml", "pnpm-workspace.yaml", "package.json", "./"]
COPY ["scripts", "./scripts"]
COPY ["patches", "./patches"]
COPY ["packages/backend/package.json", "./packages/backend/"]
COPY ["packages/frontend-shared/package.json", "./packages/frontend-shared/"]
COPY ["packages/frontend/package.json", "./packages/frontend/"]
COPY ["packages/frontend-embed/package.json", "./packages/frontend-embed/"]
COPY ["packages/frontend-builder/package.json", "./packages/frontend-builder/"]
COPY ["packages/icons-subsetter/package.json", "./packages/icons-subsetter/"]
COPY ["packages/sw/package.json", "./packages/sw/"]
COPY ["packages/cherrypick-js/package.json", "./packages/cherrypick-js/"]
COPY ["packages/misskey-reversi/package.json", "./packages/misskey-reversi/"]
COPY ["packages/misskey-bubble-game/package.json", "./packages/misskey-bubble-game/"]

ARG NODE_ENV=production

RUN node -e "console.log(JSON.parse(require('node:fs').readFileSync('./package.json')).packageManager)" | xargs npm install -g

# Browser test binaries belong to the test runner, not the application image.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store,sharing=locked \
	CYPRESS_INSTALL_BINARY=0 pnpm i --frozen-lockfile --aggregate-output

COPY . ./

RUN git submodule update --init

# 旗鯖fork: ビルダーに src の変更を確実に認識させ、テンプレ/アセット古残骸を完全排除する根本対策。
#
# 過去事象:
#   - .dockerignore で built/ を除外しているはずでも、稀に古い built/views/*.pug がコンテナに残る
#   - swc の -D (--copy-files) は非コンパイル対象 (.pug 等) を出力先にコピーするが、
#     既存ファイルの mtime 比較で skip するケースがあり、src の更新が built に反映されない
#   - Docker BuildKit の COPY --link レイヤーキャッシュバグも併発しうる
#
# 対策:
#   1. すべての .pug / .css / .html / .yml / json schema を強制 touch して mtime を build 時刻に更新
#      → swc が「全部新しいファイル」とみなしてコピーする
#   2. build 前に built/ packages/*/built を完全削除
#      → 残骸が紛れ込む余地をなくす
#
# これにより本番リリース時のテンプレート反映の正確性を保証 (var LANGS 等の base.pug 更新も確実に伝播)。
RUN find packages -path "*/src/*" -type f \( -name "*.pug" -o -name "*.css" -o -name "*.html" \) -exec touch {} + 2>/dev/null || true
RUN rm -rf built packages/*/built

# 旗鯖fork: ⚠️vite build が V8 のヒープ上限で落ちる (Reached heap limit -> vite build が SIGABRT)。
# ⚠️原因は RAM 不足ではない。.wslconfig が意図的に memory=6GB / swap=16GB にしてあり
#   (「フロントのビルドは OOM するので swap へ逃がす」と明記)、⚠️V8 の既定の上限が
#   使用可能メモリから小さく決まってしまうのが原因。⚠️ここで明示的に上限を渡して swap へ逃がす。
# ⚠️同じ理由で vue-tsc も --max-old-space-size が要る (CLAUDE.md に記載)。
# ⚠️このENVは native-builder 段だけに効く (runner 段の NODE_ENV とは別)。
ENV NODE_OPTIONS=--max-old-space-size=8192
RUN pnpm build

# build 結果の検証 (重要なテンプレートが正しく出力されたか確認、デバッグ時のフェイルセーフ)
RUN ls -la packages/backend/built/server/web/views/base.pug \
    && grep -c "var LANGS" packages/backend/built/server/web/views/base.pug

RUN rm -rf .git/

# build native dependencies for target platform

FROM --platform=$TARGETPLATFORM node:${NODE_VERSION} AS target-builder

RUN apt-get update \
	&& apt-get install -yqq --no-install-recommends \
	build-essential

WORKDIR /cherrypick

COPY ["pnpm-lock.yaml", "pnpm-workspace.yaml", "package.json", "./"]
COPY ["scripts", "./scripts"]
COPY ["patches", "./patches"]
COPY ["packages/backend/package.json", "./packages/backend/"]
COPY ["packages/cherrypick-js/package.json", "./packages/cherrypick-js/"]
COPY ["packages/misskey-reversi/package.json", "./packages/misskey-reversi/"]
COPY ["packages/misskey-bubble-game/package.json", "./packages/misskey-bubble-game/"]

ARG NODE_ENV=production

RUN node -e "console.log(JSON.parse(require('node:fs').readFileSync('./package.json')).packageManager)" | xargs npm install -g

RUN --mount=type=cache,target=/root/.local/share/pnpm/store,sharing=locked \
	CYPRESS_INSTALL_BINARY=0 pnpm i --frozen-lockfile --aggregate-output

FROM --platform=$TARGETPLATFORM node:${NODE_VERSION}-slim AS runner

ARG UID="991"
ARG GID="991"

# pnpm 11 は run 実行前に依存検査を行い自動 pnpm install を試みる（本番イメージでは必ず失敗する）ため上流同様に無効化
ENV PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false

RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
	ffmpeg tini curl libjemalloc-dev libjemalloc2 \
	&& ln -s /usr/lib/$(uname -m)-linux-gnu/libjemalloc.so.2 /usr/local/lib/libjemalloc.so \
	&& groupadd -g "${GID}" cherrypick \
	&& useradd -l -u "${UID}" -g "${GID}" -m -d /cherrypick cherrypick \
	&& find / -type d -path /sys -prune -o -type d -path /proc -prune -o -type f -perm /u+s -ignore_readdir_race -exec chmod u-s {} \; \
	&& find / -type d -path /sys -prune -o -type d -path /proc -prune -o -type f -perm /g+s -ignore_readdir_race -exec chmod g-s {} \; \
	&& apt-get clean \
	&& rm -rf /var/lib/apt/lists

# add package.json to add pnpm
COPY ./package.json ./package.json
RUN node -e "console.log(JSON.parse(require('node:fs').readFileSync('./package.json')).packageManager)" | xargs npm install -g

USER cherrypick
WORKDIR /cherrypick

COPY --chown=cherrypick:cherrypick --from=target-builder /cherrypick/node_modules ./node_modules
COPY --chown=cherrypick:cherrypick --from=target-builder /cherrypick/packages/backend/node_modules ./packages/backend/node_modules
COPY --chown=cherrypick:cherrypick --from=target-builder /cherrypick/packages/cherrypick-js/node_modules ./packages/cherrypick-js/node_modules
COPY --chown=cherrypick:cherrypick --from=target-builder /cherrypick/packages/misskey-reversi/node_modules ./packages/misskey-reversi/node_modules
COPY --chown=cherrypick:cherrypick --from=target-builder /cherrypick/packages/misskey-bubble-game/node_modules ./packages/misskey-bubble-game/node_modules
COPY --chown=cherrypick:cherrypick --from=native-builder /cherrypick/built ./built
COPY --chown=cherrypick:cherrypick --from=native-builder /cherrypick/packages/cherrypick-js/built ./packages/cherrypick-js/built
COPY --chown=cherrypick:cherrypick --from=native-builder /cherrypick/packages/misskey-reversi/built ./packages/misskey-reversi/built
COPY --chown=cherrypick:cherrypick --from=native-builder /cherrypick/packages/misskey-bubble-game/built ./packages/misskey-bubble-game/built
COPY --chown=cherrypick:cherrypick --from=native-builder /cherrypick/packages/backend/built ./packages/backend/built
COPY --chown=cherrypick:cherrypick --from=native-builder /cherrypick/fluent-emojis /cherrypick/fluent-emojis
COPY --chown=cherrypick:cherrypick . ./

ENV LD_PRELOAD=/usr/local/lib/libjemalloc.so
ENV MALLOC_CONF=background_thread:true,metadata_thp:auto,dirty_decay_ms:30000,muzzy_decay_ms:30000
ENV NODE_ENV=production
HEALTHCHECK --interval=5s --retries=20 CMD ["/bin/bash", "/cherrypick/healthcheck.sh"]
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["pnpm", "run", "migrateandstart"]
