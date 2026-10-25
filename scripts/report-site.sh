#!/bin/sh
# Keeps the Allure reports on the gh-pages branch, which GitHub Pages serves: the
# report of main in the root with its history (history.jsonl), the report of pull
# request N in pr/N/.
#
#   scripts/report-site.sh fetch-history <file>
#   scripts/report-site.sh publish <report-dir> <target> [<history-file>]
#   scripts/report-site.sh remove <target>
#
# <target> is . for main or pr/<number>. Run it inside a clone whose origin can be
# pushed to (fetch-history only reads). SITE_BRANCH overrides the branch name.
set -eu

branch="${SITE_BRANCH:-gh-pages}"

# Fetches the site branch into FETCH_HEAD; fails when origin has no such branch yet.
fetch_site() {
  git ls-remote --exit-code --heads origin "$branch" > /dev/null || return 1
  git fetch --quiet --depth 1 origin "$branch"
}

# Checks the site out into a new worktree and prints its path. The first time it
# starts the branch from scratch, with .nojekyll so that Pages serves files as is.
open_site() {
  site="$(mktemp -d)/site"
  if fetch_site; then
    git worktree add --quiet --detach "$site" FETCH_HEAD
  else
    git worktree add --quiet --orphan -b "$branch" "$site"
    touch "$site/.nojekyll"
  fi
  echo "$site"
}

commit_and_push() {
  site="$1"
  message="$2"
  git -C "$site" add -A
  if git -C "$site" diff --cached --quiet; then
    echo "Nothing to publish"
  else
    git -C "$site" -c user.name='github-actions[bot]' \
      -c user.email='41898282+github-actions[bot]@users.noreply.github.com' \
      commit --quiet -m "$message${GITHUB_SHA:+ for $GITHUB_SHA}"
    git -C "$site" push --quiet origin "HEAD:refs/heads/$branch"
    echo "Pushed $(git -C "$site" rev-parse --short HEAD) to $branch"
  fi
  git worktree remove --force "$site"
}

fetch_history() {
  file="$1"
  if fetch_site && git cat-file -e FETCH_HEAD:history.jsonl 2> /dev/null; then
    mkdir -p "$(dirname "$file")"
    git show FETCH_HEAD:history.jsonl > "$file"
    echo "Copied the history of main ($(wc -l < "$file" | tr -d ' ') runs) to $file"
  else
    echo "No history of main yet"
  fi
}

publish() {
  report="$1"
  target="$2"
  history="${3:-}"
  site=$(open_site)
  if [ "$target" = . ]; then
    # The report of main replaces everything but the reports of pull requests.
    find "$site" -mindepth 1 -maxdepth 1 ! -name .git ! -name .nojekyll ! -name pr -exec rm -rf {} +
  else
    rm -rf "${site:?}/$target"
  fi
  mkdir -p "$site/$target"
  cp -R "$report"/. "$site/$target"/
  if [ -n "$history" ]; then
    cp "$history" "$site/history.jsonl"
  fi
  commit_and_push "$site" "Publish the report of $target"
}

remove() {
  target="$1"
  if ! git ls-remote --exit-code --heads origin "$branch" > /dev/null; then
    echo "No site yet"
    return
  fi
  site=$(open_site)
  rm -rf "${site:?}/$target"
  commit_and_push "$site" "Remove the report of $target"
}

command="${1:-}"
[ $# -gt 0 ] && shift
case "$command" in
  fetch-history) fetch_history "$@" ;;
  publish) publish "$@" ;;
  remove) remove "$@" ;;
  *)
    echo "usage: $0 fetch-history <file> | publish <report-dir> <target> [<history-file>] | remove <target>" >&2
    exit 2
    ;;
esac
