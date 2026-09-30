#!/bin/zsh -f
startup_file="${ZDOTDIR:-$HOME}/.zshenv"
if [[ -r $startup_file ]]; then
  /bin/zsh -f -n "$startup_file" >/dev/null || exit $?
  source "$startup_file" >/dev/null
  startup_status=$?
  if (( startup_status > 1 )); then
    exit "$startup_status"
  fi
fi
zmodload zsh/parameter
export PATH="$HOME/.bun/bin:/usr/bin:/bin"
for name in ${(k)parameters}; do
  case "$name" in
    HOME|PATH|TMPDIR|LANG|COOLIFY_CLOUD_BASE_URL|COOLIFY_CLOUD_ACCESS_TOKEN|CURSOR_COOLIFY_BASE_URL|CURSOR_COOLIFY_ACCESS_TOKEN|COOLIFY_BASE_URL|COOLIFY_ACCESS_TOKEN) ;;
    *)
      if [[ ${parameters[$name]} == *export* ]]; then
        unset "$name"
      fi
      ;;
  esac
done
exec "$HOME/.bun/bin/bunx" -y @jurislm/coolify-plugin@latest --require-config
