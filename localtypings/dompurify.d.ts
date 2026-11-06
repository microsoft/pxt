declare namespace DOMPurify {
    function sanitize(dirty: string, options?: { ADD_ATTR?: string[] }): string;
}