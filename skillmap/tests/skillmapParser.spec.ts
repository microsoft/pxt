
/// <reference path="../../built/pxtlib.d.ts"/>
import getSectionsFromText = pxt.getSectionsFromMarkdownMetadata;
import MarkdownList = pxt.MarkdownList;
import MarkdownSection = pxt.MarkdownSection;
import chai = require("chai");


describe("skillmap parser", () => {
    it("should parse nested lists", () => {
        const test = `
### forest-cert
* name: Congrats!
* url: /static/skillmap/certificates/forest-cert.pdf
* rewards:
    * certificate:
        * url: /static/skillmap/certificates/forest-cert.pdf
        * previewUrl: /static/skillmap/certificates/forest-cert.png
    * completion-badge: /static/badges/badge-forest.png
* actions:
    * map: [Try the Jungle Monkey Skillmap](/skillmap/jungle)
    * map: [Try the Space Explorer Skillmap](/skillmap/space)
    * editor: [Edit Your Project with a Full Toolbox] (/)
        `;

        const expected: MarkdownSection = {
            headerKind: "triple",
            header: "forest-cert",
            attributes: {
                "name": "Congrats!",
                "url": "/static/skillmap/certificates/forest-cert.pdf"
            },
            listAttributes: {
                "rewards": {
                    key: "rewards",
                    items: [
                        {
                            key: "certificate",
                            items: [
                                "url: /static/skillmap/certificates/forest-cert.pdf",
                                "previewurl: /static/skillmap/certificates/forest-cert.png"
                            ]
                        },
                        "completion-badge: /static/badges/badge-forest.png"
                    ]
                },
                "actions": {
                    key: "actions",
                    items: [
                        "map: [Try the Jungle Monkey Skillmap](/skillmap/jungle)",
                        "map: [Try the Space Explorer Skillmap](/skillmap/space)",
                        "editor: [Edit Your Project with a Full Toolbox] (/)",
                    ]
                }
            }
        }


        const result = getSectionsFromText(test);
        chai.assert(result.length === 1, "Wrong number of sections");
        chai.expect(result[0]).deep.equals(expected);
    });

    it("should handle multiple sections", () => {
        const test = `
### section-1
### section-2
* hello: goodbye
`;

        const expected: MarkdownSection[] = [
            {
                headerKind: "triple",
                header: "section-1",
                attributes: { },
            },
            {
                headerKind: "triple",
                header: "section-2",
                attributes: {
                    "hello": "goodbye",
                },
            }
        ]


        const result = getSectionsFromText(test);
        chai.expect(result).deep.equals(expected);
    });

    it("should ignore single space indent errors", () => {
        const test = `
### section-1
* one: 1
 * two: 2
* list:
  * three: 3
   * four: 4
`;

        const expected: MarkdownSection[] = [
            {
                headerKind: "triple",
                header: "section-1",
                attributes: {
                    "one": "1",
                    "two": "2"
                },
                listAttributes: {
                    "list": {
                        key: "list",
                        items: [
                            "three: 3",
                            "four: 4"
                        ]
                    }
                }
            }
        ]


        const result = getSectionsFromText(test);
        chai.expect(result).deep.equals(expected);
    });
})