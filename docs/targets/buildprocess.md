# How PXT Builds Targets

The PXT build process (kicked off by `pxt serve`) has a number of key steps and some special cases. It requires the file [pxtarget.json](/targets/pxtarget).

## sim directory

## cmds directory

## built directory

## Special cases:

* target id == "core": this is reserved for microsoft/pxt (see http://github.com/microsoft/pxt)
* target id == "common": this is used for targets that serve to bundle a set of directories as common/shared packages (see http://github.com/microsoft/pxt-common-packages).

