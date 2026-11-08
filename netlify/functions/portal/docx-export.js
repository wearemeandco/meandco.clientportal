/* ============================================================
   Me&Co. — branded DOCX export
   ------------------------------------------------------------
   Same intent as the print/PDF path: a real client-facing
   document, not a bare data dump. Oxford navy heading, blue
   accent rule, Me&Co. letterhead line, real brand colors
   translated into docx's own color system (hex, no leading #).
   ============================================================ */

const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, AlignmentType } = require('docx');

const OXFORD = '0A2342';
const BLUE = '1E45FB';
const BLUE_INK = '0B1F8F';
const INK = '1a1a1a';

function textItemsToParagraphs(card) {
  const paras = [];
  (card.items || [])
    .filter((i) => i.type === 'text')
    .forEach((item) => {
      paras.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
          children: [new TextRun({ text: item.title, bold: true, color: OXFORD, font: 'Georgia' })],
        })
      );
      String(item.content || '')
        .split(/\n\s*\n/)
        .forEach((p) => {
          paras.push(
            new Paragraph({
              spacing: { after: 200 },
              children: [new TextRun({ text: p, color: INK, font: 'Calibri', size: 22 })],
            })
          );
        });
    });
  if (!paras.length) {
    paras.push(new Paragraph({ children: [new TextRun({ text: 'No written content on this card yet.', italics: true, color: INK })] }));
  }
  return paras;
}

async function generateDocx(client, card) {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [new TextRun({ text: 'MORA STUDIOS', bold: true, color: OXFORD, font: 'Georgia', size: 28 })],
          }),
          new Paragraph({
            border: { bottom: { color: BLUE, space: 4, style: BorderStyle.SINGLE, size: 12 } },
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: client.name + '  ·  ' + new Date().toISOString().slice(0, 10),
                color: BLUE_INK,
                font: 'Calibri',
                size: 18,
              }),
            ],
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 300 },
            children: [new TextRun({ text: card.label, bold: true, color: OXFORD, font: 'Georgia', size: 36 })],
          }),
          ...textItemsToParagraphs(card),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

module.exports = { generateDocx };
