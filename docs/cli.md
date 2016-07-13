# Command Line Tool

PXT comes with a command line tool called, surprise, surprise, `pxt`.

## Modifying server config

Get current server config:

```bash
pxt api config/settings > settings.json
```

Next, edit `settings.json`. When you're done, run:

```bash
pxt api config/settings - < settings.json
```

It's best to now remove `settings.json`, so that you're sure you'll be getting
the latest server version next time you edit it.

There is also `config/compile` in addition to `config/settings`.

## Cleaning up cloud pointers

Pointers in the cloud backend correspond to URLs on the website.
They can point to a `.md` file uploaded from `docs/`, to a different web address (redirect), or
to an uploaded release of a PXT target.

The `.md` files are uploaded with `pxt uploaddoc` command. However, this command
doesn't delete pointers that are no longer under `docs/` so it's easy to end
up with a little mess. To cleanup it up use:

```bash
pxt ptrcheck
```

This will ask the cloud for list of all pointers for the current target (or all pointers
in the main `pxt` repo) and compare it against files in `docs/`. Then all pointers missing from `docs/` will
be shown. If you want to delete them, run `pxt ptrcheck delete`. This will again list all the pointers
missing from `docs/` and ask you if you really want to delete them. Make sure to review the list
very carefully before agreeing.

It's often the case that you want to save some pointers even though they are not in `docs/`.
You can add them to `ptrcheck-ignore` file. It supports simple pointer names (with `-` instead of `/`),
and also prefix-patterns of the format `foo*` or `bar-*` matching everything starting with the
string. Stars in the middle of the string will **not** work.

