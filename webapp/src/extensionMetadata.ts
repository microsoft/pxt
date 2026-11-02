export interface GithubExtensionCardMetadata {
    name: string;
    displayName?: string;
    description: string;
    imageUrl?: string;
}

/** Match recommended cards while retaining installed package metadata and repository fallbacks. */
export function githubExtensionCardMetadata(
    repo: pxt.github.GitRepo,
    config?: pxt.PackageConfig
): GithubExtensionCardMetadata {
    const icon = config?.icon || (repo.status === pxt.github.GitRepoStatus.Approved ? repo.icon : undefined);
    return {
        name: (config?.name || repo.name).replace(/^pxt-/, ""),
        displayName: config?.displayName?.trim() || repo.displayName?.trim(),
        description: config?.description?.trim() || repo.description?.trim() || "",
        imageUrl: pxt.github.repoIconUrl(repo, icon)
    };
}
