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

There is also `config/compile` in addition to `config/settings`.
