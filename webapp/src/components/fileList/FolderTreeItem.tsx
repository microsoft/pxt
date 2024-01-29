import { Button } from "../../../../react-common/components/controls/Button";
import { classList, useId } from "../../../../react-common/components/util";

export interface FolderTreeItemProps {
    name: string;
    actions?: React.ReactChild;
    children?: React.ReactChild;
}

export const FolderTreeItem = (props: FolderTreeItemProps) => {
    const { children, name, actions } = props;
    const [isExpanded, setIsExpanded] = React.useState(false);

    const onClick = React.useCallback(() => {
        setIsExpanded(!isExpanded);
    }, [isExpanded]);

    const childrenId = useId();

    return (
        <li role="none" className="file-folderitem">
            <div className="file-treeitem">
                <Button
                    role="treeitem"
                    className="file-treeitem-label"
                    onClick={onClick}
                    ariaOwns={childrenId}
                    ariaExpanded={isExpanded}
                    label={
                        <>
                            {name}
                        </>
                    }
                />
                {actions}
                <i className={classList("fas", isExpanded ? "fa-chevron-up" : "fa-chevron-down")} />
            </div>
            <ul
                role="group"
                className="file-folderitem-children"
                id={childrenId}
                style={{ display: isExpanded ? "" : "none" }}
            >
                {children}
            </ul>
        </li>
    );
};