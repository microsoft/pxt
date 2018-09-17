# pxt-serve Manual Page

### @description Serve a local web server for the editor

Serve a local web server for the editor

```
pxt serve
```

## Options

### localbuild

Force build native images with local tooling

### browser <chrome|ie|firefox|safari> 

Set the browser to launch on web server start

### noBrowser 

Start the server without launching a browser

### noSerial 

do not monitor serial devices

### sourceMaps 

Include source maps when building ts files

### pkg 

Serve packaged

### cloud

forces build to happen in the cloud

### just

just serve without building

### hostname

hostname to run serve, default localhost

### port

port to bind server, default 3232

### wsport

port to bind websocket server, default 3233

## Description

The local web server is meant for development purposes.

## See Also

[pxt](/cli) tool
