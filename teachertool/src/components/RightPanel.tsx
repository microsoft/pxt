import { CatalogModal } from "./CatalogModal"
import { ProjectWorkspace } from "./ProjectWorkspace"
import css from "./styling/RightPanel.module.scss";

export const RightPanel: React.FC = () => {
    return <div className={css["panel"]}>
        <CatalogModal />
        <ProjectWorkspace />
    </div>
}
