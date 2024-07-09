/**
 * Cookie 관련 함수들을 정의합니다.
 */

namespace pxt.codle {
  function getCookie(name: string) {
    let matches = document.cookie.match(
      new RegExp(
        "(?:^|; )" +
          name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, "\\$1") +
          "=([^;]*)"
      )
    );
    return matches ? decodeURIComponent(matches[1]) : undefined;
  }

  export function getEnv(): string {
    return window.location.hostname === "localhost"
      ? "local"
      : window.location.hostname.includes("dev")
      ? "dev"
      : "prd";
  }

  export function getCookieName(name: string): string {
    if (window.location.hostname === "localhost") {
      return `${name}_localhost_local`;
    }
    const tenant = window.location.hostname.split(".")[1];
    return `${name}_${tenant}_${getEnv()}`;
  }

  export function getCookieToken(): string | undefined {
    return getCookie(getCookieName("token"));
  }
}
