interface GithubDescription {
    repo?: { fullName: string };
    description?: string;
}

/**
 * Refresh descriptions without replacing an installed card's package metadata.
 */
export function withGithubDescriptions<T extends GithubDescription>(extensions: T[], fetched: GithubDescription[]): T[] {
    const descriptions = new Map<string, string | undefined>();
    for (const extension of fetched) {
        if (extension.repo?.fullName) {
            descriptions.set(extension.repo.fullName.toLowerCase(), extension.description);
        }
    }
    return extensions.map(extension => {
        const key = extension.repo?.fullName?.toLowerCase();
        return key && descriptions.has(key)
            ? { ...extension, description: descriptions.get(key) }
            : extension;
    });
}
