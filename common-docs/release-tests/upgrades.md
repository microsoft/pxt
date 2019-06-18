# Project Upgrade test plan

We perform two types of upgrades when importing projects: JavaScript and Blockly.
Our upgrade strategy is as follows:

1. If the project was created in the current target (same major/minor versions), we do nothing
2. Otherwise, check what editor this project was saved in (either Monaco or Blockly)
3. If Blockly, try to update the blocks of the project
4. If Monaco (or if Blockly update fails), try to upgrade the Javascript in the project
5. If all upgrades fail, we open the original un-edited project
6. Otherwise, we open the editor that we succeeded in

"Upgrade failing" refers to the project failing to compile.
Therefore, if a project is saved with errors than it will probably fail to upgrade as well.
We do not "downgrade" scripts; the old target should refuse to open any scripts created in newer versions.

For each of the following scenarios, complete the steps in both blocks and JavaScript.
To see a list of JavaScript upgrades, you can check the `pxtarget.json` for the target.
Blockly upgrades are present in that file as well but can also be added in a target's editor extensions.
Also note that `v0` and `v1` here refer to an old version of the editor and the current version of the editor respectively.

## Test scenarios:

1. Test automatic migration from v0 to v1
    * Clear your browser storage for the target
    * Open v0 (do not open v1) and create a project that should work fine in v1
    * Create a second project in v0 with an API that changed in v1
    * Close the window with v0 and navigate to v1
    * Check that both projects are present and load properly in the editor where they were created
    * The project with the API change should be properly upgraded

2. Test importing a hex/uf2/mkcd file
    * Create a project in v0 with an API that changed in v1
    * Download the project file
    * In v1, import the file from the home screen (or drag it into the editor)
    * The project should be upgraded and open in the editor in which it was created

3. Test importing a shared project
    * Create a project in v0 with an API that changed in v1
    * Share the project and copy the link
    * In v1, import the file from the home screen using the Import URL feature
    * The project should be upgraded and open in the editor in which it was created

4. Test importing a project with errors
    * Create a project in v0 with an API that changed in v1
    * Add an error to the project
    * Download the project file
    * In v1, import the file from the home screen (or drag it into the editor)
    * The project should be unchanged and open in the editor in which it was created

5. Test importing a project from the current version of the editor
    * Create a project in v1 that uses a deprecated API in v0
    * Download the project file
    * In v1, import the file from the home screen (or drag it into the editor)
    * The project should be unchanged and open in the editor in which it was created

6. Test importing a v1 project in v0
    * Create a project in v1
    * Download the project file
    * In v0, import the file from the home screen (or drag it into the editor)
    * You should be notified that the project is too new and cannot be opened
    * Repeat for shared script

7. Test downgraded local project (only applies if v1 and v0 share a database prefix)
    * Create a project in v1
    * Navigate to v0
    * Open the project from the home screen projects list
    * You should be notified that the project is too new and cannot be opened
