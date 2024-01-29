import { useData } from "../../data";
import { EditorPackage, File, PackageMeta } from "../../package";
import { FolderTreeItem } from "./FolderTreeItem";

export interface PackageTreeItemProps {
    pkg: EditorPackage;
    onPackageDelete: (pkg: EditorPackage) => void;
    onPackageUpdate: (pkg: EditorPackage) => void;
}

export const PackageTreeItem = (props: PackageTreeItemProps) => {
    const { pkg, onPackageDelete, onPackageUpdate } = props;

    const id = pkg.getPkgId();
    const ksPackage = pkg.getKsPkg();

    const meta = useData<PackageMeta>("open-pkg-meta:" + id);

    const canDelete = !pxt.shell.isReadOnly() &&
        id != pxt.appTarget.id &&
        id != "built" &&
        id != "assets" &&
        id != pxt.appTarget.corepkg &&
        !ksPackage.config?.core &&
        ksPackage.level <= 1;

    const isGithubPackage = ksPackage.verProtocol() === "github";

    let version = isGithubPackage ? ksPackage.verArgument().split('#')[1] : undefined;
    if (version?.length > 20) {
        version = version.substring(0, 7);
    }

    const topPkg = pkg.isTopLevel();
    const langRestrictions = pkg.getLanguageRestrictions();
    let files = pkg.sortedFiles();

    if (topPkg) {
        files = files.filter(f => {
            switch (langRestrictions) {
                case pxt.editor.LanguageRestriction.JavaScriptOnly:
                    return !/\.(blocks|py)$/.test(f.name);
                case pxt.editor.LanguageRestriction.PythonOnly:
                    return !/\.(blocks|ts)$/.test(f.name);
                default:
                    return true;
            }
        });
    }
    // group files in folders
    const folders: pxt.Map<File[]> = {};
    files.forEach(f => {
        const i = f.name.lastIndexOf("/");
        const folder = i < 0 ? "" : f.name.slice(0, i);
        if (!folders[folder]) folders[folder] = [];

        folders[folder].push(f);
    });

    return (
        <FolderTreeItem
            name={id}
        >
        </FolderTreeItem>
    )
}