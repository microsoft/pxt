#!/bin/bash
# https://stackoverflow.com/questions/10845051/git-show-total-file-size-difference-between-two-commits
USAGE='[--cached] [<rev-list-options>...]

Show file size changes between two commits or the index and a commit.'

. "$(git --exec-path)/git-sh-setup"
args=$(git rev-parse --sq "$@")
[ -n "$args" ] || usage
cmd="diff-tree -r"
[[ $args =~ "--cached" ]] && cmd="diff-index"
eval "git $cmd $args" | {
  total=0
  bytes=0
  while read A B C D M P
  do
    case $M in
      M) bytes=$(( $(git cat-file -s $D) - $(git cat-file -s $C) )) ;;
      A) bytes=$(git cat-file -s $D) ;;
      D) bytes=-$(git cat-file -s $C) ;;
      *)
        echo >&2 warning: unhandled mode $M in \"$A $B $C $D $M $P\"
        continue
        ;;
    esac
    bytes=$(( $bytes / 1000 ))
    total=$(( $total + $bytes ))
    printf '%dkb\t%s\n' $bytes "$P"
  done
  echo total $total kb
}