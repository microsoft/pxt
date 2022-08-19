declare namespace React {
    interface ImgHTMLAttributes<T> {
      referrerPolicy?:  "no-referrer" | "no-referrer-when-downgrade" | "origin" | "origin-when-cross-origin" | "unsafe-url";
    }
}
