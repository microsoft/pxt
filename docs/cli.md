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
