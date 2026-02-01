# Awesome Shortcuts Test Fixture - Zsh Configuration
# This file contains various zsh configurations for testing the parser

# =============================================================================
# Oh My Zsh Configuration
# =============================================================================

export ZSH="$HOME/.oh-my-zsh"
ZSH_THEME="robbyrussell"

plugins=(
  git
  z
  fzf
  docker
  npm
)

source $ZSH/oh-my-zsh.sh

# =============================================================================
# Key Bindings
# =============================================================================

# History search
bindkey '^R' history-incremental-search-backward
bindkey '^S' history-incremental-search-forward

# Fuzzy finder
bindkey '^T' fzf-file-widget

# Navigation
bindkey '^A' beginning-of-line
bindkey '^E' end-of-line

# Word navigation
bindkey '\e[1;5C' forward-word
bindkey '\e[1;5D' backward-word

# Alt+letter bindings
bindkey '\eb' backward-word
bindkey '\ef' forward-word

# Delete word
bindkey '^W' backward-kill-word

# Edit command in editor
bindkey '^X^E' edit-command-line

# Arrow keys for history
bindkey '\e[A' history-beginning-search-backward
bindkey '\e[B' history-beginning-search-forward

# Home and End keys
bindkey '\e[H' beginning-of-line
bindkey '\e[F' end-of-line

# Delete key
bindkey '\e[3~' delete-char

# Vi mode bindings (if using vi mode)
bindkey -M viins '^R' history-incremental-search-backward
bindkey -M vicmd 'k' history-beginning-search-backward

# =============================================================================
# Aliases
# =============================================================================

# Git shortcuts
alias gs='git status'
alias ga='git add'
alias gc='git commit'
alias gp='git push'
alias gl='git pull'
alias gd='git diff'
alias gco='git checkout'
alias gb='git branch'
alias glog='git log --oneline --graph'

# Directory navigation
alias ..='cd ..'
alias ...='cd ../..'
alias ....='cd ../../..'
alias ll='ls -la'
alias la='ls -A'
alias l='ls -CF'

# Docker
alias dps='docker ps'
alias dcp='docker-compose'
alias dcu='docker-compose up -d'
alias dcd='docker-compose down'

# Development
alias nr='npm run'
alias nrd='npm run dev'
alias nrt='npm run test'
alias nrb='npm run build'

# System
alias cls='clear'
alias h='history'
alias reload='source ~/.zshrc'

# Global aliases
alias -g L='| less'
alias -g G='| grep'
alias -g H='| head'
alias -g T='| tail'

# Suffix alias (open .json files with jq)
alias -s json='jq .'

# =============================================================================
# Custom Functions (not parsed as shortcuts)
# =============================================================================

function mkcd() {
  mkdir -p "$1" && cd "$1"
}

function extract() {
  if [ -f "$1" ]; then
    case $1 in
      *.tar.bz2) tar xjf $1 ;;
      *.tar.gz) tar xzf $1 ;;
      *.zip) unzip $1 ;;
      *) echo "Unknown archive format" ;;
    esac
  fi
}

# =============================================================================
# Environment Variables
# =============================================================================

export EDITOR='nvim'
export PATH="$HOME/.local/bin:$PATH"
