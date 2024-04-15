export namespace Strings {
    export const ErrorLoadingRubricMsg = lf("That wasn't a valid rubric.");
    export const ConfirmReplaceRubricMsg = lf("This will replace your current rubric. Continue?");
    export const UntitledProject = lf("Untitled Project");
    export const UntitledRubric = lf("Untitled Rubric");
    export const NewRubric = lf("New Rubric");
    export const ImportRubric = lf("Import Rubric");
    export const ExportRubric = lf("Export Rubric");
    export const Remove = lf("Remove");
    export const Criteria = lf("Criteria");
    export const Name = lf("Name");
    export const RubricName = lf("Rubric Name");
    export const AddCriteria = lf("Add Criteria");
    export const Actions = lf("Actions");
    export const AutoRun = lf("auto-run");
    export const AutoRunDescription = lf("Automatically re-evaluate when the rubric or project changes");
    export const AddNotes = lf("Add Notes");
    export const DragAndDrop = lf("Drag & Drop");
    export const ReleaseToUpload = lf("Release to Upload");
    export const Browse = lf("Browse");
    export const SelectRubricFile = lf("Select Rubric File");
    export const InvalidRubricFile = lf("Invalid Rubric File");
    export const Cancel = lf("Cancel");
    export const SelectBlock = lf("Select Block");
    export const ValueRequired = lf("Value Required");
    export const AddSelected = lf("Add Selected");
    export const Continue = lf("Continue");
    export const Loading = lf("Loading...");
}

export namespace Ticks {
    export const Loaded = "teachertool.loaded";
    export const HomeLink = "teachertool.homelink";
    export const BrandLink = "teachertool.brandlink";
    export const OrgLink = "teachertool.orglink";
    export const Error = "teachertool.error";
    export const NewRubric = "teachertool.newrubric";
    export const ImportRubric = "teachertool.importrubric";
    export const ExportRubric = "teachertool.exportrubric";
    export const LoadRubric = "teachertool.loadrubric";
    export const Evaluate = "teachertool.evaluate";
    export const Autorun = "teachertool.autorun";
    export const AddCriteria = "teachertool.addcriteria";
    export const RemoveCriteria = "teachertool.removecriteria";
    export const AddResultNotes = "teachertool.addresultnotes";
}

namespace Misc {
    export const LearnMoreLink = "https://makecode.com/teachertool"; // TODO: Replace with golink or aka.ms link
}

export const Constants = Object.assign(Misc, { Strings, Ticks });
