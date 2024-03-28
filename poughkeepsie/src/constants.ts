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
}

export namespace Ticks {
    export const Loaded = "poughkeepsie.loaded";
    export const HomeLink = "poughkeepsie.homelink";
    export const BrandLink = "poughkeepsie.brandlink";
    export const OrgLink = "poughkeepsie.orglink";
    export const Error = "poughkeepsie.error";
    export const NewRubric = "poughkeepsie.newrubric";
    export const ImportRubric = "poughkeepsie.importrubric";
    export const ExportRubric = "poughkeepsie.exportrubric";
    export const LoadRubric = "poughkeepsie.loadrubric";
    export const Evaluate = "poughkeepsie.evaluate";
    export const Autorun = "poughkeepsie.autorun";
    export const AddCriteria = "poughkeepsie.addcriteria";
    export const RemoveCriteria = "poughkeepsie.removecriteria";
    export const AddResultNotes = "poughkeepsie.addresultnotes";
}

namespace Misc {
    export const LearnMoreLink = "https://makecode.com/poughkeepsie"; // TODO: Replace with golink or aka.ms link
}

export const Constants = Object.assign(Misc, { Strings, Ticks });
