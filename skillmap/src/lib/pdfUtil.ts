declare const PDFLib: any;

let loadPdfLibPromise: Promise<boolean>;
export function loadPdfLibAsync(): Promise<boolean> {
    if (!loadPdfLibPromise)
        loadPdfLibPromise = pxt.BrowserUtils.loadScriptAsync("pdf-lib/pdf-lib.min.js")
            .then(() => typeof PDFLib !== "undefined")
            .catch(e => false);
    return loadPdfLibPromise;
}

export async function pdfRenderNameField(pdfBuf: ArrayBuffer, name?: string) {
    if (!(await loadPdfLibAsync()))
        return pdfBuf;

    if (!name?.trim()) {
        return pdfBuf;
    }

    const {
        PDFDocument,
        StandardFonts,
        TextAlignment,
        rgb,
    } = PDFLib;
    const pdfDoc = await PDFDocument.load(pdfBuf);

    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    const { width: pageWidth, height: pageHeight } = firstPage.getSize();

    const form = pdfDoc.getForm();
    let nameEntryField;
    try {
        nameEntryField = form.getTextField("name-entry");
    } catch (e) {
        // just default to printing
    }

    if (nameEntryField) {
        nameEntryField.setText(name);
        nameEntryField.enableReadOnly();
        nameEntryField.setAlignment(TextAlignment.Center);
        nameEntryField.disableScrolling();
        const [widget] = nameEntryField.acroField.getWidgets();
        nameEntryField.updateAppearances(helveticaFont);
        const { width, height } = widget.getRectangle();
        const widthAtSize10 = helveticaFont.widthOfTextAtSize(name, 10);
        const fontSize = Math.min(
            /** Account for font descender (y, j) size below line */
            helveticaFont.sizeAtHeight(height * .8),
            (width / widthAtSize10) * 10) | 0;
        nameEntryField.setFontSize(fontSize)
    } else {
        const maxPercentWidth = .5;
        const maxPxWidth = maxPercentWidth * pageWidth | 0;
        const widthAtSize10 = helveticaFont.widthOfTextAtSize(name, 10);
        const scalePerc = maxPxWidth / widthAtSize10;
        // todo configurable? or just remove htis whole thing & require nameEntryField;
        let offset = 15;
        // switch (chosen) {
        //     case "shark":
        //         offset = -75; break;
        //     case "racer":
        //         offset = 20; break;
        //     default:
        //         offset = 15; break;
        // }
        const sLen = name.length;
        const fontSize = Math.min(70, (scalePerc * 10) | 0);
        firstPage.drawText(name, {
            x: pageWidth / 2 - (helveticaFont.widthOfTextAtSize(name, fontSize)) / 2,
            y: pageHeight / 2 - fontSize / 2 + offset,
            size: fontSize,
            font: helveticaFont,
            color: rgb(0.1, 0.1, 0.1),
        })
    }

    return await pdfDoc.save();
}

