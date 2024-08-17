/**
 * Cookie 관련 함수들을 정의합니다.
 */

namespace pxt.cookie {
  /**
   * document.cookie에서 name에 해당하는 쿠키 값을 가져옵니다.
   */
  function getCookie(name: string) {
    const cookies = document.cookie.split("; ");
    const cookie = cookies.find((cookie) => cookie.startsWith(name + "="));
    return cookie ? decodeURIComponent(cookie.split("=")[1]) : undefined;
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
