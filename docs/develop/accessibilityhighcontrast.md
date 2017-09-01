# High contrast

This documentation is related to technical points to consider to make your changes compatible with the high contrast mode.

## High contrast mode

The high contrast mode can be managed automatically by Windows, macOS and Linux on some distributions. But it is not supported by some web browser. Chrome in Windows for example doesn't change the color of the web page in high contrast mode while Edge turn the white backgrounds to black.

Therfore, we implemented a high contrast mode that can be turned on manually in the PXT thanks to a JavaScript implementation in ``app.tsx``.

## Managing the high contrast colors

Once the high contrast is enabled, a ``hc`` class is added to the ``root`` node in the DOM. Then, all the CSS from ``pxt/theme/highcontrast.less`` will be applied. Use this file to change the high contrast color of the MakeCode editor. The documentation and ``makecode.com`` does not have a special mode for the high contrast, it only follows the operating system's settings.

Each target have its own implementation to support high contrast.