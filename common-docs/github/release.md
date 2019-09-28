# GitHub Releases

If you plan to reuse your repository in other projects as an extension, you will need to create releases for it.

Releases mark a specific point in your repository's history and allow you to publish your extension
for use by others when you think your changes are ready.

## Versioning #versioning

In MakeCode, the each of the 3 numbers in the extension version have a special meaning. It follows a common scheme called [semver](https://semver.org/).

Whenever, you see a version number like **1.3.19**,
it really means **major** version is ``1``, **minor**
version is ``3``, and **patch** number is ``19``.

Basically, the rules of **semver** are, for a particular version ``MAJOR.MINOR.PATCH``, you set the next version by incrementing the:

* ``MAJOR`` version when you make incompatible API changes.
* ``MINOR`` version when you add functionality in a backwards compatible manner.
* ``PATCH`` version when you make backwards compatible bug fixes.

## License #license

You can include an open source license in your repository to make it easier for other people to contribute.

## See Also

[GitHub Licensing Documentation](https://help.github.com/en/articles/licensing-a-repository),
[GitHub Releases Documentation](https://help.github.com/en/articles/about-releases)