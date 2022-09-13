# Extension Approval

Only approved extensions are included in the search results that appear in the ``Extensions`` dialog.
GitHub Organizations or GitHub repos can be approved.

Banned extensions are not allowed to load.

## Checklist

Whenever you are submitting an extension for approval, please check that you have completed the following tasks:

- [ ] A release has been created in GitHub. You can create a release of the extension when syncing in the MakeCode editor or using the **pxt bump** cli command. The format **must** be ``MAJOR.MINOR.PATCH``.
- [ ] A license file, `LICENSE.txt`, is present in the root folder. The license type is **MIT License**. See the [Adding a license to a repository](https://help.github.com/en/github/building-a-strong-community/adding-a-license-to-a-repository) topic for more details.
- [ ] An icon image **icon.png** is available in the root folder. It should be 300x200 pixels and **less than 100kb** in size.
- [ ] A GitHub repo description added that's descriptive enough to help with extension search.
- [ ] A test file, called ``test.ts``, is present and compiles when running **pxt deploy**.
- [ ] The ``README.md`` file contains API documentation for the extension blocks.
- [ ] Your public name, functions, and types follow the [MakeCode naming conventions](https://makecode.com/extensions/naming-conventions).

## #approval